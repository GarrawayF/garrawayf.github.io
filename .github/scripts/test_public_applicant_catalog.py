"""Read-only checks for the public applicant PDF catalogue and its entry point."""
import hashlib
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2] / 'public' / 'event-management-demo'
CATALOG = ROOT / 'catalog'
PDF_NAME = 'applicant-guide-20261012.pdf'
EXPECTED_SIZE = 421995
EXPECTED_SHA256 = '3a3aa81c5cc8bc45c53c6915f36d3a9560d26b48938661cb1ef8abba84939f59'


class Tags(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.items = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.items.append((tag, dict(attrs)))


class PublicApplicantCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (CATALOG / 'applicant.html').read_text(encoding='utf-8')
        cls.tags = Tags(cls.html).items
        cls.css = (CATALOG / 'applicant-guide.css').read_text(encoding='utf-8')

    def test_pdf_is_exact_delivered_six_page_file(self):
        pdf = (CATALOG / PDF_NAME).read_bytes()
        self.assertEqual(len(pdf), EXPECTED_SIZE)
        self.assertEqual(hashlib.sha256(pdf).hexdigest(), EXPECTED_SHA256)
        self.assertTrue(pdf.startswith(b'%PDF-'))
        self.assertEqual(len(re.findall(rb'/Type\s*/Page\b', pdf)), 6)

    def test_read_and_download_use_the_same_local_pdf(self):
        links = [attrs for tag, attrs in self.tags if tag == 'a' and attrs.get('href') == PDF_NAME]
        self.assertGreaterEqual(len(links), 2)
        readers = [attrs for attrs in links if attrs.get('target') == '_blank']
        downloads = [attrs for attrs in links if 'download' in attrs]
        self.assertTrue(readers)
        self.assertEqual(len(downloads), 1)
        for attrs in readers:
            self.assertIn('noopener', attrs.get('rel', '').split())
            self.assertIn('noreferrer', attrs.get('rel', '').split())
        self.assertEqual(downloads[0]['download'], 'GarrawayF_ユーザー用カタログ_20261012.pdf')
        self.assertIn('新しいタブ', self.html)
        self.assertIn('PDF / 全6ページ', self.html)

    def test_all_resources_and_navigation_resolve_locally(self):
        ids = {attrs['id'] for _, attrs in self.tags if 'id' in attrs}
        for tag, attrs in self.tags:
            for attribute in ('src', 'href'):
                if attribute not in attrs:
                    continue
                value = urlsplit(attrs[attribute])
                self.assertFalse(value.scheme)
                self.assertFalse(value.netloc)
                self.assertFalse(value.query)
                if value.path:
                    target = (CATALOG / unquote(value.path)).resolve()
                    self.assertTrue(target.is_relative_to(ROOT.resolve()))
                    self.assertTrue(target.exists(), attrs[attribute])
                else:
                    self.assertIn(unquote(value.fragment), ids)
        self.assertIn('href="../"', self.html)
        self.assertIn('href="../resume.html"', self.html)
        for filename in ('index.html', 'resume.html'):
            self.assertIn('./catalog/applicant.html', (ROOT / filename).read_text(encoding='utf-8'))

    def test_public_page_is_read_only_and_does_not_link_staff_material(self):
        for tag, attrs in self.tags:
            self.assertNotIn(tag, ('script', 'form', 'input', 'textarea', 'iframe', 'object', 'embed'))
            self.assertFalse(any(name.lower().startswith('on') for name in attrs))
            self.assertNotIn('style', attrs)
        for marker in ('concierge', 'staff.html', 'GF_STAFF_AUTH', 'docs.google.com', 'script.google.com'):
            self.assertNotIn(marker, self.html)
        self.assertNotRegex(self.html, r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
        csp = next(attrs['content'] for tag, attrs in self.tags if tag == 'meta' and attrs.get('http-equiv') == 'Content-Security-Policy')
        for directive in ("default-src 'none'", "connect-src 'none'", "form-action 'none'", "object-src 'none'"):
            self.assertIn(directive, csp)
        self.assertNotRegex(self.css, r'https?://|@import|url\(')

    def test_demo_scope_and_unverified_e2e_are_visible(self):
        for text in ('デモ版', '架空', '正式な開催承認・承認通知メールは実装していません', '保存〜管理反映の実操作は未確認', 'E2E未確認', '2026年10月12日版'):
            self.assertIn(text, self.html)
        self.assertNotIn('実機で確認済み', self.html)
        for stage in ('事前申し込み', '詳細すり合わせ', '承認', '開催準備', '当日', '結果報告'):
            self.assertIn(stage, self.html)
        self.assertEqual(len([1 for tag, attrs in self.tags if tag == 'span' and attrs.get('class') == 'page-number']), 6)

    def test_accessible_and_responsive_document_structure(self):
        self.assertIn(('html', {'lang': 'ja'}), self.tags)
        self.assertEqual(len([1 for tag, _ in self.tags if tag == 'h1']), 1)
        self.assertEqual(len([1 for tag, _ in self.tags if tag == 'main']), 1)
        self.assertTrue(any(tag == 'meta' and attrs.get('name') == 'viewport' and 'width=device-width' in attrs.get('content', '') for tag, attrs in self.tags))
        self.assertIn('href="#main"', self.html)
        for tag, attrs in self.tags:
            if tag == 'img':
                self.assertTrue(attrs.get('alt'))
                self.assertTrue(attrs.get('width'))
                self.assertTrue(attrs.get('height'))
        self.assertIn('@media (max-width: 760px)', self.css)
        self.assertIn(':focus-visible', self.css)
        self.assertIn('min-height: 52px', self.css)

    def test_no_optional_image_reference_is_required(self):
        self.assertNotIn('applicant-cover-20261012.png', self.html)
        self.assertFalse(any(tag == 'img' for tag, _ in self.tags))
        self.assertIn('6 PAGES', self.html)


if __name__ == '__main__':
    unittest.main()
