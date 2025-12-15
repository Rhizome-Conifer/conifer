#!/usr/bin/env python3
"""
Send Twilight Announcement Email to All Conifer Users

This script sends the twilight announcement email to all users with support for:
- Test mode: send to a specific email address for testing
- Rate limiting: respects SES sending limits (14 emails/second by default)
- Total send quota: enforces max emails per run (50,000 by default for SES quota)
- Progress tracking: uses SQLite database to track sent/failed/skipped emails
- Automatic resume: skips users already sent to (no manual resume needed)
- Error handling: logs errors to database and continues processing
- Deterministic ordering: sorts users alphabetically for consistent processing

Progress Database:
    All progress is stored in twilight_email_progress.db (SQLite)
    Schema: username, email, status (sent/failed/skipped), timestamp, error_message
    Query failed emails: sqlite3 twilight_email_progress.db "SELECT * FROM email_progress WHERE status='failed'"

Setup:
    Configure your EMAIL_SMTP_URL to use Amazon SES:
    EMAIL_SMTP_URL=starttls://SMTP_USER:SMTP_PASS@email-smtp.REGION.amazonaws.com:587

Usage:
    # Test mode - send to specific email
    python send_twilight_announcement.py --test your.email@example.com

    # Send to all users with default settings (14 emails/sec, max 50,000)
    python send_twilight_announcement.py

    # Send with custom rate limit and total quota
    python send_twilight_announcement.py --max-send-rate 10 --max-total-send 25000

    # Resume after a specific username (optional - auto-resumes by default)
    python send_twilight_announcement.py --resume-from username123

    # Dry run - show what would be sent without actually sending
    python send_twilight_announcement.py --dry-run
"""

import os
import sys
import time
import argparse
import json
import smtplib
import sqlite3
from datetime import datetime
from bottle import template
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import urlparse, unquote

# Add the webrecorder directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'webrecorder'))

from webrecorder.models.usermanager import CLIUserManager
from webrecorder.webreccork import WebRecCork


