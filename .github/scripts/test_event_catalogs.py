"""Public catalogue safety and navigation checks."""
import re
import struct
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2] / 'public/event-management-demo'

class Tags(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.items = []
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        self.items.append((tag, dict(attrs)))

class EventCatalogTests(unittest.TestCase):
    def test_catalogues_are_static_and_links_resolve(self):
        for role, entry in [('applicant', 'index.html'), ('concierge', 'concierge.html')]:
            html = (ROOT / 'catalog' / (role + '.html')).read_text()
            self.assertIn('デモ版', html)
            for label in ['事前申し込み', '詳細すり合わせ', '承認', '開催準備', '当日', '結果報告']:
                self.assertIn(label, html)
            self.assertIn('架空', html)
            for marker in ['docs.google.com', 'script.google.com', '2019garrawayf', 'GF_STAFF_AUTH', 'TEST_ONLY']:
                self.assertNotIn(marker, html)
            self.assertNotRegex(html, r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
            for tag, attrs in Tags(html).items:
                self.assertNotIn(tag, ['script', 'form', 'input', 'textarea', 'iframe'])
                for attr in ['href', 'src']:
                    if attr not in attrs:
                        continue
                    target = attrs[attr]
                    if target.startswith('https://'):
                        url = urlparse(target)
                        self.assertEqual(url.netloc, 'garrawayf.github.io')
                        self.assertTrue(url.path.startswith('/event-management-demo/'))
                        self.assertFalse(url.query)
                    else:
                        self.assertNotIn(':', target)
                        local = (ROOT / 'catalog' / target).resolve()
                        self.assertTrue(local.is_relative_to(ROOT.resolve()))
                        self.assertTrue(local.exists(), target)
            entry_html = (ROOT / entry).read_text()
            self.assertIn('./catalog/' + role + '.html', entry_html)
            return_path = '../' if role == 'applicant' else '../concierge.html'
            self.assertIn('href="' + return_path + '"', html)
        concierge = (ROOT / 'catalog/concierge.html').read_text()
        self.assertIn('女将', concierge)
        self.assertIn('共有ログイン後の編集保存は、実機確認中', concierge)
        self.assertIn('まだ実測していません', concierge)
        css = (ROOT / 'catalog/catalog.css').read_text()
        self.assertNotRegex(css, r'https?://|@import|url\(')

    def test_five_images_have_no_embedded_text_metadata(self):
        images = sorted((ROOT / 'catalog/assets').glob('*.png'))
        self.assertEqual(len(images), 5)
        for path in images:
            data = path.read_bytes()
            self.assertEqual(data[:8], b'\x89PNG\r\n\x1a\n')
            offset = 8
            while offset < len(data):
                size = struct.unpack('>I', data[offset:offset + 4])[0]
                kind = data[offset + 4:offset + 8]
                self.assertNotIn(kind, [b'tEXt', b'zTXt', b'iTXt', b'eXIf'])
                offset += size + 12
            self.assertEqual(offset, len(data))

if __name__ == '__main__':
    unittest.main()
