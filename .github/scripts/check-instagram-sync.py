#!/usr/bin/env python3
"""Read-only checks for the Instagram schedule, acquisition, and Pages publication."""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import json
import os
import re
import time


GITHUB = "https://api.github.com/repos"
PRODUCER = "MDL20241119/GarrawayFapp.github.io"
PAGES_REPO = "GarrawayF/garrawayf.github.io"
PAGES_FEED = "https://garrawayf.github.io/instagram-feed"
ENDPOINTS = {
    "producer_runs": f"{GITHUB}/{PRODUCER}/actions/workflows/instagram-feed.yml/runs?event=schedule&per_page=5",
    "producer_status": f"https://raw.githubusercontent.com/{PRODUCER}/main/data/instagram-sync-status.json",
    "pages_runs": f"{GITHUB}/{PAGES_REPO}/actions/workflows/deploy-pages.yml/runs?per_page=5",
    "pages_status": f"{PAGES_FEED}/status.json",
    "pages_feed": f"{PAGES_FEED}/feed.json",
}
MAX_BODY = 1024 * 1024
SCHEDULE_LIMIT = timedelta(hours=12)
ACQUISITION_LIMIT = timedelta(hours=12)
PUBLICATION_GRACE = timedelta(hours=8)
CDN_GRACE = timedelta(minutes=15)
CLOCK_TOLERANCE = timedelta(minutes=5)
JST = timezone(timedelta(hours=9), "JST")
SHA256_VALUE = re.compile(r"[a-f0-9]{64}\Z")
REVISION_VALUE = re.compile(r"[a-f0-9]{40}\Z")
PAGES_STATES = {"unavailable", "fresh", "stale", "expired", "suppressed"}
NOT_STARTED = {"queued", "requested", "pending", "waiting"}
ERROR_CATEGORIES = {
    "authentication", "permission", "permissions", "rate_limit", "server",
    "network", "timeout", "transient", "configuration", "invalid_response",
    "invalid_image", "caption_unavailable", "empty_or_incomplete_response",
}


@dataclass(frozen=True)
class Response:
    code: int | None = None
    body: bytes | None = None

    def document(self):
        if self.code != 200 or self.body is None:
            return None
        try:
            value = json.loads(self.body)
        except (ValueError, RecursionError):
            return None
        return value if isinstance(value, dict) else None

    def problem(self):
        if self.code == 200:
            return "invalid JSON or oversized response"
        if self.code is None:
            return "network request failed"
        return f"HTTP {self.code}"


@dataclass(frozen=True)
class Check:
    stage: str
    outcome: str
    detail: str


def read_response(url):
    request = Request(url, headers={
        "Accept": "application/json",
        "Cache-Control": "no-cache",
        "User-Agent": "garrawayf-instagram-watchdog/1",
    })
    for attempt in range(3):
        try:
            with urlopen(request, timeout=12) as response:
                body = response.read(MAX_BODY + 1)
                return Response(response.status, body if len(body) <= MAX_BODY else None)
        except HTTPError as exc:
            code = exc.code
            exc.close()
            if code != 429 and not 500 <= code < 600:
                return Response(code)
            error = Response(code)
        except (URLError, TimeoutError, OSError):
            error = Response()
        if attempt < 2:
            time.sleep(2 ** attempt)
    return error


def parse_time(value):
    if not isinstance(value, str):
        return None
    try:
        result = datetime.fromisoformat(value)
        return result.astimezone(timezone.utc) if result.tzinfo is not None else None
    except (ValueError, OverflowError):
        return None


def show_time(value):
    return value.astimezone(JST).strftime("%Y-%m-%d %H:%M:%S JST") if value else "unknown"


def matches(pattern, value):
    return isinstance(value, str) and pattern.fullmatch(value) is not None


def run_records(response):
    payload = response.document()
    runs = payload.get("workflow_runs") if payload is not None else None
    if isinstance(runs, list) and all(isinstance(run, dict) for run in runs):
        return runs
    return None


def started_runs(runs):
    started = []
    for run in runs:
        status = run.get("status")
        start = parse_time(run.get("run_started_at")) or parse_time(run.get("created_at"))
        if start is not None and isinstance(status, str) and status not in NOT_STARTED:
            started.append((start, run))
    return sorted(started, key=lambda pair: pair[0], reverse=True)


