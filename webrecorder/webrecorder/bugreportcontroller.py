from webrecorder.basecontroller import BaseController
from webrecorder.gh_reporter import GitHubIssueImporter
from werkzeug.useragents import UserAgent
from bottle import request

from datetime import datetime
import os
import json


# ============================================================================
class BugReportController(BaseController):
    def __init__(self, app, jinja_env, manager, config):
        super(BugReportController, self).__init__(app, jinja_env, manager, config)

        self.redis_issue_handler = RedisIssueHandler(manager.redis,
                                                     manager.cork,
                                                     self.get_email_view())

        # if GitHub settings provided, use the GitHub Issue Importer
        gh_auth = os.environ.get('GH_ISSUE_AUTH')
        gh_repo = os.environ.get('GH_ISSUE_REPO')

        if gh_auth and gh_repo:
            owner, repo = gh_repo.split('/')
            username, token_or_pass = gh_auth.split(':')
            self.issue_handler = GitHubIssueImporter(username,
                                                     token_or_pass,
                                                     owner, repo)
        else:
            self.issue_handler = self.redis_issue_handler

    def init_routes(self):
        @self.app.post('/_reportissues')
        def report_issues():
            useragent = request.headers.get('User-Agent')
            self.do_report(request.POST, useragent)
            return {}

    def do_report(self, params, ua=''):
        report = {}
        for key in params.iterkeys():
            report[key] = params.getunicode(key)

        now = str(datetime.utcnow())

        user = self.manager.get_curr_user()
        report['user'] = user
        report['time'] = now
        report['ua'] = ua
        report['user_email'] = self.manager.get_user_email(user)
        if not report.get('email'):
            report['email'] = report['user_email']

        res = self.issue_handler.add_bug_report(report)

        # fallback on redis handler if GH handler failed
        if not res and self.issue_handler != self.redis_issue_handler:
            self.redis_issue_handler.add_bug_report(report)

    def get_email_view(self):
        @self.jinja2_view('email_error.html')
        def error_email(params):
            ua = UserAgent(params.get('ua'))
            if ua.browser:
                browser = '{0} {1} {2} {3}'
                lang = ua.language or ''
                browser = browser.format(ua.platform, ua.browser,
                                         ua.version, lang)

                params['browser'] = browser
            else:
                params['browser'] = ua.string

            params['time'] = params['time'][:19]
            return params

        return error_email

# ============================================================================
class RedisIssueHandler(object):
    def __init__(self, redis, cork, email_view):
        self.redis = redis
        self.cork = cork
        self.reports_email = os.environ.get('SUPPORT_EMAIL')
        self.email_view = email_view

    def add_bug_report(self, report):
        report = json.dumps(report)
        self.redis.rpush('h:reports', report)

        if self.reports_email:
            subject = "[Doesn't Look Right] Error Report - {0}".format(now)
            email_text = self.email_view(report)
            self.cork.mailer.send_email(self.reports_email, subject, email_text)

        return True
