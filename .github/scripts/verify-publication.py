#!/usr/bin/env python3
"""Verify the deployed bytes, allowing a bounded GitHub Pages cache refresh."""

import hashlib
import http.client
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request


MAX_WAIT_SECONDS = 720  # Exceeds the observed Pages Cache-Control max-age=600.
RETRY_SECONDS = 15
REQUEST_TIMEOUT_SECONDS = 20
DIAGNOSTIC_HEADERS = (
    "age", "cache-control", "date", "etag", "expires", "last-modified",
    "content-type", "content-length", "via", "x-cache", "x-cache-hits",
    "x-served-by", "x-github-request-id", "x-fastly-request-id",
)
RAMEN = "ramen-tech-2026/"


def load_expected(out):
    """Fail immediately on a bad local artifact; keep the existing RAMEN checks."""
    routes = ["", "events/", "contact/", "privacy/"]
    routes += [RAMEN + path for path in (
        "", "catalog.json", "sync-status.json", "access-planner.js", "kyushu/",
        "kyushu/kyushu.js", "kyushu/image-manifest.json",
    )]
    expected = {
        route: (out / (route + "index.html" if not route or route.endswith("/") else route)).read_bytes()
        for route in routes
    }
    def get(path):
        return expected[RAMEN + path].decode("utf-8")

    version = "20260911f1"
    html = get("")
    assert "access-planner.js?v=" + version in html
    assert "live-data.js?v=" in html
    current = json.loads(get("catalog.json"))
    health = json.loads(get("sync-status.json"))
    assert current["meta"]["catalogVersion"] == health["catalogVersion"]
    assert len(current["events"]) > 100
    access = get("access-planner.js")
    assert "placeAfterPlanContent" in access
    assert "行き｜このイベントに間に合う" in access and "帰り｜このイベント後に帰る" in access
    autumn = get("kyushu/")
    assert "20260912k4" in autumn and "福岡に来たら、" in autumn
    assert autumn.count("実際のイベント写真ではありません。") == 1
    assert autumn.count('class="card-source"') == 19
    assert 'class="photo-tag"' not in autumn and 'class="cover-image-tag"' not in autumn
    assert 'class="image-disclosure"' not in get("kyushu/kyushu.js")
    manifest = json.loads(get("kyushu/image-manifest.json"))
    assert manifest["version"] == "20260912k3" and len(manifest["assets"]) == 19
    assert len({asset["sha256"] for asset in manifest["assets"]}) == 19
    for asset in manifest["assets"]:
        path = Path(asset["path"])
        assert not path.is_absolute() and ".." not in path.parts, "Invalid image path"
        route = RAMEN + "kyushu/" + asset["path"]
        image = (out / route).read_bytes()
        assert len(image) > 1000 and hashlib.sha256(image).hexdigest() == asset["sha256"]
        expected[route] = image
    return expected


def verification_url(base_url, route, revision, run_id, run_attempt, probe):
    # A commit can be rebuilt with different feed data / Next build IDs. A rerun
    # also needs a fresh key, as does a retry that initially reached a stale edge.
    query = urllib.parse.urlencode({
        "revision": revision, "verification_run": run_id,
        "verification_attempt": run_attempt, "verification_probe": probe,
    })
    return base_url.rstrip("/") + "/" + route + "?" + query


def verify_publication(expected, base_url, revision, run_id, run_attempt, *,
                       max_wait=MAX_WAIT_SECONDS, retry_interval=RETRY_SECONDS,
                       opener=urllib.request.urlopen, clock=time.monotonic,
                       sleep=time.sleep, log=print):
    if not expected or max_wait <= 0 or retry_interval <= 0:
        raise ValueError("Expected files and positive retry limits are required")
    hashes = {route: hashlib.sha256(body).hexdigest() for route, body in expected.items()}
    started = clock()
    deadline = started + max_wait
    probe = 0
    failures = list(expected)
    while clock() < deadline:
        probe += 1
        failures = []
        for route, expected_hash in hashes.items():
            remaining = deadline - clock()
            if remaining <= 0:
                failures.append(route)
                break
            url = verification_url(base_url, route, revision, run_id, run_attempt, probe)
            request = urllib.request.Request(url, headers={
                "Cache-Control": "no-cache", "User-Agent": "GarrawayF-deployment-check/2.0",
            })
            record = {"probe": probe, "url": url, "expected_sha256": expected_hash,
                      "status": None, "actual_sha256": None, "headers": {}}
            try:
                try:
                    response = opener(request, timeout=min(REQUEST_TIMEOUT_SECONDS, remaining))
                except urllib.error.HTTPError as error:
                    response = error  # Record error status, body hash and cache headers too.
                with response:
                    record["status"] = response.status
                    headers = {key.lower(): value for key, value in response.headers.items()}
                    record["headers"] = {key: headers[key] for key in DIAGNOSTIC_HEADERS if key in headers}
                    body = response.read()
                    record["actual_sha256"] = hashlib.sha256(body).hexdigest()
                    record["bytes"] = len(body)
            except (urllib.error.URLError, OSError, http.client.HTTPException) as error:
                record["error"] = type(error).__name__ + ": " + str(error)
            matched = record["status"] == 200 and record["actual_sha256"] == expected_hash
            record["matched"] = matched
            record["elapsed_seconds"] = round(clock() - started, 3)
            log(json.dumps(record, ensure_ascii=True, sort_keys=True))
            if not matched:
                failures.append(route)
        if not failures and clock() <= deadline:
            log(f"PUBLICATION VERIFIED: all {len(expected)} files match this build (probe {probe}).")
            return
        remaining = deadline - clock()
        if remaining > 0:
            log(f"Waiting for public cache refresh; {len(failures)} mismatches, {remaining:.1f}s remaining.")
            sleep(min(retry_interval, remaining))
    raise RuntimeError(f"Public files did not match this build within {max_wait}s; last failures: {failures}")


if __name__ == "__main__":
    verify_publication(
        load_expected(Path("site/out")), "https://garrawayf.github.io/",
        os.environ["GITHUB_SHA"], os.environ["GITHUB_RUN_ID"], os.environ["GITHUB_RUN_ATTEMPT"],
    )
