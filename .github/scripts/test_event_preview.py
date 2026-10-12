"""Public-only regression checks for the isolated staff UI preview."""
import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.tags = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class PublicEventPreviewTests(unittest.TestCase):
    def setUp(self):
        self.text = (ROOT / 'public/event-management-demo/staff.html').read_text()
        self.page = Page(self.text)

    def test_only_fictional_records(self):
        match = re.search(r'<script type="application/json" id="data">(.*?)</script>', self.text, re.S)
        self.assertIsNotNone(match)
        data = json.loads(match[1])
        self.assertIs(data['isFictional'], True)
        self.assertEqual(len(data['events']), 6)
        for event in data['events']:
            self.assertRegex(event['id'], r'^sample-event-[1-6]$')
            self.assertIn('サンプル', event['title'])
            self.assertIn('サンプル', event['organizer'])
            self.assertIn('サンプル', event['concierge'])
            self.assertNotIn('sourceUrl', event)
            self.assertNotIn('sourceRow', event)
            self.assertEqual(len(event['steps']), event['counts']['total'])

    def test_no_remote_requests_or_sensitive_identifiers(self):
        self.assertNotRegex(self.text, r'https?://')
        self.assertNotRegex(self.text, r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
        for forbidden in ('docs.google.com', 'script.google.com', 'gmail.com', 'sheet-live-',
                          'fetch(', 'XMLHttpRequest', 'sendBeacon', 'localStorage', 'sessionStorage'):
            self.assertNotIn(forbidden, self.text)
        for tag, attrs in self.page.tags:
            self.assertNotIn(tag, ('form', 'input', 'textarea', 'iframe'))
            if tag == 'script':
                self.assertNotIn('src', attrs)
        csp = next(a['content'] for t, a in self.page.tags if a.get('http-equiv') == 'Content-Security-Policy')
        self.assertIn("connect-src 'none'", csp)
        self.assertIn("form-action 'none'", csp)

    def test_demo_boundary_is_prominent(self):
        self.assertIn('<title>デモ版', self.text)
        for filename in ('application.html',):
            html = (ROOT / 'public/event-management-demo' / filename).read_text()
            notice = re.search(r'<div class="demo-notice">(.*?)</div>', html, re.S)[1]
            self.assertIn('<b>デモ版</b>', notice)
            self.assertIn('入力内容は送信されません', notice)
            self.assertIn('Googleスプレッドシートには保存されません', notice)
            self.assertIn('デモ版：入力内容は送信されません', html)
        script = (ROOT / 'public/event-management-demo/application.js').read_text()
        self.assertIn('event.preventDefault()', script)
        for forbidden in ('fetch(', 'XMLHttpRequest', 'sendBeacon', 'localStorage'):
            self.assertNotIn(forbidden, script)

    def test_six_workflow_names_and_stable_mapping(self):
        names = ['事前申し込み', '詳細すり合わせ', '承認', '開催準備', '当日', '結果報告']
        for filename in ('index.html', 'application.html'):
            html = (ROOT / 'public/event-management-demo' / filename).read_text()
            steps = re.search(r'<ol class="steps">(.*?)</ol>', html, re.S)[1]
            self.assertEqual(re.findall(r'<span>(.*?)</span>', steps), names)
            self.assertEqual(re.findall(r'<b>(.*?)</b>', steps), ['01', '02', '03', '04', '05', '06'])
            if filename == 'application.html':
                self.assertIn('現行事前審査フォームの確認事項', html)
        groups = json.loads(re.search(r'  var groups = (.*);', self.text)[1])
        self.assertEqual([g[0] for g in groups], names)
        self.assertEqual([g[1] for g in groups], [['E'], ['G', 'H', 'J', 'K', 'L', 'M'], [], ['P', 'Q', 'S', 'T', 'U', 'V', 'W', 'X'], [], ['AA']])
        self.assertIn('審査フォーム回答', self.text)

    def test_applicant_entry_preserves_current_verified_destination(self):
        # Applicant transport migration is released separately after GAS review.
        from urllib.parse import urlparse, parse_qs
        html = (ROOT / 'public/event-management-demo/index.html').read_text()
        entries = [a for t, a in Page(html).tags if t == 'a' and 'data-entry' in a]
        self.assertEqual(len(entries), 1)
        url = urlparse(entries[0]['href'])
        self.assertEqual(url.netloc, 'script.google.com')
        self.assertEqual(parse_qs(url.query), {'access': ['apply']})
        self.assertIn('デモ版', html)

    def test_github_management_hosts_actual_secure_ui(self):
        import base64
        import hashlib
        html = (ROOT / 'public/event-management-demo/concierge.html').read_text()
        tags = Page(html).tags
        self.assertIn('デモ版', html)
        self.assertIn('staff-login-form', html)
        self.assertIn('staff-app-body', html)
        self.assertIn('./catalog/concierge.html', html)
        self.assertIn('credentials: \'omit\'', html)
        self.assertIn('/api/github/staff/', html)
        self.assertIn('request: { action: \'bootstrap\' }', html)
        for marker in ['script.google.com', 'google.script', 'localStorage', 'sessionStorage', 'nonce=', '__CSP_NONCE__', 'docs.google.com', 'GF_events']:
            self.assertNotIn(marker, html)
        self.assertNotRegex(html, r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
        self.assertFalse(any(t in ['iframe', 'base'] for t, _ in tags))
        csp = next(a['content'] for t,a in tags if a.get('http-equiv') == 'Content-Security-Policy')
        self.assertNotIn("script-src 'unsafe-inline'", csp)
        self.assertIn("default-src 'none'", csp)
        self.assertIn("form-action 'none'", csp)
        for script in re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>', html):
            digest = base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()
            self.assertIn("'sha256-"+digest+"'", csp)
        config = re.search(r'<script[^>]*id="config"[^>]*>(.*?)</script>',html,re.S)[1]
        self.assertEqual(json.loads(config), {'mode':'shared-login'})

    def test_homepage_entry_and_separate_application_remain(self):
        homepage = (ROOT / 'app/page.tsx').read_text()
        self.assertIn('/event-management-demo/concierge.html', homepage)
        self.assertIn('イベントを申し込む／デモ版', homepage)
        self.assertNotIn('/event-management-demo/staff.html', homepage)
        self.assertNotIn('/event-management-demo/application.html', homepage)
        for name in ('index.html', 'application.html', 'application.js', 'styles.css', 'mobile-v32.html'):
            self.assertTrue((ROOT / 'public/event-management-demo' / name).is_file())


if __name__ == '__main__':
    unittest.main()

