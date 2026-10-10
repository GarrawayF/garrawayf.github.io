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

    def test_homepage_entry_and_separate_application_remain(self):
        self.assertIn('/event-management-demo/staff.html', (ROOT / 'app/page.tsx').read_text())
        for name in ('index.html', 'application.html', 'application.js', 'styles.css', 'mobile-v32.html'):
            self.assertTrue((ROOT / 'public/event-management-demo' / name).is_file())


if __name__ == '__main__':
    unittest.main()
