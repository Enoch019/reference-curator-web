"""Generate the dashboard's topic snapshot from config.json (no secrets)."""
from __future__ import annotations

import json
import sys
from pathlib import Path


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: sync_dashboard_bootstrap.py CONFIG_JSON OUTPUT_JS")
    cfg = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    # The dashboard is static and publicly readable if hosted on GitHub Pages.
    # Only settings already present in config.json are exported, never Secrets.
    settings = {key: cfg[key] for key in (
        "active_topic", "max_results", "minimum_image_width",
        "minimum_image_height", "topics", "vision") if key in cfg}
    output = Path(sys.argv[2])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        "// Generated from config.json. Never add API keys or webhook URLs.\n"
        + "window.REFERENCE_CURATOR_BOOTSTRAP = "
        + json.dumps(settings, ensure_ascii=True, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