class TwilightAnnouncementSender:
    def __init__(self, test_email=None, batch_size=200, delay=0, dry_run=False, resume_from=None,
                 max_send_rate=14.0, max_total_send=50000):
        """
        Initialize the announcement sender

        Args:
            test_email: If provided, only send to this email (test mode)
            batch_size: Number of emails to send per batch (for progress reporting)
            delay: Seconds to wait between batches (default 0, rate limiting handles pacing)
            dry_run: If True, don't actually send emails
            resume_from: Username to resume after (skips this user and all before it)
            max_send_rate: Maximum emails per second (default 14 for SES)
            max_total_send: Maximum total emails to send in one run (default 50000 for SES quota)
        """
        self.user_manager = CLIUserManager()
        self.cork = self.user_manager.cork
        self.test_email = test_email
        self.batch_size = batch_size
        self.delay = delay
        self.dry_run = dry_run
        self.resume_from = resume_from
        self.max_send_rate = max_send_rate
        self.max_total_send = max_total_send

        # Calculate delay between emails to respect rate limit
        # Add a small buffer (10%) to be safe
        self.email_delay = (1.0 / max_send_rate) * 1.1 if max_send_rate > 0 else 0

        self.template_path_html = os.path.join(
            os.path.dirname(__file__),
            'webrecorder/templates/email_twilight_announcement.html'
        )
        self.template_path_text = os.path.join(
            os.path.dirname(__file__),
            'webrecorder/templates/email_twilight_announcement.txt'
        )

        self.db_file = 'twilight_email_progress.db'
        self.sent_users = set()  # Cache of usernames already sent to

        # Initialize database
        self._init_database()

        # Load sent users into memory for fast lookup
        self._load_sent_users()

        self.stats = {
            'total_users': 0,
            'emails_sent': 0,
            'emails_failed': 0,
            'emails_skipped': 0,
            'start_time': None,
            'end_time': None
        }

    def _send_via_smtp(self, to_addr, subject, body_text, body_html, reply_to='support@conifer.rhizome.org'):
        """
        Send email via SMTP with Reply-To header support and multipart text/html

        Args:
            to_addr: Recipient email address
            subject: Email subject
            body_text: Plain text email body
            body_html: HTML email body
            reply_to: Reply-To email address (default: support@conifer.rhizome.org)
        """
        # Get SMTP configuration from environment variables (same as cork uses)
        smtp_url = os.path.expandvars(os.environ.get('SES_EMAIL_SMTP_URL', ''))

        if not smtp_url:
            raise ValueError("SES_EMAIL_SMTP_URL environment variable must be set")

        # Parse SMTP URL (format: starttls://user:pass@host:port)
        parsed = urlparse(smtp_url)
        use_tls = parsed.scheme == 'starttls'
        username = unquote(parsed.username) if parsed.username else None
        password = unquote(parsed.password) if parsed.password else None
        host = parsed.hostname
        port = parsed.port or 587
        sender = 'no-reply@conifer.rhizome.org'

        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f'Conifer <{sender}>'
        msg['To'] = to_addr
        msg['Reply-To'] = reply_to

        # Attach plain text and HTML bodies
        # According to RFC 2046, the last part (HTML) is preferred
        text_part = MIMEText(body_text, 'plain', 'utf-8')
        msg.attach(text_part)

        html_part = MIMEText(body_html, 'html', 'utf-8')
        msg.attach(html_part)

        # Send via SMTP
        if use_tls:
            smtp = smtplib.SMTP(host, port)
            smtp.starttls()
        else:
            smtp = smtplib.SMTP_SSL(host, port)

        if username and password:
            smtp.login(username, password)

        smtp.sendmail(sender, to_addr, msg.as_string())
        smtp.quit()

    def _init_database(self):
        """Initialize SQLite database with schema"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS email_progress (
                username TEXT PRIMARY KEY,
                email TEXT,
                status TEXT,
                timestamp TEXT,
                error_message TEXT
            )
        ''')

        # Create index on status for faster queries
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_status ON email_progress(status)
        ''')

        conn.commit()
        conn.close()

    def _load_sent_users(self):
        """Load all successfully sent usernames into memory for fast lookup"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        cursor.execute("SELECT username FROM email_progress WHERE status='sent'")
        self.sent_users = set(row[0] for row in cursor.fetchall())

        conn.close()

        if self.sent_users:
            print(f"Loaded {len(self.sent_users)} previously sent users from database")

    def save_progress(self, username, email, status, error_message=None):
        """
        Save progress to SQLite database

        Args:
            username: User's username
            email: User's email address
            status: Status - 'sent', 'failed', or 'skipped'
            error_message: Error message if status is 'failed'
        """
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        try:
            cursor.execute('''
                INSERT OR REPLACE INTO email_progress
                (username, email, status, timestamp, error_message)
                VALUES (?, ?, ?, ?, ?)
            ''', (username, email, status, datetime.utcnow().isoformat(), error_message))

            conn.commit()

            # Update in-memory cache if sent successfully
            if status == 'sent':
                self.sent_users.add(username)

        except Exception as e:
            print(f"Warning: Could not save progress for {username}: {e}")
        finally:
            conn.close()

    def log_error(self, username, email, error):
        """Log errors to database and console"""
        error_msg = str(error)
        print(f"ERROR: User: {username}, Email: {email}, Error: {error_msg}")

        # Save to database with 'failed' status
        self.save_progress(username, email, 'failed', error_msg)

    def send_email(self, username, email):
        """
        Send the twilight announcement email to a single user

        Args:
            username: User's username
            email: User's email address

        Returns:
            bool: True if successful, False otherwise
        """
        if not email:
            print(f"Skipping {username}: No email address")
            self.stats['emails_skipped'] += 1
            self.save_progress(username, email or '', 'skipped', 'No email address')
            return False

        try:
            # Render both email templates
            email_html = template(
                self.template_path_html,
                username=username,
            )
            email_text = template(
                self.template_path_text,
                username=username,
            )

            if self.dry_run:
                print(f"[DRY RUN] Would send to: {username} ({email})")
                return True

            # Send the email with both plain text and HTML versions
            self._send_via_smtp(
                email,
                'Important Update: Conifer Twilight Announcement',
                email_text,
                email_html
            )

            print(f"✓ Sent to: {username} ({email})")
            self.stats['emails_sent'] += 1
            self.save_progress(username, email, 'sent')
            return True

        except Exception as e:
            self.log_error(username, email, e)
            self.stats['emails_failed'] += 1
            return False

    def get_users_to_process(self):
        """
        Get list of users to process, filtering out already-sent users

        Returns:
            list: List of (username, user_data) tuples sorted alphabetically
        """
        # Sort users alphabetically for deterministic ordering
        all_users = sorted(self.user_manager.all_users.items(), key=lambda x: x[0])
        self.stats['total_users'] = len(all_users)

        # Filter out users already sent to
        users_to_process = []
        already_sent_count = 0

        for username, user_data in all_users:
            # If resume_from is set, skip users up to and including it
            if self.resume_from and username <= self.resume_from:
                continue

            # Skip if already sent
            if username in self.sent_users:
                already_sent_count += 1
                continue

            users_to_process.append((username, user_data))

        if already_sent_count > 0:
            print(f"Skipping {already_sent_count} users already sent to (from database)")

        if self.resume_from:
            skipped = len(all_users) - len(users_to_process) - already_sent_count
            if skipped > 0:
                print(f"Resuming after user: {self.resume_from}")
                print(f"Skipping {skipped} users up to and including resume point")

        return users_to_process

    def send_test_email(self):
        """Send a test email to the specified test email address"""
        print(f"\n{'='*60}")
        print("TEST MODE")
        print(f"{'='*60}")
        print(f"Sending test email to: {self.test_email}\n")

        # Use a dummy username and name for testing
        success = self.send_email(
            username="testuser",
            email=self.test_email,
        )

        if success:
            print(f"\n✓ Test email sent successfully to {self.test_email}")
        else:
            print(f"\n✗ Failed to send test email to {self.test_email}")

        return success

    def send_to_all_users(self):
        """Send announcement email to all users in batches with rate limiting"""
        print(f"\n{'='*60}")
        print("SENDING TWILIGHT ANNOUNCEMENT TO ALL USERS")
        print(f"{'='*60}")

        if self.dry_run:
            print("DRY RUN MODE - No emails will actually be sent\n")

        users = self.get_users_to_process()

        # Enforce total send limit
        users_to_send = users[:self.max_total_send] if len(users) > self.max_total_send else users

        if len(users) > self.max_total_send:
            print(f"\nWARNING: Total users ({len(users)}) exceeds send limit ({self.max_total_send})")
            print(f"Will only send to first {self.max_total_send} users")
            print(f"Use --resume-from to continue in a subsequent run\n")

        print(f"Total users to process: {len(users_to_send)}")
        print(f"Batch size: {self.batch_size} (for progress reporting)")
        print(f"Rate limit: {self.max_send_rate} emails/second")
        print(f"Email delay: {self.email_delay:.3f} seconds between emails")
        if self.delay > 0:
            print(f"Batch delay: {self.delay} seconds between batches")

        # Calculate estimated time
        estimated_time = len(users_to_send) * self.email_delay
        estimated_minutes = estimated_time / 60
        print(f"Estimated time: {estimated_minutes:.1f} minutes\n")

        # Ask for confirmation unless in dry run mode
        if not self.dry_run:
            response = input("Do you want to proceed? (yes/no): ")
            if response.lower() not in ['yes', 'y']:
                print("Aborted by user")
                return

        print("\nStarting email send...\n")
        self.stats['start_time'] = datetime.utcnow().isoformat()

        batch_count = 0
        emails_in_batch = 0

        for idx, (username, user_data) in enumerate(users_to_send, 1):
            # Get user's email
            email = user_data.get('email_addr', '')

            if user_data.get('role') == 'suspended':
                print(f"Skipping {username}: Account suspended")
                self.stats['emails_skipped'] += 1
                self.save_progress(username, email or '', 'skipped', 'Account suspended')
                continue

            # Send the email
            success = self.send_email(username, email)

            if success:
                emails_in_batch += 1

                # Rate limiting: sleep between emails (unless this is the last one)
                if idx < len(users_to_send) and self.email_delay > 0:
                    time.sleep(self.email_delay)

            # Print progress every 10 emails
            if idx % 10 == 0:
                print(f"\nProgress: {idx}/{len(users_to_send)} users processed")
                print(f"  Sent: {self.stats['emails_sent']}, Failed: {self.stats['emails_failed']}, Skipped: {self.stats['emails_skipped']}\n")

            # Batch delay (optional, in addition to rate limiting)
            if emails_in_batch >= self.batch_size and self.delay > 0:
                batch_count += 1
                print(f"\n--- Completed batch {batch_count} ({emails_in_batch} emails) ---")

                # Don't delay after the last batch
                if idx < len(users_to_send):
                    print(f"Waiting {self.delay} seconds before next batch...\n")
                    time.sleep(self.delay)

                emails_in_batch = 0

        self.stats['end_time'] = datetime.utcnow().isoformat()
        self.print_summary()

    def print_summary(self):
        """Print final summary of email sending from database"""
        # Query database for accurate totals
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        cursor.execute("SELECT status, COUNT(*) FROM email_progress GROUP BY status")
        db_stats = dict(cursor.fetchall())

        cursor.execute("SELECT COUNT(*) FROM email_progress")
        total_processed = cursor.fetchone()[0]

        conn.close()

        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        print(f"Total users in system: {self.stats['total_users']}")
        print(f"Total processed: {total_processed}")
        print(f"  Emails sent: {db_stats.get('sent', 0)}")
        print(f"  Emails failed: {db_stats.get('failed', 0)}")
        print(f"  Emails skipped: {db_stats.get('skipped', 0)}")

        # Show this run's stats if different from totals
        if self.stats['start_time'] and self.stats['end_time']:
            print(f"\nThis run:")
            print(f"  Sent: {self.stats['emails_sent']}")
            print(f"  Failed: {self.stats['emails_failed']}")
            print(f"  Skipped: {self.stats['emails_skipped']}")

            start = datetime.fromisoformat(self.stats['start_time'])
            end = datetime.fromisoformat(self.stats['end_time'])
            duration = end - start
            print(f"  Duration: {duration}")

            # Calculate actual send rate
            if self.stats['emails_sent'] > 0:
                actual_rate = self.stats['emails_sent'] / duration.total_seconds()
                print(f"  Actual send rate: {actual_rate:.2f} emails/second")

        if db_stats.get('failed', 0) > 0:
            print(f"\nFailed emails can be queried from: {self.db_file}")
            print(f"  Example: sqlite3 {self.db_file} \"SELECT * FROM email_progress WHERE status='failed'\"")

        print(f"\nProgress database: {self.db_file}")
        print(f"{'='*60}\n")

    def run(self):
        """Main entry point"""
        if self.test_email:
            return self.send_test_email()
        else:
            return self.send_to_all_users()