def check_schedule(response, now):
    runs = run_records(response)
    if runs is None:
        return Check("schedule", "FAIL", f"scheduled-run probe: {response.problem()}"), None
    scheduled = [(start, run) for start, run in started_runs(runs) if run.get("event") == "schedule"]
    if not scheduled:
        return Check("schedule", "FAIL", "no scheduled producer run started"), None
    start, latest = scheduled[0]
    if not now - SCHEDULE_LIMIT <= start <= now + CLOCK_TOLERANCE:
        return Check("schedule", "FAIL", f"last scheduled start: {show_time(start)}"), latest
    return Check("schedule", "OK", f"scheduled run started: {show_time(start)}"), latest


def check_acquisition(response, latest_run, now):
    source = response.document()
    if source is None:
        return Check("acquisition", "FAIL", f"producer status probe: {response.problem()}"), None
    checked = parse_time(source.get("checked_at"))
    heartbeat = parse_time(source.get("job_checked_at")) or checked
    success = parse_time(source.get("last_fetch_succeeded_at"))
    if checked is None or checked > now + CLOCK_TOLERANCE:
        return Check("acquisition", "FAIL", "invalid producer check timestamp"), source
    if latest_run and latest_run.get("status") == "completed" and latest_run.get("conclusion") != "success":
        start = parse_time(latest_run.get("run_started_at")) or parse_time(latest_run.get("created_at"))
        if start and heartbeat < start - CLOCK_TOLERANCE:
            return Check("acquisition", "FAIL", "producer run failed before updating acquisition status"), source
    state = source.get("state")
    if state != "success":
        error = source.get("error")
        category = error.get("category") if isinstance(error, dict) else None
        if not isinstance(category, str) or category not in ERROR_CATEGORIES:
            category = "unknown"
        meta_code = error.get("code") if isinstance(error, dict) else None
        code_detail = f", Meta code {meta_code}" if type(meta_code) is int and 0 < meta_code < 1000000 else ""
        detail = f"producer acquisition failed ({category}{code_detail}); last success: {show_time(success)}"
        return Check("acquisition", "FAIL", detail), source
    if success is None or not now - ACQUISITION_LIMIT <= success <= now + CLOCK_TOLERANCE:
        return Check("acquisition", "FAIL", f"last successful acquisition: {show_time(success)}"), source
    return Check("acquisition", "OK", f"last successful acquisition: {show_time(success)}"), source


def pending_publication(pages_runs, ready, now, detail):
    runs = run_records(pages_runs)
    if ready is None:
        return Check("publication", "PENDING", detail)
    after_source = [run for start, run in started_runs(runs or []) if start >= ready + CLOCK_TOLERANCE]
    if after_source and after_source[0].get("status") == "completed":
        last_run = after_source[0]
        if last_run.get("conclusion") != "success":
            return Check("publication", "FAIL", "Pages run failed after the producer snapshot was ready")
        finished = parse_time(last_run.get("updated_at"))
        if finished and now - finished > CDN_GRACE:
            return Check("publication", "FAIL", "Pages run completed, but the public feed did not match the producer")
    if now - ready > PUBLICATION_GRACE:
        return Check("publication", "FAIL", f"{detail}; producer snapshot ready since {show_time(ready)}")
    return Check("publication", "PENDING", detail)


