"""
Wrapper CLI for the sundog Gone Rogue headless runner.

Works both as ``python -m tools.gonerogue_runner`` and as the entry-point of
the PyInstaller-packaged ``gone-rogue-runner.exe``.
"""

import os
import sys


def _resolve_base_path() -> str:
    """Return the repo root (or PyInstaller extraction dir when frozen)."""
    if getattr(sys, "frozen", False):
        return sys._MEIPASS  # type: ignore[attr-defined]
    # Walk up from this file: tools/gonerogue_runner/cli.py → repo root
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _ensure_utf8_console() -> None:
    """Reconfigure stdout/stderr to UTF-8 on Windows."""
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


def _check_playwright_chromium() -> None:
    """Exit with a clear message if Playwright Chromium is not installed."""
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser_path = p.chromium.executable_path
            if not os.path.exists(browser_path):
                raise FileNotFoundError(browser_path)
    except Exception as exc:
        border = "=" * 60
        print(border, file=sys.stderr)
        print("  ERROR: Playwright Chromium is not installed.", file=sys.stderr)
        print("  Run:  playwright install chromium", file=sys.stderr)
        print(f"  Detail: {exc}", file=sys.stderr)
        print(border, file=sys.stderr)
        sys.exit(1)


def main() -> None:
    _ensure_utf8_console()

    # Inject default base URL only when the env var is not already set.
    # sundog's own --eyesonly-url flag (parsed later) will take priority.
    os.environ.setdefault("EYESONLY_BASE_URL", "http://localhost:8787/public/js")

    # Ensure vendor/sundog is importable when not installed as a package.
    base = _resolve_base_path()
    vendor_sundog = os.path.join(base, "vendor", "sundog")
    if vendor_sundog not in sys.path:
        sys.path.insert(0, vendor_sundog)

    _check_playwright_chromium()

    # Late import so the path fix above takes effect first.
    from sundog.runners.gone_rogue_headless import main as runner_main  # type: ignore[import]
    runner_main()
