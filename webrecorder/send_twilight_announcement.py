#!/usr/bin/env python3
"""
Send Twilight Announcement Email to All Conifer Users

This script sends the twilight announcement email to all users with support for:
- Email validation: validates syntax, checks SES suppression list, verifies MX records
- Spam/bot detection: quarantines suspicious emails (gambling keywords, bot domains, random patterns)
- Test mode: send to a specific email address for testing
- Rate limiting: respects SES sending limits (14 emails/second by default)
- Total send quota: enforces max emails per run (50,000 by default for SES quota)
- Progress tracking: uses SQLite database to track sent/failed/skipped/quarantined emails
- Automatic resume: skips users already sent to or quarantined (no manual resume needed)
- Error handling: logs errors to database and continues processing
- Deterministic ordering: sorts users alphabetically for consistent processing

Progress Database:
    All progress is stored in twilight_email_progress.db (SQLite)
    Schema: username, email, status (sent/failed/skipped/quarantined), timestamp, error_message
    Query failed emails: sqlite3 twilight_email_progress.db "SELECT * FROM email_progress WHERE status='failed'"
    Query quarantined emails: sqlite3 twilight_email_progress.db "SELECT * FROM email_progress WHERE status='quarantined'"

Usage:
    # Test mode - send to specific email
    python send_twilight_announcement.py --test your.email@example.com

    # Send to all users with SES suppression list validation
    python send_twilight_announcement.py --suppression-db ses_suppression.db

    # Send only to users who logged in after a specific date
    python send_twilight_announcement.py --suppression-db ses_suppression.db --last-login 2020-01-01

    # Send only to users with collection size >= 1MB
    python send_twilight_announcement.py --suppression-db ses_suppression.db --min-size 1048576

    # Combine filters: recent logins AND larger collections
    python send_twilight_announcement.py --suppression-db ses_suppression.db --last-login 2020-01-01 --min-size 1048576

    # Send with custom rate limit and total quota
    python send_twilight_announcement.py --suppression-db ses_suppression.db --max-send-rate 10 --max-total-send 25000

    # Resume after a specific username (optional - auto-resumes by default)
    python send_twilight_announcement.py --suppression-db ses_suppression.db --resume-from username123

    # Dry run - show what would be sent without actually sending
    python send_twilight_announcement.py --suppression-db ses_suppression.db --dry-run
"""

import os
import sys
import time
import argparse
import json
import smtplib
import sqlite3
import re
from datetime import datetime
from bottle import template
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from urllib.parse import urlparse, unquote

try:
    import dns.resolver
    DNS_VALIDATION_AVAILABLE = True
except ImportError:
    DNS_VALIDATION_AVAILABLE = False
    print("Warning: dnspython not available. DNS/MX validation disabled.")

# Add the webrecorder directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'webrecorder'))

from webrecorder.models.usermanager import CLIUserManager
from webrecorder.webreccork import WebRecCork


def is_valid_email_syntax(email):
    """
    Validate email format using regex

    Args:
        email: Email address to validate

    Returns:
        bool: True if email has valid syntax
    """
    if not email or '@' not in email:
        return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None


def load_ses_suppression_list_from_db(db_file):
    """
    Load SES suppression list from SQLite database

    Args:
        db_file: Path to SQLite database file created by build_ses_suppression_db.py

    Returns:
        dict: Dictionary mapping email -> reason (BOUNCE or COMPLAINT)
    """
    if not db_file:
        return {}

    suppressed_emails = {}

    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()

        print(f"Loading SES suppression list from {db_file}...")

        cursor.execute('SELECT email, reason FROM suppressed_emails')
        for email, reason in cursor.fetchall():
            suppressed_emails[email.lower()] = reason

        # Get stats
        cursor.execute('SELECT reason, COUNT(*) FROM suppressed_emails GROUP BY reason')
        stats = dict(cursor.fetchall())

        conn.close()

        print(f"✓ Loaded {len(suppressed_emails)} suppressed email addresses")
        if stats:
            print(f"  Breakdown: ", end='')
            print(', '.join(f"{reason}: {count}" for reason, count in stats.items()))

        return suppressed_emails

    except sqlite3.Error as e:
        print(f"Warning: Could not load SES suppression list from {db_file}: {e}")
        print("Continuing without SES suppression checking...")
        return {}
    except Exception as e:
        print(f"Warning: Unexpected error loading suppression list: {e}")
        return {}