def check_publication(status_response, feed_response, pages_runs, source, now):
    expected = source.get("publication") if source else None
    source_latest = None
    if expected is not None and (
        not isinstance(expected, dict) or type(expected.get("schema_version")) is not int
        or expected["schema_version"] != 1
        or not matches(SHA256_VALUE, expected.get("feed_sha256"))
    ):
        return Check("publication", "FAIL", "invalid producer publication metadata")
    if expected:
        source_latest = parse_time(expected.get("latest_post_at"))
        if source_latest is None:
            return Check("publication", "FAIL", "invalid producer latest post timestamp")
    source_success = parse_time(source.get("last_fetch_succeeded_at")) if source else None
    source_changed = parse_time(source.get("content_updated_at")) if source else None
    public = status_response.document()
    if public is None:
        if status_response.code == 404:
            if feed_response.code == 200:
                return Check("publication", "FAIL", "Pages feed is accessible without its status metadata")
            if expected is None:
                return Check("publication", "PENDING", "waiting for the first verified producer snapshot")
            return pending_publication(pages_runs, source_success, now, "waiting for the first Pages publication")
        return Check("publication", "FAIL", f"Pages status probe: {status_response.problem()}")
    state = public.get("state")
    published_at = parse_time(public.get("published_at"))
    if (
        public.get("schema_version") != 1 or not isinstance(state, str) or state not in PAGES_STATES
        or published_at is None or published_at > now + CLOCK_TOLERANCE
    ):
        return Check("publication", "FAIL", "invalid Pages status metadata")
    if public.get("source_state") == "invalid":
        return Check("publication", "FAIL", "Pages rejected the source snapshot")

    if state in {"fresh", "stale"}:
        digest = public.get("feed_sha256")
        if not matches(SHA256_VALUE, digest) or not matches(REVISION_VALUE, public.get("source_revision")):
            return Check("publication", "FAIL", "Pages feed checksum or source revision was missing")
        if feed_response.code != 200 or feed_response.body is None:
            if feed_response.code == 404 and now - published_at <= CDN_GRACE:
                return Check("publication", "PENDING", "waiting for the Pages feed file to reach the public cache")
            return Check("publication", "FAIL", f"Pages feed file probe: {feed_response.problem()}")
        if sha256(feed_response.body).hexdigest() != digest:
            if now - published_at <= CDN_GRACE:
                return Check("publication", "PENDING", "waiting for Pages status and feed caches to converge")
            return Check("publication", "FAIL", "Pages feed bytes did not match its published checksum")
    elif feed_response.code != 404:
        if feed_response.code == 200 and now - published_at <= CDN_GRACE:
            return Check("publication", "PENDING", "waiting for the previous feed to disappear from Pages cache")
        return Check("publication", "FAIL", "Pages feed is not confirmed absent while its display is disabled")

    if state == "suppressed":
        return Check("publication", "OK", "feed publication is paused and the feed file is absent")
    if expected is None:
        if state in {"fresh", "stale"}:
            return Check("publication", "PENDING", "public feed is intact; producer publication metadata is unavailable")
        return Check("publication", "PENDING", "waiting for the first verified producer snapshot")

    public_digest = public.get("source_feed_sha256")
    if public_digest != expected["feed_sha256"]:
        ready = source_changed if source_changed and source_changed > published_at else source_success
        return pending_publication(pages_runs, ready, now, "Pages is waiting for the latest producer snapshot")
    public_latest = parse_time(public.get("latest_post_at"))
    if public_latest != source_latest:
        return Check("publication", "FAIL", "Pages latest post timestamp differs from the matching producer snapshot")
    projected_change = parse_time(public.get("content_updated_at"))
    if source_changed and projected_change != source_changed:
        return Check("publication", "FAIL", "Pages content update timestamp differs from the matching producer snapshot")
    if state == "expired":
        return Check("publication", "OK", "expired snapshot is no longer public")
    if state == "unavailable" and source_latest:
        return pending_publication(pages_runs, source_success, now, "Pages feed is unavailable for a verified producer snapshot")
    projected_success = parse_time(public.get("last_fetch_succeeded_at"))
    if source_success and (projected_success is None or source_success - projected_success > PUBLICATION_GRACE):
        return pending_publication(pages_runs, projected_success or source_success, now, "Pages acquisition timestamp is behind the producer")
    return Check("publication", "OK", f"producer checksum matches Pages; latest post: {show_time(source_latest)}")


def inspect(responses, now):
    schedule, latest = check_schedule(responses["producer_runs"], now)
    acquisition, source = check_acquisition(responses["producer_status"], latest, now)
    publication = check_publication(
        responses["pages_status"], responses["pages_feed"], responses["pages_runs"], source, now,
    )
    return schedule, acquisition, publication


def main():
    with ThreadPoolExecutor(max_workers=len(ENDPOINTS)) as pool:
        responses = dict(zip(ENDPOINTS, pool.map(read_response, ENDPOINTS.values())))
    checks = inspect(responses, datetime.now(timezone.utc))
    lines = [f"{check.stage}: {check.outcome} — {check.detail}" for check in checks]
    print("\n".join(lines))
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with Path(summary).open("a", encoding="utf-8") as file:
            file.write("## Instagram sync watchdog\n\n" + "\n".join(f"- {line}" for line in lines) + "\n")
    return int(any(check.outcome == "FAIL" for check in checks))


if __name__ == "__main__":
    raise SystemExit(main())
