from datetime import datetime, timedelta, timezone
from hashlib import sha256
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import json
import sys
import unittest


SPEC = spec_from_file_location("check_instagram_sync", Path(__file__).with_name("check-instagram-sync.py"))
watchdog = module_from_spec(SPEC)
sys.modules[SPEC.name] = watchdog
SPEC.loader.exec_module(watchdog)

NOW = datetime(2026, 11, 15, 12, tzinfo=timezone.utc)
FEED = b'{"posts":[{"id":"1234"}]}\n'
SOURCE_DIGEST = "b" * 64


def stamp(*, hours=0, minutes=0):
    return (NOW + timedelta(hours=hours, minutes=minutes)).isoformat()


def response(value):
    return watchdog.Response(200, json.dumps(value).encode())


def action_run(*, event="schedule", hours=-1, status="completed", conclusion="success"):
    return {
        "event": event, "status": status, "conclusion": conclusion,
        "created_at": stamp(hours=hours), "run_started_at": stamp(hours=hours),
        "updated_at": stamp(hours=hours, minutes=5),
    }


class InstagramWatchdogTest(unittest.TestCase):
    def setUp(self):
        self.source = {
            "state": "success", "checked_at": stamp(minutes=-40),
            "last_fetch_succeeded_at": stamp(minutes=-40),
            "content_updated_at": stamp(hours=-5),
            "publication": {
                "schema_version": 1, "feed_sha256": SOURCE_DIGEST, "latest_post_at": stamp(hours=-6),
            },
        }
        self.public = {
            "schema_version": 1, "state": "fresh", "source_state": "success",
            "published_at": stamp(minutes=-30), "feed_sha256": sha256(FEED).hexdigest(),
            "source_revision": "4" * 40, "source_feed_sha256": SOURCE_DIGEST,
            "latest_post_at": stamp(hours=-6), "content_updated_at": stamp(hours=-5),
            "last_fetch_succeeded_at": stamp(minutes=-40),
        }
        self.responses = {
            "producer_runs": response({"workflow_runs": [action_run()]}),
            "pages_runs": response({"workflow_runs": [action_run(hours=-4)]}),
            "pages_feed": watchdog.Response(200, FEED),
        }

    def run_checks(self):
        self.responses.setdefault("producer_status", response(self.source))
        self.responses.setdefault("pages_status", response(self.public))
        return watchdog.inspect(self.responses, NOW)

    def test_match_actual_feed_bytes_and_source_projection(self):
        self.assertEqual([c.outcome for c in self.run_checks()], ["OK", "OK", "OK"])

    def test_manual_and_queued_runs_do_not_count_as_scheduled_starts(self):
        self.responses["producer_runs"] = response({"workflow_runs": [
            action_run(event="workflow_dispatch"), action_run(status="queued", conclusion=None),
        ]})
        schedule, acquisition, publication = self.run_checks()
        self.assertEqual((schedule.outcome, acquisition.outcome, publication.outcome), ("FAIL", "OK", "OK"))

    def test_missed_schedule_and_authentication_are_independent(self):
        self.responses["producer_runs"] = response({"workflow_runs": [action_run(hours=-13)]})
        self.responses["pages_status"] = self.responses["pages_feed"] = watchdog.Response(404)
        self.source.pop("publication")
        self.source.update(state="failure", last_fetch_succeeded_at=None,
                           error={"category": "authentication", "code": 190, "message": "opaque secret"})
        schedule, acquisition, publication = self.run_checks()
        self.assertEqual((schedule.outcome, acquisition.outcome, publication.outcome), ("FAIL", "FAIL", "PENDING"))
        self.assertIn("Meta code 190", acquisition.detail)
        self.assertNotIn("opaque secret", acquisition.detail)

    def test_failed_runner_before_status_update(self):
        self.responses["producer_runs"] = response({"workflow_runs": [
            action_run(hours=0, conclusion="failure"),
        ]})
        schedule, acquisition, publication = self.run_checks()
        self.assertEqual((schedule.outcome, acquisition.outcome, publication.outcome), ("OK", "FAIL", "OK"))
        self.assertIn("before updating", acquisition.detail)

    def test_first_pages_run_can_still_be_pending(self):
        self.responses["pages_status"] = self.responses["pages_feed"] = watchdog.Response(404)
        self.assertEqual(self.run_checks()[2].outcome, "PENDING")

    def test_feed_without_status_manifest_is_a_publication_failure(self):
        self.responses["pages_status"] = watchdog.Response(404)
        self.assertEqual(self.run_checks()[2].outcome, "FAIL")

    def test_first_pages_run_past_grace_is_a_publication_failure(self):
        self.responses["pages_status"] = self.responses["pages_feed"] = watchdog.Response(404)
        self.responses["pages_runs"] = response({"workflow_runs": []})
        self.source["last_fetch_succeeded_at"] = stamp(hours=-9)
        self.assertEqual(self.run_checks()[2].outcome, "FAIL")

    def test_pages_digest_mismatch_after_next_deploy(self):
        self.public.update(source_feed_sha256="a" * 64, published_at=stamp(hours=-6))
        publication = self.run_checks()[2]
        self.assertEqual(publication.outcome, "FAIL")
        self.assertIn("Pages run completed", publication.detail)

    def test_public_feed_byte_mismatch(self):
        self.responses["pages_feed"] = watchdog.Response(200, b"different bytes")
        self.assertEqual(self.run_checks()[2].outcome, "FAIL")

    def test_recent_public_feed_byte_mismatch_may_be_cache_skew(self):
        self.public["published_at"] = stamp(minutes=-5)
        self.responses["pages_feed"] = watchdog.Response(200, b"old bytes")
        self.assertEqual(self.run_checks()[2].outcome, "PENDING")

    def test_auth_failure_with_intact_last_good_public_feed(self):
        self.public.update(state="stale", source_state="failure")
        self.source.update(state="failure", error={"category": "authentication", "code": 190})
        schedule, acquisition, publication = self.run_checks()
        self.assertEqual((schedule.outcome, acquisition.outcome, publication.outcome), ("OK", "FAIL", "OK"))

    def test_expired_source_snapshot_cannot_be_served(self):
        self.public.update(state="expired", source_state="failure", feed_sha256=None)
        self.assertEqual(self.run_checks()[2].outcome, "FAIL")


if __name__ == "__main__":
    unittest.main()