def is_email_suppressed(email, suppression_list):
    """
    Check if email is on the pre-downloaded SES suppression list

    Args:
        email: Email address to check
        suppression_list: Dictionary from download_ses_suppression_list()

    Returns:
        tuple: (is_suppressed, reason) where reason is BOUNCE or COMPLAINT
    """
    email_lower = email.lower()
    if email_lower in suppression_list:
        return (True, suppression_list[email_lower])
    return (False, None)


def check_domain_mx_records(domain, mx_cache):
    """
    Check if domain has valid MX records with caching

    Args:
        domain: Domain name to check
        mx_cache: Dictionary cache of domain -> has_mx_bool

    Returns:
        bool: True if domain has MX records and can receive email
    """
    if not DNS_VALIDATION_AVAILABLE:
        return True  # Assume valid if DNS checking not available

    # Check cache first
    if domain in mx_cache:
        return mx_cache[domain]

    try:
        mx_records = dns.resolver.resolve(domain, 'MX')
        result = len(mx_records) > 0
        mx_cache[domain] = result
        return result
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.NoNameservers):
        mx_cache[domain] = False
        return False
    except Exception as e:
        print(f"Warning: Could not check MX records for {domain}: {e}")
        # Don't cache errors - try again next time
        return True  # Assume valid on error to avoid false positives


def has_valid_mx_record(email, mx_cache):
    """
    Check if email domain has valid MX records

    Args:
        email: Email address to validate
        mx_cache: Dictionary cache of domain -> has_mx_bool

    Returns:
        bool: True if domain has MX records and can receive email
    """
    try:
        domain = email.split('@')[1].lower()
        return check_domain_mx_records(domain, mx_cache)
    except IndexError:
        # Invalid email format (no @ sign)
        return False


def is_suspicious_email(email, username=None):
    """
    Check if email or username matches suspicious patterns commonly associated with spam/bot signups

    Patterns detected:
    - Bot-generated domains (bydgoszczanin.net, gdanszczanin.net, cursosgratuitossepe.info)
    - Spam keywords (gambling, betting, escort services: win, bet, casino, escort, etc.)
    - Excessive random character mixing (high letter/number transitions)

    Args:
        email: Email address to check
        username: Username to check (optional)

    Returns:
        tuple: (is_suspicious, reason) where reason describes why it's suspicious
    """
    if not email or '@' not in email:
        return (False, None)

    email_lower = email.lower()
    local_part, domain = email_lower.split('@', 1)

    # Check for known bot/spam domains
    suspicious_domains = [
        'bydgoszczanin.net',
        'gdanszczanin.net',
        'cursosgratuitossepe.info',
        'lospapelesdelcoche.com',
    ]

    for spam_domain in suspicious_domains:
        if domain == spam_domain:
            return (True, f'Bot-generated domain: {spam_domain}')

    # Check for spam keywords (gambling, betting, escort services, etc.)
    suspicious_keywords = [
        'win', 'bet', 'casino', 'club', 'king', 'poker', 'slot', 'escort', 'seo',
        '789', '888', '88bet', '8k', '33win', '12bet', '28bet', '78win', '79king', '11win', '9bet'
    ]

    # Check username for suspicious keywords
    if username:
        username_lower = username.lower()
        for keyword in suspicious_keywords:
            if keyword in username_lower:
                return (True, f'Spam keyword in username: {keyword}')

    # For Gmail addresses, check both local part and full email
    if domain == 'gmail.com':
        for keyword in suspicious_keywords:
            if keyword in local_part:
                return (True, f'Spam keyword in email: {keyword}')

    # Check for excessive random character mixing (likely bot-generated)
    # Only check if email has sufficient length and mixed chars
    if len(local_part) > 15 and re.search(r'[0-9]', local_part) and re.search(r'[a-z]', local_part):
        # Count transitions between letters and numbers
        transitions = sum(1 for i in range(len(local_part)-1)
                         if local_part[i].isdigit() != local_part[i+1].isdigit())

        # High number of transitions suggests random generation
        # Example: loganh10dqba8rdr3ocr has many letter-number transitions
        if transitions > 5:
            return (True, f'Random character pattern (bot-like): {transitions} transitions')

    return (False, None)


