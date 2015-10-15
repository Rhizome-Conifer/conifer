import re
import sys
from pywb.rewrite.html_rewriter import HTMLRewriter


# ============================================================================
WBURL_MATCH = '(?:[0-9]{0,14}(?:\w+_)?)?/(.*)'

HOST_WBURL_RX = r'(?<=["\'(=>\s])(?:https?\:)?//{0}[^\s\'"]+/((?:https?|//)[^\'"\s]+)(?=["\'\s])'


# ============================================================================
class UnRewriter(object):
    def __init__(self, prefix):
        self.prefix = prefix
        self.rewrite_opts = {}

        self.rx_extract = re.compile(re.escape(prefix) + WBURL_MATCH)

    def rewrite(self, url, mod=None):
        if not url.startswith(self.prefix):
            return url

        m = self.rx_extract.match(url)
        if m:
            return m.group(1)

        return url

    def rebase_rewriter(self, new_url):
        return self


# ============================================================================
class HTMLDomUnRewriter(HTMLRewriter):
    def _rewrite_script(self, script_content):
        return ''

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            self._rewrite_tag_attrs(tag, [])
        else:
            super(HTMLDomUnRewriter, self).handle_starttag(tag, attrs)

    def handle_startendtag(self, tag, attrs):
        if tag == 'script':
            self._rewrite_tag_attrs(tag, [])
        else:
            super(HTMLDomUnRewriter, self).handle_startendtag(tag, attrs)

    def handle_endtag(self, tag):
        if tag == 'script':
            if (tag == self._wb_parse_context):
                self._wb_parse_context = None
        else:
            super(HTMLDomUnRewriter, self).handle_endtag(tag)

    def _rewrite_tag_attrs(self, tag, tag_attrs):
        if tag == 'script':
            if not self._wb_parse_context:
                self._wb_parse_context = tag
            return

        return super(HTMLDomUnRewriter, self)._rewrite_tag_attrs(tag, tag_attrs)

    @staticmethod
    def remove_head_insert(html_text):
        start_marker = '<!-- WB Insert -->'
        end_marker = '<!-- End WB Insert -->'

        start = html_text.find(start_marker)
        if start < 0:
            return html_text

        end = html_text.find(end_marker)
        if end < start:
            return html_text

        return html_text[:start] + html_text[end + len(end_marker):]

    @staticmethod
    def unrewrite_html(host, prefix, html_text):
        unrewriter = UnRewriter(prefix)
        html_unrewriter = HTMLDomUnRewriter(unrewriter)

        html_text = HTMLDomUnRewriter.remove_head_insert(html_text)

        buff = html_unrewriter.rewrite(html_text)
        buff += html_unrewriter.close()

        host = host.split('//')[-1]

        host_rx = HOST_WBURL_RX.format(re.escape(host))
        host_rx = re.compile(host_rx)

        new_buff = host_rx.sub(r'\1', buff)
        return new_buff


# ============================================================================
def main():
    with open(sys.argv[1], 'r') as fh:
        full = fh.read()
        prefix = 'http://localhost:8088/'
        #prefix = 'http://webrecorder.io/'
        res = HTMLDomUnRewriter.unrewrite_html(prefix, full)
        print(res)

if __name__ == "__main__":
    main()
