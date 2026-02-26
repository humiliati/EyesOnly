# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for gone-rogue-runner (onedir, Windows .exe).

Build with:
    pyinstaller tools\\pyinstaller\\gone-rogue-runner.spec --noconfirm --clean
"""

import os

# Repo root is two levels above this spec file.
_spec_dir = os.path.dirname(os.path.abspath(SPEC))  # noqa: F821
_repo_root = os.path.dirname(os.path.dirname(_spec_dir))
_vendor_sundog = os.path.join(_repo_root, "vendor", "sundog")

block_cipher = None

a = Analysis(
    [os.path.join(_repo_root, "tools", "gonerogue_runner", "__main__.py")],
    pathex=[_repo_root, _vendor_sundog],
    binaries=[],
    datas=[
        (
            os.path.join(
                _vendor_sundog,
                "runners",
                "adapters",
                "gone_rogue_harness.html",
            ),
            os.path.join("sundog", "runners", "adapters"),
        ),
    ],
    hiddenimports=[
        "sundog.runners",
        "sundog.runners.headless",
        "sundog.runners.gone_rogue_headless",
        "sundog.runners.gone_rogue_ui",
        "sundog.runners.game",
        "sundog.runners.engine",
        "sundog.runners.policy",
        "sundog.runners.telemetry",
        "sundog.runners.adapters",
        "sundog.runners.adapters.gone_rogue",
        "sundog.runners.policies",
        "sundog.runners.policies.greedy",
        "sundog.runners.policies.gone_rogue_greedy",
        "playwright",
        "playwright.sync_api",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "scipy", "numpy"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)  # noqa: F821

exe = EXE(  # noqa: F821
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="gone-rogue-runner",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)

coll = COLLECT(  # noqa: F821
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="gone-rogue-runner",
)
