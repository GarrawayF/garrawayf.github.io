"""Public applicant catalog and server-protected staff catalog boundaries."""
import re
import hashlib
import base64
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
ROOT = Path(__file__).resolve().parents[2] / 'public/event-management-demo'
class Tags(HTMLParser):
    def __init__(self, text):
        super().__init__(); self.items = []; self.feed(text)
    def handle_starttag(self, tag, attrs):
        self.items.append((tag, dict(attrs)))
class EventCatalogTests(unittest.TestCase):
    def test_staff_catalog_metadata_and_inline_csp_stay_in_sync(self):
        html = (ROOT / 'concierge.html').read_text()
        self.assertIn('file.size !== 151467', html)
        self.assertNotIn('file.size !== 186788', html)
        self.assertIn('2026年10月13日更新', html)
        self.assertNotIn('保存〜管理反映の実操作は未確認', html)
        csp = next(attrs['content'] for tag, attrs in Tags(html).items
                   if tag == 'meta' and attrs.get('http-equiv') == 'Content-Security-Policy')
        scripts = re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>', html)
        self.assertTrue(scripts)
        for script in scripts:
            digest = base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()
            self.assertIn("'sha256-" + digest + "'", csp)
    def test_public_catalog_links_resolve_and_staff_catalog_is_only_login_stub(self):
        for role in ['applicant', 'concierge']:
            html = (ROOT / 'catalog' / (role+'.html')).read_text()
            self.assertIn('デモ版', html)
            for marker in ['docs.google.com', 'script.google.com', '2019garrawayf', 'GF_STAFF_AUTH', 'TEST_ONLY']:
                self.assertNotIn(marker, html)
            self.assertNotRegex(html, r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
            for tag, attrs in Tags(html).items:
                self.assertNotIn(tag, ['script','form','input','textarea'])
                for attr in ['href','src']:
                    target=attrs.get(attr)
                    if not target or target.startswith('#'): continue
                    url=urlparse(target)
                    if url.scheme:
                        self.assertEqual(url.scheme,'https');self.assertEqual(url.netloc,'garrawayf.github.io')
                    else:
                        local=(ROOT/'catalog'/url.path).resolve()
                        self.assertTrue(local.is_relative_to(ROOT.resolve()));self.assertTrue(local.exists(),target)
        staff=(ROOT/'catalog/concierge.html').read_text()
        self.assertIn('../concierge.html',staff)
        self.assertIn('ログインをサーバーで確認',staff)
        for marker in ['<img','<iframe','.pdf','staff-list','staff-autosave','運用の進捗を記録']:
            self.assertNotIn(marker,staff)
        app=(ROOT/'concierge.html').read_text()
        self.assertIn('id="staff-catalog-open"',app)
        self.assertIn('/api/github/staff/catalog',app)
        self.assertIn('frame-src blob:',app)
        self.assertIn('URL.revokeObjectURL',app)
        self.assertNotIn('./catalog/concierge.html',app)
    def test_only_applicant_catalog_pdf_and_no_staff_catalog_assets_are_public(self):
        pdfs=list((ROOT/'catalog').rglob('*.pdf'))
        self.assertEqual([p.name for p in pdfs],['applicant-guide-20261012.pdf'])
        self.assertFalse(list((ROOT/'catalog/assets').glob('staff-*.png')))
        for p in ROOT.rglob('*'):
            if p.is_file() and p.suffix in ['.js','.html','.json','.css']:
                text=p.read_text()
                for private_hash in ('2b30a2c4b8e34161b368e32ceed3f7d415b454fc16d604053da3336531a1940b', '6d1ac6ed23d7ea74a5cbeed5d08ff51d9c540192b1ab2e8759af0a862b1aa466'):
                    self.assertNotIn(private_hash,text)
if __name__=='__main__': unittest.main()
