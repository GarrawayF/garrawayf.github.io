"""Keep the access link and embedded map pinned to the verified Tenjin CLASS building."""
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
# Building used by https://garrawayf.com/ and verified in Google Maps on 2026-10-13.
PLACE_ID = 'ChIJhQIoVISRQTURPcTyX-bnkeE'
FEATURE_ID = '0x3541918454280285:0xe191e7e65ff2c43d'


class Tags(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.items = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.items.append((tag, dict(attrs)))


class AccessMapTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.page = (ROOT / 'app/page.tsx').read_text(encoding='utf-8')
        cls.tags = Tags(cls.page).items

    def test_map_button_pins_the_verified_building(self):
        links = [a for tag, a in self.tags if tag == 'a' and 'google.com/maps' in a.get('href', '')]
        self.assertEqual(len(links), 1)
        url = urlsplit(links[0]['href'])
        self.assertEqual((url.scheme, url.netloc, url.path), ('https', 'www.google.com', '/maps/search/'))
        query = parse_qs(url.query)
        self.assertEqual(query['api'], ['1'])
        self.assertEqual(query['query_place_id'], [PLACE_ID])
        self.assertEqual(query['query'], ['西鉄天神クラス'])
        self.assertEqual(links[0]['target'], '_blank')
        self.assertIn('noreferrer', links[0]['rel'].split())

    def test_embedded_map_uses_the_same_official_building(self):
        maps = [a for tag, a in self.tags if tag == 'iframe' and 'google.com/maps' in a.get('src', '')]
        self.assertEqual(len(maps), 1)
        url = urlsplit(maps[0]['src'])
        self.assertEqual((url.scheme, url.netloc, url.path), ('https', 'www.google.com', '/maps/embed'))
        self.assertIn('!1s' + FEATURE_ID + '!', unquote(parse_qs(url.query)['pb'][0]))
        self.assertEqual(maps[0]['title'], '天神CLASS（Garraway F 3階）Google Map')

    def test_address_and_latitude_match_tenjin_class(self):
        self.assertIn('〒810-0021', self.page)
        self.assertIn('福岡市中央区今泉1丁目19番22号', self.page)
        self.assertIn('天神CLASS 3階', self.page)
        self.assertIn('FUKUOKA / 33.586°N', self.page)
        self.assertNotIn('FUKUOKA / 33.587°N', self.page)


if __name__ == '__main__':
    unittest.main()
