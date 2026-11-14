"""Validate a Reference Curator dashboard submission from an authorized GitHub Issue.

Only an explicitly allowlisted topic profile and a few global options are saved.
The dashboard never sees a GitHub token or Discord/OpenAI/Serper secrets.
"""
from __future__ import annotations

import json
import re
from copy import deepcopy

TOPIC_ID = re.compile(r"^[a-z][a-z0-9_]{2,63}$")
SOURCES = ("artstation", "pinterest", "behance", "flickr")
ROLE_NAMES = ("silhouette", "architecture", "atmosphere")
PROFILE_TEXT = ("period", "architecture", "materials", "lighting", "palette")
JSON_HEADING = re.compile(r"(?ms)^### Configuration JSON\s*\n(.*?)(?=^### |\Z)")


def require_text(value, field, minimum=0, maximum=2000):
    if not isinstance(value, str):
        raise ValueError(f"{field}: expected text")
    text = value.strip()
    if len(text) < minimum or len(text) > maximum:
        raise ValueError(f"{field}: length must be {minimum}-{maximum}")
    return text


def require_integer(value, field, minimum, maximum):
    if type(value) is not int or not minimum <= value <= maximum:
        raise ValueError(f"{field}: must be integer {minimum}-{maximum}")
    return value


def require_boolean(value, field):
    if type(value) is not bool:
        raise ValueError(f"{field}: must be true or false")
    return value


def require_list(value, field, maximum, minimum_length=1, item_limit=140):
    if not isinstance(value, list) or len(value) > maximum:
        raise ValueError(f"{field}: expected a list with at most {maximum} entries")
    result = []
    for item in value:
        if not isinstance(item, str):
            raise ValueError(f"{field}: entries must be text")
        cleaned = item.strip()
        if cleaned:
            if len(cleaned) < minimum_length or len(cleaned) > item_limit:
                raise ValueError(f"{field}: invalid entry length")
            result.append(cleaned)
    return result


def issue_payload(body):
    if not isinstance(body, str) or len(body) > 30000:
        raise ValueError("Dashboard issue body missing or too long")
    matched = JSON_HEADING.search(body)
    if not matched:
        raise ValueError("Configuration JSON field missing")
    raw = matched.group(1).strip()
    if raw.startswith("```"):
        # Issue Form bodies may include additional text after the fenced JSON.
        # Extract only the first complete code fence; never parse trailing prose.
        fence = re.match(r"```(?:json)?[ \t]*\r?\n(.*?)\r?\n```(?=\r?\n|$)", raw,
                         flags=re.DOTALL | re.IGNORECASE)
        if not fence:
            raise ValueError("Malformed JSON code fence")
        raw = fence.group(1).strip()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError("Invalid Configuration JSON") from None
    if not isinstance(payload, dict) or payload.get("version") != 1:
        raise ValueError("Unsupported dashboard payload version")
    if set(payload) - {"version", "topic_id", "profile", "activate", "options"}:
        raise ValueError("Unexpected dashboard payload keys")
    return payload


def apply_dashboard_issue(config, body):
    payload = issue_payload(body)
    identifier = require_text(payload.get("topic_id"), "Topic ID", 3, 64)
    if not TOPIC_ID.fullmatch(identifier):
        raise ValueError("Topic ID must be lowercase a-z, 0-9, underscore")
    requested = payload.get("profile")
    if not isinstance(requested, dict):
        raise ValueError("Profile must be an object")
    allowed = {"label", "direction", "fantasy_intensity", "vision_strictness",
               "include", "exclude", "roles", *PROFILE_TEXT, *SOURCES}
    if set(requested) - allowed:
        raise ValueError("Unsupported profile fields")

    profile = deepcopy(config.get("topics", {}).get(identifier, {}))
    profile["label"] = require_text(requested.get("label"), "Topic Name", 1, 90)
    profile["direction"] = require_text(requested.get("direction"), "Visual Direction", 8, 2000)
    profile["fantasy_intensity"] = require_integer(
        requested.get("fantasy_intensity"), "Fantasy intensity", 0, 3)
    strictness = requested.get("vision_strictness")
    if strictness not in ("relaxed", "balanced", "strict"):
        raise ValueError("Invalid Vision Strictness")
    profile["vision_strictness"] = strictness

    for key in PROFILE_TEXT:
        profile[key] = require_text(requested.get(key, ""), key, 0, 2000)
    for key in ("include", "exclude"):
        profile[key] = require_list(requested.get(key, []), key, 12)

    roles = requested.get("roles")
    if not isinstance(roles, dict) or set(roles) - set(ROLE_NAMES):
        raise ValueError("Invalid roles object")
    profile["roles"] = {role: require_text(roles.get(role), role, 8, 2000)
                        for role in ROLE_NAMES}

    for source in SOURCES:
        profile[source] = require_list(requested.get(source, []), source, 8, 3)
    if not any(profile[source] for source in SOURCES):
        raise ValueError("At least one image search source must be enabled")

    options = payload.get("options")
    if not isinstance(options, dict) or set(options) - {
            "vision_enabled", "max_candidates", "min_width", "min_height"}:
        raise ValueError("Invalid global options")
    enabled = require_boolean(options.get("vision_enabled"), "Vision enabled")
    candidates = require_integer(options.get("max_candidates"), "Vision max candidates", 3, 7)
    width = require_integer(options.get("min_width"), "Minimum width", 64, 4096)
    height = require_integer(options.get("min_height"), "Minimum height", 64, 4096)
    activate = require_boolean(payload.get("activate"), "Activate now")

    updated = deepcopy(config)
    updated.setdefault("topics", {})[identifier] = profile
    if activate:
        updated["active_topic"] = identifier
    updated["minimum_image_width"] = width
    updated["minimum_image_height"] = height
    updated.setdefault("vision", {})["enabled"] = enabled
    updated["vision"]["max_candidates"] = candidates
    return updated
