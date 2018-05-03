from .testutils import BaseWRTests
from mock import patch
import os


# ============================================================================
class TestBugReport(BaseWRTests):
    UA_1 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.139 Safari/537.36'

    @classmethod
    def setup_class(cls):
        os.environ['GH_ISSUE_AUTH'] = 'foo:bar'
        os.environ['GH_ISSUE_REPO'] = 'example/test'

        import webrecorder.gh_reporter
        webrecorder.gh_reporter.GitHubAPI = GitHubAPIOverride

        super(TestBugReport, cls).setup_class()

    def test_bug_report(self):
        params = {
                  'url': 'http://example.com/',
                  'desc': 'Test Desc',
                  'leak': True,
                  'email': 'test@example.com'
                 }

        headers = {'User-Agent': self.UA_1}

        def add_bug_report(self, report):
            assert report['user_email'] == ''
            assert report['leak'] == True
            assert report['desc'] == 'Test Desc'
            assert report['email'] == 'test@example.com'

        res = self.testapp.post_json('/api/v1/report/dnlr', params=params, headers=headers)


# ============================================================================
class GitHubAPIOverride(object):
    def  __init__(self, *args, **kwargs):
        pass

    def add_issue(self, issue):
        assert issue['title'] == 'http://example.com/'
        assert issue['labels']

    def get_label(self, label):
        pass

    def add_label(self, label, color):
        assert label in {'macos', 'chrome', 'chrome-66', 'has-email', 'has-additional-info', 'leak'}


