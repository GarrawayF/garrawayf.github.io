from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import tempfile
import unittest

from prepare_instagram import encode, iso, prepare, sha256


class InstagramPublicationTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        for name in ("source/data", "source/images/instagram", "site/public", "site/content"):
            (self.root / name).mkdir(parents=True)
        self.source = self.root / "source"
        self.site = self.root / "site"
        self.target = self.site / "public/instagram-feed"
        self.now = datetime(2026, 11, 15, 9, tzinfo=timezone.utc)
        self.success = self.now - timedelta(hours=1)
        self.latest = self.success - timedelta(days=2)
        self.post_id = "123456"
        image = b"\xff\xd8\xff" + b"fixture" * 20 + b"\xff\xd9"
        self.image_path = f"images/instagram/{self.post_id}.jpg"
        (self.source / self.image_path).write_bytes(image)
        self.feed = {"account": "garrawayf_lounge", "updated_at": iso(self.success), "posts": [{
            "id": self.post_id, "caption": "本文のテスト & <img>",
            "permalink": "https://www.instagram.com/p/test/",
            "media_type": "IMAGE", "is_story": False, "image": self.image_path,
            "image_version": sha256(image)[:12], "timestamp": iso(self.latest),
        }]}
        self.status = {
            "state": "success", "checked_at": iso(self.success),
            "last_fetch_succeeded_at": iso(self.success), "content_updated_at": iso(self.success),
            "publication": {"schema_version": 1, "latest_post_at": iso(self.latest)},
            "error": {"private_diagnostic": "fixture"},
        }
        (self.site / "content/instagram-hidden-posts.json").write_text("[]")

    def export(self, *, now=None, sign=True):
        raw = encode(self.feed)
        if sign and self.status.get("publication"):
            self.status["publication"]["feed_sha256"] = sha256(raw)
        (self.source / "data/instagram.json").write_bytes(raw)
        (self.source / "data/instagram-sync-status.json").write_bytes(encode(self.status))
        return prepare(self.site, self.source, "a" * 40, "b" * 40, now or self.now)

    def test_only_validated_snapshot_stream_is_public(self):
        status = self.export()
        self.assertEqual(status["state"], "fresh")
        self.assertNotIn("error", status)
        self.assertNotEqual(status["latest_post_at"], status["last_fetch_succeeded_at"])
        raw_feed = (self.target / "feed.json").read_bytes()
        self.assertEqual(status["feed_sha256"], sha256(raw_feed))
        post = json.loads(raw_feed)["posts"][0]
        self.assertEqual(post["date_label"], "2026.11.13")
        self.assertEqual(post["caption"], self.feed["posts"][0]["caption"])
        self.assertEqual(post["image_sha256"], sha256((self.target / Path(post["image"]).name).read_bytes()))

    def test_legacy_snapshot_is_not_proof_of_real_restoration(self):
        self.status.pop("publication")
        status = self.export()
        self.assertEqual(status["source_state"], "not_verified")
        self.assertFalse((self.target / "feed.json").exists())

    def test_auth_failure_keeps_valid_snapshot_and_flags_its_age(self):
        self.status.update(state="failure", checked_at=iso(self.now))
        status = self.export()
        self.assertEqual(status["state"], "stale")
        self.assertTrue(json.loads((self.target / "feed.json").read_bytes())["stale"])
        self.assertEqual(status["last_fetch_succeeded_at"], iso(self.success))

    def test_job_silence_marks_existing_snapshot_stale(self):
        status = self.export(now=self.success + timedelta(hours=13))
        self.assertEqual(status["state"], "stale")
        self.assertEqual(status["source_state"], "success")

    def test_expired_snapshot_and_emergency_suppression_remove_exported_media(self):
        self.export()
        self.assertEqual(self.export(now=self.success + timedelta(hours=72))["state"], "expired")
        self.assertEqual([path.name for path in self.target.iterdir()], ["status.json"])
        (self.site / "content/instagram-hidden-posts.json").write_text(json.dumps([self.post_id]))
        self.assertEqual(self.export()["state"], "suppressed")
        self.assertEqual([path.name for path in self.target.iterdir()], ["status.json"])

    def test_mismatched_feed_or_image_is_never_partially_published(self):
        self.export()
        self.feed["posts"][0]["caption"] = "changed without valid metadata"
        self.assertEqual(self.export(sign=False)["source_state"], "invalid")
        (self.source / self.image_path).write_bytes(b"corrupt")
        self.assertEqual(self.export()["source_state"], "invalid")
        self.assertEqual([path.name for path in self.target.iterdir()], ["status.json"])

    def test_empty_response_and_off_origin_url_are_rejected(self):
        post = self.feed["posts"].pop()
        self.assertEqual(self.export()["source_state"], "invalid")
        post["permalink"] = "https://www.instagram.com.example.com/p/test/"
        self.feed["posts"].append(post)
        self.assertEqual(self.export()["source_state"], "invalid")

    def test_validate_known_official_permalink_and_reject_duplicate(self):
        self.feed["posts"].append(self.feed["posts"][0])
        self.assertEqual(self.export()["source_state"], "invalid")


if __name__ == "__main__":
    unittest.main()