def main():
    parser = argparse.ArgumentParser(
        description='Send Twilight Announcement Email to Conifer Users',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        '--test',
        metavar='EMAIL',
        help='Test mode: send a test email to this address instead of all users'
    )

    parser.add_argument(
        '--batch-size',
        type=int,
        default=200,
        help='Number of emails to send per batch (default: 200)'
    )

    parser.add_argument(
        '--delay',
        type=int,
        default=0,
        help='Seconds to wait between batches (default: 0, rate limiting handles pacing)'
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be sent without actually sending emails'
    )

    parser.add_argument(
        '--resume-from',
        metavar='USERNAME',
        help='Resume sending after this username (skips this user and all before it)'
    )

    parser.add_argument(
        '--max-send-rate',
        type=float,
        default=14.0,
        help='Maximum emails per second (default: 14 for SES)'
    )

    parser.add_argument(
        '--max-total-send',
        type=int,
        default=50000,
        help='Maximum total emails to send in one run (default: 50000 for SES quota)'
    )

    args = parser.parse_args()

    # Validate batch size and delay
    if args.batch_size < 1:
        print("Error: batch-size must be at least 1")
        return 1

    if args.delay < 0:
        print("Error: delay must be non-negative")
        return 1

    if args.max_send_rate <= 0:
        print("Error: max-send-rate must be positive")
        return 1

    if args.max_total_send < 1:
        print("Error: max-total-send must be at least 1")
        return 1

    # Create and run sender
    sender = TwilightAnnouncementSender(
        test_email=args.test,
        batch_size=args.batch_size,
        delay=args.delay,
        dry_run=args.dry_run,
        resume_from=args.resume_from,
        max_send_rate=args.max_send_rate,
        max_total_send=args.max_total_send
    )

    try:
        sender.run()
        return 0
    except KeyboardInterrupt:
        print("\n\nInterrupted by user. Progress has been saved.")
        print(f"To resume, run with: --resume-from {sender.stats.get('last_username', 'LAST_USERNAME')}")
        return 1
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
