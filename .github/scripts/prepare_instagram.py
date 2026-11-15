"""Stage verified Instagram posts for Pages without depending on the live API."""

from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile


ACCOUNT = "garrawayf_lounge"
MAX_VISIBLE = 4
STALE_AFTER = timedelta(hours=12)
EXPIRE_AFTER = timedelta(hours=72)
JST = timezone(timedelta(hours=9))
STATUSES = ("success", "failure")
POST_ID = re.compile(r"[0-9]{4,25}")
DIGEST = re.compile(r"[0-9a-f]{64}")
PERMALINK = re.compile(r"https://www\.instagram\.com/(?:p|reel|tv)/[A-Za-z0-9_-]+/?")


def encode(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def iso(date):
    return date.isoformat().replace("+00:00", "Z")


def date(value):
    parsed = datetime.fromisoformat(value)
    if not parsed.tzinfo:
        raise ValueError("Timestamp requires an offset")
    return parsed.astimezone(timezone.utc)


def size_limited(path, limit):
    with path.open("rb") as source:
        raw = source.read(limit + 1)
    if len(raw) > limit:
        raise ValueError("File exceeds the size limit")
    return raw


def verified_snapshot(source, status, now):
    proof = status["publication"]
    if type(proof.get("schema_version")) is not int or proof["schema_version"] != 1:
        raise ValueError("Unsupported snapshot proof")
    if status["state"] not in STATUSES:
        raise ValueError("Unexpected producer state")
    checked, last_success, changed, latest = (
        date(status["checked_at"]),
        date(status["last_fetch_succeeded_at"]),
        date(status["content_updated_at"]),
        date(proof["latest_post_at"]),
    )
    if not max(changed, latest) <= last_success <= checked <= now + timedelta(minutes=5):
        raise ValueError("Inconsistent snapshot times")
    raw = size_limited(source / "data/instagram.json", 100_000)
    if sha256(raw) != proof["feed_sha256"]:
        raise ValueError("Snapshot checksum mismatch")
    feed = json.loads(raw)
    posts = feed["posts"]
    if feed["account"] != ACCOUNT or date(feed["updated_at"]) != changed or not 1 <= len(posts) <= 6:
        raise ValueError("Unexpected account or snapshot contents")
    return posts, checked, last_success, changed, latest


def public_posts(source, posts, latest, hidden):
    result = []
    seen = set()
    previous = latest
    for index, post in enumerate(posts):
        post_id = post["id"]
        permalink, caption = post["permalink"], post["caption"]
        timestamp = date(post["timestamp"])
        if (
            not POST_ID.fullmatch(post_id) or post_id in seen
            or not PERMALINK.fullmatch(permalink)
            or not isinstance(caption, str) or len(caption) > 5000
            or post.get("is_story") is not False
            or post["media_type"] not in {"IMAGE", "VIDEO", "CAROUSEL_ALBUM"}
            or timestamp > previous or (index == 0 and timestamp != latest)
        ):
            raise ValueError("Invalid post")
        seen.add(post_id)
        previous = timestamp
        path = f"images/instagram/{post_id}.jpg"
        if post["image"] != path:
            raise ValueError("Unexpected image path")
        image = size_limited(source / path, 6_000_000)
        digest = sha256(image)
        if len(image) < 100 or image[:3] != b"\xff\xd8\xff" or image[-2:] != b"\xff\xd9" or post["image_version"] != digest[:12]:
            raise ValueError("Invalid image")
        if post_id not in hidden and len(result) < MAX_VISIBLE:
            filename = f"{post_id}-{digest[:16]}.jpg"
            result.append(({
                "id": post_id,
                "caption": caption,
                "timestamp": iso(timestamp),
                "date_label": timestamp.astimezone(JST).strftime("%Y.%m.%d"),
                "permalink": permalink,
                "image": f"/instagram-feed/{filename}",
                "image_sha256": digest,
            }, filename, image))
    return result


def hidden_posts(site):
    data = json.loads(size_limited(site / "content/instagram-hidden-posts.json", 20_000))
    if not isinstance(data, list) or any(not isinstance(post, str) or not POST_ID.fullmatch(post) for post in data):
        raise ValueError("Invalid suppressions")
    return set(data)


def prepare(site, source, source_revision, site_revision, now):
    target = site / "public/instagram-feed"
    public_status = {
        "schema_version": 1,
        "state": "unavailable",
        "source_state": "not_verified",
        "source_revision": source_revision,
        "site_revision": site_revision,
        "published_at": iso(now),
        "checked_at": None,
        "last_fetch_succeeded_at": None,
        "content_updated_at": None,
        "latest_post_at": None,
        "source_feed_sha256": None,
        "feed_sha256": None,
    }
    display_posts = []
    try:
        hidden = hidden_posts(site)
        status = json.loads(size_limited(source / "data/instagram-sync-status.json", 18_000))
        public_status["checked_at"] = iso(date(status["checked_at"]))
        if status.get("publication"):
            posts, checked, last_success, changed, latest = verified_snapshot(source, status, now)
            display_posts = public_posts(source, posts, latest, hidden)
            state = "fresh"
            if now - last_success >= EXPIRE_AFTER:
                state, display_posts = "expired", []
            elif not display_posts:
                state = "suppressed"
            elif status["state"] == "failure" or now - last_success >= STALE_AFTER:
                state = "stale"
            public_status.update(
                state=state, source_state=status["state"], checked_at=iso(checked),
                last_fetch_succeeded_at=iso(last_success), content_updated_at=iso(changed),
                latest_post_at=iso(latest), source_feed_sha256=status["publication"]["feed_sha256"],
            )
    except (OSError, ValueError, AttributeError, KeyError, TypeError, OverflowError):
        public_status["source_state"] = "invalid"
        print("::warning::Instagram snapshot unavailable for this Pages build.")

    # Keep data and photos in the same deploy artifact. A failed validation
    # never writes individual posts to the public directory.
    with tempfile.TemporaryDirectory(dir=target.parent) as directory:
        staging = Path(directory) / "bundle"
        staging.mkdir()
        if display_posts:
            public_feed = encode({
                "schema_version": 1,
                "account": ACCOUNT,
                "built_at": public_status["published_at"],
                "last_fetch_succeeded_at": public_status["last_fetch_succeeded_at"],
                "stale": public_status["state"] == "stale",
                "posts": [post for post, _, _ in display_posts],
            })
            for _, filename, image in display_posts:
                (staging / filename).write_bytes(image)
            (staging / "feed.json").write_bytes(public_feed)
            public_status["feed_sha256"] = sha256(public_feed)
        (staging / "status.json").write_bytes(encode(public_status))
        backup = Path(directory) / "previous"
        if target.exists():
            target.rename(backup)
        try:
            staging.rename(target)
        except OSError:
            if backup.exists():
                backup.rename(target)
            raise
    print(f"Instagram for Pages: {public_status['state']} ({len(display_posts)} posts).")
    return public_status


if __name__ == "__main__":
    site_path, source_path, revision = sys.argv[1:]
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise SystemExit("Invalid source revision")
    prepare(Path(site_path), Path(source_path), revision, os.environ["GITHUB_SHA"], datetime.now(timezone.utc))
