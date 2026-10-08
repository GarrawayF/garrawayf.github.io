import hashlib
import http.client
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import urllib.error
import urllib.parse


SPEC = importlib.util.spec_from_file_location("verify_publication", Path(__file__).with_name("verify-publication.py"))
verifier = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verifier)


class Response(io.BytesIO):
    def __init__(self, body, status=200, headers=None):
        super().__init__(body)
        self.status = status
        self.headers = headers or {"Cache-Control": "max-age=600", "Age": "123"}


class VerificationTests(unittest.TestCase):
    def setUp(self):
        self.now = 0
        self.requests = []
        self.logs = []

    def sleep(self, duration):
        self.now += duration

    def run_check(self, responses, expected=None, **options):
        responses = iter(responses)
        def opener(request, timeout):
            self.requests.append((request, timeout))
            response = next(responses)
            if isinstance(response, Exception):
                raise response
            return response
        verifier.verify_publication(
            expected or {"": b"correct"}, "https://example.invalid/", "commit", "100", "1",
            max_wait=options.pop("max_wait", 31), retry_interval=15,
            opener=opener, clock=lambda: self.now, sleep=self.sleep,
            log=self.logs.append, **options,
        )

    def test_exact_match_succeeds_without_wait(self):
        self.run_check([Response(b"correct"), Response(b"second")], {"": b"correct", "events/": b"second"})
        self.assertEqual(len(self.requests), 2)
        self.assertEqual(self.now, 0)
        self.assertIn("all 2 files match", self.logs[-1])

    def test_stale_response_then_success_uses_fresh_url(self):
        self.run_check([Response(b"stale"), Response(b"correct")])
        self.assertEqual(self.now, 15)
        first, second = [urllib.parse.parse_qs(urllib.parse.urlsplit(r.full_url).query) for r, _ in self.requests]
        self.assertEqual(first["verification_probe"], ["1"])
        self.assertEqual(second["verification_probe"], ["2"])
        self.assertEqual(first["verification_run"], ["100"])
        self.assertEqual(first["verification_attempt"], ["1"])
        self.assertEqual(first["revision"], ["commit"])

    def test_refresh_after_observed_ten_minute_cache_lifetime(self):
        self.run_check([Response(b"stale") for _ in range(41)] + [Response(b"correct")],
                       max_wait=verifier.MAX_WAIT_SECONDS)
        self.assertEqual(self.now, 615)
        self.assertLess(self.now, verifier.MAX_WAIT_SECONDS)

    def test_same_commit_rebuild_and_rerun_have_distinct_urls(self):
        urls = {verifier.verification_url("https://example.invalid/", "events/", "same", run, attempt, probe)
                for run, attempt, probe in [("100", "1", 1), ("101", "1", 1), ("100", "2", 1), ("100", "1", 2)]}
        self.assertEqual(len(urls), 4)

    def test_mismatch_logs_hashes_and_cache_headers_without_body(self):
        self.run_check([Response(b"private-old-body", headers={"X-Cache": "HIT", "Set-Cookie": "private", "Age": "321"}), Response(b"correct")])
        record = json.loads(self.logs[0])
        self.assertEqual(record["status"], 200)
        self.assertEqual(record["expected_sha256"], hashlib.sha256(b"correct").hexdigest())
        self.assertEqual(record["actual_sha256"], hashlib.sha256(b"private-old-body").hexdigest())
        self.assertEqual(record["headers"], {"x-cache": "HIT", "age": "321"})
        self.assertFalse(record["matched"])
        self.assertNotIn("private", "\n".join(self.logs))

    def test_http_error_logs_response_and_retries(self):
        error = urllib.error.HTTPError("https://example.invalid/", 503, "Unavailable", {"X-Cache": "MISS"}, io.BytesIO(b"correct"))
        self.run_check([error, Response(b"correct")])
        record = json.loads(self.logs[0])
        self.assertEqual(record["status"], 503)
        self.assertEqual(record["actual_sha256"], record["expected_sha256"])
        self.assertFalse(record["matched"], "Matching error-page bytes must not pass")
        self.assertEqual(record["headers"]["x-cache"], "MISS")

    def test_network_error_and_timeout_are_retried(self):
        self.run_check([urllib.error.URLError("offline"), TimeoutError("slow"), Response(b"correct")])
        self.assertEqual(self.now, 30)
        self.assertIn("URLError", self.logs[0])
        self.assertIn("TimeoutError", self.logs[2])
        self.assertEqual([timeout for _, timeout in self.requests], [20, 16, 1])

    def test_truncated_response_is_retried(self):
        self.run_check([http.client.IncompleteRead(b"partial", 10), Response(b"correct")])
        self.assertIn("IncompleteRead", self.logs[0])

    def test_persistent_mismatch_fails_at_deadline(self):
        with self.assertRaisesRegex(RuntimeError, "within 31s"):
            self.run_check([Response(b"wrong") for _ in range(3)])
        self.assertEqual(self.now, 31)
        self.assertEqual(len(self.requests), 3)

    def test_persistent_http_failure_does_not_pass(self):
        with self.assertRaises(RuntimeError):
            self.run_check([Response(b"correct", status=404) for _ in range(3)])

    def test_deadline_is_shared_by_all_routes(self):
        def opener(request, timeout):
            self.requests.append((request, timeout))
            self.now += timeout
            raise TimeoutError("slow")
        with self.assertRaises(RuntimeError):
            verifier.verify_publication({"": b"one", "events/": b"two", "contact/": b"three"},
                "https://example.invalid/", "sha", "run", "1", max_wait=25,
                opener=opener, clock=lambda: self.now, sleep=self.sleep, log=self.logs.append)
        self.assertEqual(self.now, 25)
        self.assertEqual([timeout for _, timeout in self.requests], [20, 5])

    def test_late_matching_response_does_not_pass(self):
        def opener(request, timeout):
            self.now += 2
            return Response(b"correct")
        with self.assertRaises(RuntimeError):
            verifier.verify_publication({"": b"correct"}, "https://example.invalid/", "sha", "run", "1",
                max_wait=1, opener=opener, clock=lambda: self.now, sleep=self.sleep, log=self.logs.append)

    def test_all_files_must_match_in_successful_probe(self):
        with self.assertRaises(RuntimeError):
            self.run_check([Response(b"one"), Response(b"old"), Response(b"old"), Response(b"two")],
                {"": b"one", "events/": b"two"}, max_wait=16)


class ArtifactTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.out = Path(self.temp.name)
        files = {"index.html": "home", "events/index.html": "events", "contact/index.html": "contact", "privacy/index.html": "privacy"}
        ramen = {
            "index.html": "access-planner.js?v=20260911f1 live-data.js?v=current",
            "catalog.json": json.dumps({"meta": {"catalogVersion": "same"}, "events": [1] * 101}),
            "sync-status.json": json.dumps({"catalogVersion": "same"}),
            "access-planner.js": "placeAfterPlanContent 行き｜このイベントに間に合う 帰り｜このイベント後に帰る",
            "kyushu/index.html": '20260912k4 福岡に来たら、 実際のイベント写真ではありません。' + 'class="card-source"' * 19,
            "kyushu/kyushu.js": "valid",
        }
        assets = []
        for i in range(19):
            path = f"images/{i}.jpg"
            body = str(i) * 1001
            ramen["kyushu/" + path] = body
            assets.append({"path": path, "sha256": hashlib.sha256(body.encode()).hexdigest()})
        ramen["kyushu/image-manifest.json"] = json.dumps({"version": "20260912k3", "assets": assets})
        files.update({verifier.RAMEN + route: body for route, body in ramen.items()})
        for route, body in files.items():
            path = self.out / route
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(body)

    def test_all_original_pages_and_ramen_assets_are_verified(self):
        expected = verifier.load_expected(self.out)
        self.assertEqual(len(expected), 30)
        self.assertIn("ramen-tech-2026/catalog.json", expected)
        self.assertIn("ramen-tech-2026/kyushu/images/18.jpg", expected)

    def test_invalid_local_artifact_fails_before_network(self):
        (self.out / "ramen-tech-2026/kyushu/images/0.jpg").write_bytes(b"tampered")
        with self.assertRaises(AssertionError):
            verifier.load_expected(self.out)

    def test_existing_ramen_semantic_check_is_preserved(self):
        (self.out / "ramen-tech-2026/kyushu/kyushu.js").write_text('class="image-disclosure"')
        with self.assertRaises(AssertionError):
            verifier.load_expected(self.out)

    def test_missing_local_file_fails_before_network(self):
        (self.out / "index.html").unlink()
        with self.assertRaises(FileNotFoundError):
            verifier.load_expected(self.out)


if __name__ == "__main__":
    unittest.main()
