import json
import requests
import os
from werkzeug.useragents import UserAgent



template = """
Test in New Recording: **[{actual_url}]({record_url})**

User Reported Url: **[{url}]({url})**

State: **{state}**

Time: **{time}**

Browser: **{ua_platform} {ua_browser} {ua_version}**

Contact Email: {email}

Additional Info:
{desc}


Specific Issues:

"""


# ============================================================================
class GitHubAPI(object):
    ISSUES = 'https://api.github.com/repos/{0}/{1}/issues'
    LABELS = 'https://api.github.com/repos/{0}/{1}/labels/{2}'
    ADD_LABEL = 'https://api.github.com/repos/{0}/{1}/labels'

    def __init__(self, username, password, owner, repo):
        # Create an authenticated session to create the issue
        self.session = requests.session()
        self.session.auth = (username, password)

        self.repo = repo
        self.owner = owner

        self.issues_url = self.ISSUES.format(owner, repo)

    def add_issue(self, issue):
        r = self.session.post(self.issues_url, json.dumps(issue))
        if r.status_code == 201:
            return True
        else:
            print(r.content)
            return False

    def get_label(self, label):
        url = self.LABELS.format(self.owner, self.repo, label)
        r = self.session.get(url)
        if r.status_code == 200:
            return r.json()
        else:
            return None

    def add_label(self, label, color):
        url = self.ADD_LABEL.format(self.owner, self.repo)
        r = self.session.post(url, json.dumps(dict(name=label, color=color)))
        if r.status_code == 201:
            return True
        else:
            print('Error Adding Label: ' + label)
            print(r.content)
            return False


# ============================================================================
class GitHubIssueImporter(object):
    PROP_COLOR = 'fbca04'
    DEF_COLOR = '0052cc'
    PROP_LABELS = {'loading': 'Page Not Loading',
                   'missing': 'Missing content (Images, Video)',
                   'video': 'Video/Audio not playing',
                   'embed': 'Embedded content issues',
                   'scrolling': 'Scrolling issues',
                   'leak': 'Live Web leak'
                  }

    def __init__(self, username, token_or_pass, owner, repo):
        self.gh = GitHubAPI(username, token_or_pass, owner, repo)
        self.label_cache = set()

        #self.new_recording_prefix = os.environ.get('APP_HOST')
        self.new_recording_prefix = ''

        if not self.new_recording_prefix:
            self.new_recording_prefix = 'https://webrecorder.io/'
        self.new_recording_prefix += '$record/bug-reports/report/'

    def add_bug_report(self, report):
        issue = self.format_issue(report)

        for label in issue['labels']:
            if label in self.label_cache:
                continue

            if not self.gh.get_label(label):
                print('Adding label: ' + label)
                color = self.PROP_COLOR if label in self.PROP_LABELS.keys() else self.DEF_COLOR
                if not self.gh.add_label(label, color):
                    continue

            self.label_cache.add(label)

        return self.gh.add_issue(issue)

    def format_issue(self, report):
        url = report.get('url')
        if url:
            index = url.find('/http')
            if index < 0:
                index = url.find('///')

            if index < 0 and report.get('state'):
                index = url.find(report['state'] + '/')
                if index > 0:
                    index += len(report['state'])

            if index >= 0:
                report['actual_url'] = url[index + 1:]
            else:
                report['actual_url'] = url
        else:
            report['url'] = report['actual_url'] = report['record_url'] = '-'

        report['record_url'] = self.new_recording_prefix + report['actual_url']

        report['time'] = report['time'][:19]

        labels = []

        self.parse_browser(report)

        platform = report.get('ua_platform')
        if platform and platform != '-':
            labels.append(platform)

        browser = report.get('ua_browser')
        if browser and browser != '-':
            labels.append(browser)

            version = report.get('ua_version')
            if version and version != '-':
                labels.append(browser + '-' + version.split('.')[0])

        email = report.get('email')
        if email:
            report['email'] = '**[{0}](mailto:{0})**'.format(email)
            labels.append('has-email')
        else:
            report['email'] = ''

        if not report.get('state'):
            report['state'] = '-'

        if report.get('desc'):
            labels.append('has-additional-info')

        body = template.format(**report)

        for prop in self.PROP_LABELS.keys():
            if report.get(prop):
                body += '- {0}\n'.format(self.PROP_LABELS[prop])
                labels.append(prop)

        issue = {'body': body,
                 'title': report['actual_url'][:255],
                 'labels': labels}

        return issue

    def parse_browser(self, params):
        ua = UserAgent(params.get('ua'))
        if ua.browser:
            params['ua_platform'] = ua.platform
            params['ua_browser'] = ua.browser
            params['ua_version'] = ua.version
        else:
            params['ua_platform'] = '-'
            params['ua_browser'] = params.get('ua', '-')
            params['ua_version'] = '-'