def is_excluded_domain(email, excluded_domains, excluded_wildcards):
    """
    Check if email domain is in the exclusion set (high bounce rate domains)

    Supports both exact matches and wildcard patterns (e.g., *.edu)

    Args:
        email: Email address to check
        excluded_domains: Set of exact excluded domain names
        excluded_wildcards: Set of wildcard patterns (stored as '.edu' for *.edu)

    Returns:
        tuple: (is_excluded, domain) where domain is the excluded domain name or pattern
    """
    if not email or '@' not in email:
        return (False, None)

    # Skip if no exclusions are configured
    if not (excluded_domains or excluded_wildcards):
        return (False, None)

    domain = email.split('@')[1].lower()

    # Check exact match first
    if excluded_domains and domain in excluded_domains:
        return (True, domain)

    # Check wildcard patterns (e.g., *.edu matches anything.edu)
    if excluded_wildcards:
        for pattern in excluded_wildcards:
            if domain.endswith(pattern):
                return (True, f'*{pattern}')

    return (False, None)


class TwilightAnnouncementSender:
    def __init__(self, test_email=None, batch_size=200, delay=0, dry_run=False, resume_from=None,
                 max_send_rate=14.0, max_total_send=50000, suppression_db=None, last_login_after=None,
                 min_size=None, exclude_domains_file=None):
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
            suppression_db: Path to SES suppression list SQLite database (optional)
            last_login_after: Only send to users who logged in after this date (YYYY-MM-DD format)
            min_size: Only send to users with collection size >= this value in bytes (optional)
            exclude_domains_file: Path to file with domains to exclude (one per line, supports *.edu wildcards, optional)
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
        self.last_login_after = last_login_after
        self.min_size = min_size

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
        self.user_cache_file = 'twilight_user_cache.json'  # Cache for sorted active users

        # Initialize validation caches
        self.ses_suppression_list = {}  # Email -> reason mapping
        self.mx_cache = {}  # Domain -> has_mx_bool mapping
        self.excluded_domains = set()  # Set of excluded domain names (exact matches)
        self.excluded_wildcards = set()  # Set of wildcard patterns (e.g., '.edu' for *.edu)

        # Initialize database
        self._init_database()

        # Load sent users into memory for fast lookup
        self._load_sent_users()

        # Load SES suppression list from database (unless in test mode)
        if not test_email and suppression_db:
            self.ses_suppression_list = load_ses_suppression_list_from_db(suppression_db)
        else:
            if not test_email and not suppression_db:
                print("Warning: No suppression database provided. Use --suppression-db to enable SES bounce filtering.")
                print("         Generate one with: python build_ses_suppression_db.py --profile PROFILE --region REGION")

        # Load excluded domains from file (unless in test mode)
        if not test_email and exclude_domains_file:
            self.excluded_domains, self.excluded_wildcards = self._load_excluded_domains(exclude_domains_file)

        self.stats = {
            'total_users': 0,
            'emails_sent': 0,
            'emails_failed': 0,
            'emails_skipped': 0,
            'validation_stats': {
                'invalid_syntax': 0,
                'ses_suppressed': 0,
                'excluded_domain': 0,
                'no_mx_records': 0,
                'suspended': 0,
                'no_email': 0,
                'quarantined': 0
            },
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

        # Create message with alternative parts for text and HTML
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f'Conifer <{sender}>'
        msg['To'] = to_addr
        msg['Reply-To'] = reply_to
        msg['List-Unsubscribe'] = '<mailto:unsubscribe@conifer.rhizome.org?subject=Unsubscribe%20from%20Conifer%20emails>'

        # Attach plain text
        text_part = MIMEText(body_text, 'plain', 'utf-8')
        msg.attach(text_part)

        # Create related part for HTML + embedded images
        msg_related = MIMEMultipart('related')
        msg.attach(msg_related)

        # Attach HTML body
        html_part = MIMEText(body_html, 'html', 'utf-8')
        msg_related.attach(html_part)

        # Attach logo image with CID
        logo_path = os.path.join(os.path.dirname(__file__), 'conifer-logo.png')
        if os.path.exists(logo_path):
            with open(logo_path, 'rb') as img_file:
                img_data = img_file.read()
                img = MIMEImage(img_data, 'png')
                img.add_header('Content-ID', '<conifer-logo>')
                img.add_header('Content-Disposition', 'inline', filename='conifer-logo.png')
                msg_related.attach(img)
        else:
            print(f"Warning: Logo file not found at {logo_path}")

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
        """Load all successfully sent and quarantined usernames into memory for fast lookup"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        # Load both sent and quarantined users to skip them in future runs
        cursor.execute("SELECT username FROM email_progress WHERE status IN ('sent', 'quarantined')")
        self.sent_users = set(row[0] for row in cursor.fetchall())

        # Get separate counts for reporting
        cursor.execute("SELECT COUNT(*) FROM email_progress WHERE status='sent'")
        sent_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM email_progress WHERE status='quarantined'")
        quarantined_count = cursor.fetchone()[0]

        conn.close()

        if sent_count > 0:
            print(f"Loaded {sent_count} previously sent users from database")
        if quarantined_count > 0:
            print(f"Loaded {quarantined_count} quarantined users from database (will be skipped)")

    def _load_excluded_domains(self, exclude_file):
        """
        Load excluded domains from file (high bounce rate domains to skip)

        Supports both exact domains and wildcard patterns:
        - exact: example.com
        - wildcard: *.edu (matches all .edu domains)

        Args:
            exclude_file: Path to file with excluded domains (one per line)

        Returns:
            tuple: (exact_domains_set, wildcard_patterns_set)
        """
        exact_domains = set()
        wildcard_patterns = set()

        try:
            with open(exclude_file, 'r') as f:
                for line in f:
                    domain = line.strip().lower()
                    if domain and not domain.startswith('#'):  # Skip empty lines and comments
                        # Check if it's a wildcard pattern
                        if domain.startswith('*.'):
                            # Store wildcard as '.edu' for *.edu
                            wildcard_patterns.add(domain[1:])  # Remove the *
                        else:
                            exact_domains.add(domain)

            total = len(exact_domains) + len(wildcard_patterns)
            print(f"Loaded {total} excluded domain patterns from {exclude_file}")

            if exact_domains:
                print(f"  Exact domains: {', '.join(sorted(list(exact_domains)[:5]))}")
                if len(exact_domains) > 5:
                    print(f"  ... and {len(exact_domains) - 5} more")

            if wildcard_patterns:
                patterns_display = [f'*{p}' for p in sorted(list(wildcard_patterns)[:5])]
                print(f"  Wildcard patterns: {', '.join(patterns_display)}")
                if len(wildcard_patterns) > 5:
                    print(f"  ... and {len(wildcard_patterns) - 5} more")

            return exact_domains, wildcard_patterns

        except FileNotFoundError:
            print(f"Warning: Excluded domains file not found: {exclude_file}")
            return set(), set()
        except Exception as e:
            print(f"Warning: Could not load excluded domains from {exclude_file}: {e}")
            return set(), set()

    def _load_cached_users(self):
        """
        Load cached sorted active users from file

        Returns:
            list: List of [username, user_data_dict] or None if cache doesn't exist
        """
        if not os.path.exists(self.user_cache_file):
            return None

        try:
            with open(self.user_cache_file, 'r') as f:
                cache_data = json.load(f)

            print(f"Loaded {len(cache_data)} users from cache file: {self.user_cache_file}")
            return cache_data
        except Exception as e:
            print(f"Warning: Could not load user cache from {self.user_cache_file}: {e}")
            return None

    def _save_cached_users(self, users):
        """
        Save sorted active users to cache file with the fields in use.

        Args:
            users: List of [username, user_data] tuples to cache
        """
        try:
            # Extract only the fields we need
            cache_data = []
            for username, user_data in users:
                cache_data.append([
                    username,
                    {
                        'email_addr': user_data.get('email_addr', ''),
                        'role': user_data.get('role', ''),
                        'last_login': user_data.get('last_login', ''),
                        'size': user_data.get('size', 0),
                    }
                ])

            with open(self.user_cache_file, 'w') as f:
                json.dump(cache_data, f, indent=2)

            print(f"Saved {len(cache_data)} active users to cache file: {self.user_cache_file}")
        except Exception as e:
            print(f"Warning: Could not save user cache to {self.user_cache_file}: {e}")

    def save_progress(self, username, email, status, error_message=None):
        """
        Save progress to SQLite database

        Args:
            username: User's username
            email: User's email address
            status: Status - 'sent', 'failed', 'skipped', or 'quarantined'
            error_message: Error/reason message (used for 'failed', 'skipped', and 'quarantined')
        """
        # Skip database writes in dry-run mode
        if self.dry_run:
            return

        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()

        try:
            cursor.execute('''
                INSERT OR REPLACE INTO email_progress
                (username, email, status, timestamp, error_message)
                VALUES (?, ?, ?, ?, ?)
            ''', (username, email, status, datetime.utcnow().isoformat(), error_message))

            conn.commit()

            # Update in-memory cache if sent successfully or quarantined
            if status in ('sent', 'quarantined'):
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

    def _filter_by_last_login(self, users):
        """
        Filter users by last_login date, supporting both Unix epoch and ISO timestamp formats

        Args:
            users: List of [username, user_data] tuples

        Returns:
            list: Filtered list of users who logged in after self.last_login_after
        """
        if not self.last_login_after:
            return users

        filtered = []
        skipped = 0

        # Parse the threshold date
        try:
            threshold_dt = datetime.fromisoformat(self.last_login_after)
        except ValueError:
            print(f"Error: Invalid date format for --last-login: {self.last_login_after}")
            print("Expected format: YYYY-MM-DD")
            return users

        for username, user_data in users:
            last_login = user_data.get('last_login', '')

            if not last_login:
                skipped += 1
                continue

            try:
                # Try to parse as Unix epoch (integer/float)
                if isinstance(last_login, (int, float)) or (isinstance(last_login, str) and last_login.isdigit()):
                    login_dt = datetime.fromtimestamp(float(last_login))
                else:
                    # Parse as ISO datetime string (handle format: '2018-02-01 16:33:10.873750')
                    login_dt = datetime.fromisoformat(str(last_login).split('.')[0])

                if login_dt > threshold_dt:
                    filtered.append([username, user_data])
                else:
                    skipped += 1
            except (ValueError, AttributeError, OSError) as e:
                # Skip users with invalid last_login format
                skipped += 1
                continue

        if skipped > 0:
            print(f"Filtered out {skipped} users with last_login <= {self.last_login_after} or invalid dates")

        return filtered

    def _filter_by_size(self, users):
        """
        Filter users by collection size

        Args:
            users: List of [username, user_data] tuples

        Returns:
            list: Filtered list of users with collection size >= self.min_size
        """
        if not self.min_size:
            return users

        filtered = []
        skipped = 0

        for username, user_data in users:
            try:
                size = int(user_data.get('size', 0))

                if size >= self.min_size:
                    filtered.append([username, user_data])
                else:
                    skipped += 1
            except (ValueError, TypeError):
                # Skip users with invalid size
                skipped += 1
                continue

        if skipped > 0:
            print(f"Filtered out {skipped} users with collection size < {self.min_size} bytes")

        return filtered

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
            self.stats['validation_stats']['no_email'] += 1
            self.save_progress(username, email or '', 'skipped', 'No email address')
            return False

        # Validate email syntax
        if not is_valid_email_syntax(email):
            print(f"Skipping {username}: Invalid email syntax ({email})")
            self.stats['emails_skipped'] += 1
            self.stats['validation_stats']['invalid_syntax'] += 1
            self.save_progress(username, email, 'skipped', 'Invalid email syntax')
            return False

        # Check SES suppression list (bounces/complaints) - uses pre-downloaded list
        suppressed, reason = is_email_suppressed(email, self.ses_suppression_list)
        if suppressed:
            print(f"Skipping {username}: Email suppressed by SES ({reason})")
            self.stats['emails_skipped'] += 1
            self.stats['validation_stats']['ses_suppressed'] += 1
            self.save_progress(username, email, 'skipped', f'SES suppressed: {reason}')
            return False

        # Check excluded domains (high bounce rate domains)
        excluded, excluded_domain = is_excluded_domain(email, self.excluded_domains, self.excluded_wildcards)
        if excluded:
            print(f"Skipping {username}: Excluded domain ({excluded_domain})")
            self.stats['emails_skipped'] += 1
            self.stats['validation_stats']['excluded_domain'] += 1
            self.save_progress(username, email, 'deferred', f'Excluded domain: {excluded_domain}')
            return False

        # Check for suspicious email patterns (spam/bot signups)
        suspicious, sus_reason = is_suspicious_email(email, username)
        if suspicious:
            print(f"Quarantined {username}: {sus_reason} ({email})")
            self.stats['emails_skipped'] += 1
            self.stats['validation_stats']['quarantined'] += 1
            self.save_progress(username, email, 'quarantined', sus_reason)
            return False

        # Check DNS/MX records - uses cached domain lookups
        if not has_valid_mx_record(email, self.mx_cache):
            print(f"Skipping {username}: Invalid domain (no MX records)")
            self.stats['emails_skipped'] += 1
            self.stats['validation_stats']['no_mx_records'] += 1
            self.save_progress(username, email, 'skipped', 'No MX records')
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
        Uses cached sorted active users for subsequent runs to improve performance.

        Returns:
            list: List of (username, user_data) tuples sorted alphabetically
        """
        # Try to load from cache first
        sorted_active = self._load_cached_users()

        # If cache doesn't exist, compute and save it
        if sorted_active is None:
            print("Computing active users list (first run)...")
            active_users = [[u,d] for u,d in self.user_manager.all_users.items() if int(d.get('size', 0)) > 0]
            # Sort users alphabetically for deterministic ordering
            sorted_active = sorted(active_users, key=lambda x: x[0])
            # Save to cache for future runs
            self._save_cached_users(sorted_active)

        # Apply filters to either cached or freshly computed users
        if self.last_login_after:
            print(f"Filtering users by last_login > {self.last_login_after}...")
            sorted_active = self._filter_by_last_login(sorted_active)

        if self.min_size:
            print(f"Filtering users by collection size >= {self.min_size} bytes...")
            sorted_active = self._filter_by_size(sorted_active)

        self.stats['total_users'] = len(sorted_active)

        # Filter out users already sent to
        users_to_process = []
        already_sent_count = 0

        for username, user_data in sorted_active:
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
            skipped = len(sorted_active) - len(users_to_process) - already_sent_count
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
                self.stats['validation_stats']['suspended'] += 1
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
        print(f"  Emails quarantined: {db_stats.get('quarantined', 0)}")

        # Show validation breakdown from this run
        if any(self.stats['validation_stats'].values()):
            print(f"\nValidation breakdown (this run):")
            for reason, count in self.stats['validation_stats'].items():
                if count > 0:
                    print(f"  {reason.replace('_', ' ').title()}: {count}")

        # Show validation cache stats
        if self.ses_suppression_list or self.mx_cache:
            print(f"\nValidation cache stats:")
            if self.ses_suppression_list:
                print(f"  SES suppression list: {len(self.ses_suppression_list)} addresses loaded")
            if self.mx_cache:
                valid_domains = sum(1 for v in self.mx_cache.values() if v)
                invalid_domains = sum(1 for v in self.mx_cache.values() if not v)
                print(f"  MX cache: {len(self.mx_cache)} domains checked ({valid_domains} valid, {invalid_domains} invalid)")

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

        if db_stats.get('quarantined', 0) > 0:
            print(f"\nQuarantined emails (suspicious patterns) can be queried from: {self.db_file}")
            print(f"  Example: sqlite3 {self.db_file} \"SELECT username, email, error_message FROM email_progress WHERE status='quarantined'\"")

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

    parser.add_argument(
        '--suppression-db',
        metavar='FILE',
        help='Path to SES suppression list database (generated by build_ses_suppression_db.py)'
    )

    parser.add_argument(
        '--last-login',
        metavar='DATE',
        help='Only send to users who logged in after this date (format: YYYY-MM-DD)'
    )

    parser.add_argument(
        '--min-size',
        type=int,
        metavar='BYTES',
        help='Only send to users with collection size >= this value in bytes'
    )

    parser.add_argument(
        '--exclude-domains',
        metavar='FILE',
        help='Path to file with domains to exclude (one per line, supports wildcards like *.edu)'
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
        max_total_send=args.max_total_send,
        suppression_db=args.suppression_db,
        last_login_after=args.last_login,
        min_size=args.min_size,
        exclude_domains_file=args.exclude_domains
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
