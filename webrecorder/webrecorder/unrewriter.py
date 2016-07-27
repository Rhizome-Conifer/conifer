import re
import sys
import html

from pywb.rewrite.html_rewriter import HTMLRewriter


# ============================================================================
WBURL_MATCH = '(?:[0-9]{0,14}(?:\w+_)?)?/(.*)'

PREFIX_MATCH = '({0})?({1})'

HOST_WBURL_RX = r'(?<=["\'(=>\s])(?:https?\:)?//{0}[^\s\'"]+/((?:https?|//)[^\'"\s]+)(?=["\'\s])'


# ============================================================================
class UnRewriter(object):
    def __init__(self, host, prefix):
        self.rewrite_opts = {}

        if prefix.startswith(host):
            prefix = prefix[len(host):]

        prefix_str = PREFIX_MATCH.format(re.escape(host), re.escape(prefix))

        self.rx_extract = re.compile(prefix_str + WBURL_MATCH)

    def rewrite(self, url, mod=None):
        m = self.rx_extract.match(url)
        if m:
            return m.group(3)

        return url

    def rebase_rewriter(self, new_url):
        return self


# ============================================================================
class HTMLDomUnRewriter(HTMLRewriter):
    def __init__(self, urlrewriter, host, prefix):
        super(HTMLDomUnRewriter, self).__init__(urlrewriter)
        self.orig_host = host
        self.orig_prefix = prefix

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

        if tag in ('iframe', 'frame'):
            self.unrewrite_iframe(self.out, tag, tag_attrs)
            return

        return super(HTMLDomUnRewriter, self)._rewrite_tag_attrs(tag, tag_attrs)

    def unrewrite_iframe(self, out, tag, tag_attrs):
        out.write('<' + tag)

        for attr_name, attr_value in tag_attrs:
            empty_attr = False
            if attr_value is None:
                attr_value = ''
                empty_attr = True

            elif attr_name == 'data-src-doc':
                attr_name = 'srcdoc'
                attr_value = html.unescape(attr_value)
                attr_value = self.unrewrite_html(self.orig_host,
                                                 self.orig_prefix,
                                                 attr_value)

            elif attr_name == 'data-src-target':
                attr_name = 'src'

            elif attr_name == 'src':
                if attr_value != 'about:blank':
                    continue

            # write the attr!
            self._write_attr(attr_name, attr_value, empty_attr)

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
        unrewriter = UnRewriter(host, prefix)
        html_unrewriter = HTMLDomUnRewriter(unrewriter, host, prefix)

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
        res = HTMLDomUnRewriter.unrewrite_html(prefix, full)
        print(res)

if __name__ == "__main__":
    main()
