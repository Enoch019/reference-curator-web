"""Convert an authenticated GitHub Issue Form into a safe local topic configuration.

This script never executes text from the issue. The workflow authorizes the
repository owner or invited editor before applying the parsed values.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

FIELDS = {
    "Topic ID": "topic_id",
    "Topic Name": "label",
    "Visual Direction": "direction",
    "Fantasy Intensity": "fantasy",
    "Era and Culture": "period",
    "Architecture and Shapes": "architecture",
    "Materials and Details": "materials",
    "Lighting and Weather": "lighting",
    "Color Palette": "palette",
    "Must Include": "include",
    "Must Avoid": "exclude",
    "Slot 1 - Silhouette": "silhouette",
    "Slot 2 - Architecture": "architectural_detail",
    "Slot 3 - Atmosphere": "atmosphere",
    "ArtStation Queries": "artstation",
    "Pinterest Queries": "pinterest",
    "Vision Strictness": "strictness",
    "Activate Now": "activate",
}
HEADING = re.compile(r"(?m)^### ([^\r\n]+)\s*$")
TOPIC_ID = re.compile(r"^[a-z][a-z0-9_]{2,63}$")


def parse_form(body: str) -> dict[str, str]:
    if not isinstance(body, str) or len(body) > 30000:
        raise ValueError("Issue body is missing or too long")
    matches = list(HEADING.finditer(body))
    values: dict[str, str] = {}
    for i, match in enumerate(matches):
        heading = match.group(1).strip()
        if heading not in FIELDS:
            continue
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        value = body[match.end():end].strip()
        if value == "_No response_":
            value = ""
        values[FIELDS[heading]] = value[:2000]
    return values


def lines(raw: str, maximum: int = 8) -> list[str]:
    values = [v.strip().lstrip("- ").strip() for v in raw.splitlines()]
    return [v[:140] for v in values if v and len(v) >= 3][:maximum]


def apply_profile(config: dict, body: str) -> dict:
    fields = parse_form(body)
    ident = fields.get("topic_id", "")
    label = fields.get("label", "")
    if not TOPIC_ID.fullmatch(ident):
        raise ValueError("Topic ID must use 3-64 lowercase letters, digits or underscores")
    if not label or len(label) > 90:
        raise ValueError("Topic Name must be between 1 and 90 characters")
    direction = fields.get("direction", "").strip()
    if len(direction) < 8:
        raise ValueError("Visual Direction is too short")
    art = lines(fields.get("artstation", ""), 8)
    pins = lines(fields.get("pinterest", ""), 8)
    if not art or not pins:
        raise ValueError("Specify at least one ArtStation and Pinterest query")
    fantasy = fields.get("fantasy", "")
    if not re.match(r"^[0-3] - ", fantasy):
        raise ValueError("Invalid Fantasy Intensity")
    strictness = fields.get("strictness", "")
    if strictness not in ("balanced", "strict", "relaxed"):
        raise ValueError("Invalid Vision Strictness")
    active = fields.get("activate")
    if active not in ("Yes", "No"):
        raise ValueError("Activate Now must be Yes or No")
    slots = {
        "silhouette": fields.get("silhouette", ""),
        "architecture": fields.get("architectural_detail", ""),
        "atmosphere": fields.get("atmosphere", ""),
    }
    if any(len(value) < 8 for value in slots.values()):
        raise ValueError("All three slot descriptions are required")
    profile = {
        # The form edits only its fields; keep optional source queries and metadata.
        **config.get("topics", {}).get(ident, {}),
        "label": label,
        "direction": direction,
        "fantasy_intensity": int(fantasy[0]),
        "period": fields.get("period", ""),
        "architecture": fields.get("architecture", ""),
        "materials": fields.get("materials", ""),
        "lighting": fields.get("lighting", ""),
        "palette": fields.get("palette", ""),
        "include": lines(fields.get("include", ""), 12) if "\n" in fields.get("include", "") else [p.strip()[:140] for p in fields.get("include", "").split(",") if p.strip()][:12],
        "exclude": lines(fields.get("exclude", ""), 12) if "\n" in fields.get("exclude", "") else [p.strip()[:140] for p in fields.get("exclude", "").split(",") if p.strip()][:12],
        "roles": slots,
        "vision_strictness": strictness,
        "artstation": art,
        "pinterest": pins,
    }
    # Preserve all other topics, including the last known working one.
    config.setdefault("topics", {})[ident] = profile
    if active == "Yes":
        config["active_topic"] = ident
    return config


def main() -> None:
    if len(sys.argv) != 3:
        raise ValueError("Usage: apply_topic_issue.py EVENT_JSON CONFIG_JSON")
    event = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    config_path = Path(sys.argv[2])
    issue = event.get("issue") or {}
    actor = issue.get("user") or {}
    owner = (event.get("repository") or {}).get("owner", {}).get("login", "")
    author = str(actor.get("login", ""))
    authorized = os.environ.get("AUTHORIZED_ISSUE_AUTHOR", "")
    if (not owner or not author or
            (author.casefold() != owner.casefold() and
             (not authorized or author.casefold() != authorized.casefold()))):
        raise ValueError("Only the repository owner or an authorized editor can update a reference topic")
    title = str(issue.get("title", ""))
    if not (title.startswith("[Curator Profile]") or title.startswith("[Curator Web]")):
        raise ValueError("Not a curator configuration issue")
    config = json.loads(config_path.read_text(encoding="utf-8"))
    if title.startswith("[Curator Web]"):
        try:
            from scripts.apply_dashboard_issue import apply_dashboard_issue
        except ModuleNotFoundError:
            from apply_dashboard_issue import apply_dashboard_issue
        modified = apply_dashboard_issue(config, issue.get("body", ""))
    else:
        modified = apply_profile(config, issue.get("body", ""))
    config_path.write_text(json.dumps(modified, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Applied topic profile: {modified['active_topic']}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError) as error:
        print(f"Invalid topic profile: {error}", file=sys.stderr)
        sys.exit(1)
