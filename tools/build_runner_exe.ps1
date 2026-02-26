<#
.SYNOPSIS
    Builds the gone-rogue-runner.exe using PyInstaller.

.DESCRIPTION
    - Checks/initialises vendor/sundog git submodule.
    - Creates an isolated venv, installs build + runtime dependencies.
    - Packages tools/gonerogue_runner with PyInstaller (onedir mode).
    - Writes dist/gone-rogue-runner/version.txt.
    - Runs a quick sanity-check (--help).

.PARAMETER PythonVersion
    CPython launcher version to use (default: "3.11").
    The Windows Py Launcher ("py -<version>") must be installed.
#>
param(
    [string]$PythonVersion = "3.11"
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RepoRoot = $PSScriptRoot | Split-Path -Parent
Set-Location $RepoRoot

# ---------------------------------------------------------------------------
# 1. Initialise vendor/sundog submodule
# ---------------------------------------------------------------------------
Write-Host "[gone-rogue-runner] Checking vendor/sundog submodule..." -ForegroundColor Cyan

if (-not (Test-Path "vendor\sundog\.git") -and -not (Test-Path "vendor\sundog\HEAD")) {
    Write-Host "[gone-rogue-runner] Initialising submodule vendor/sundog..." -ForegroundColor Yellow
    git submodule update --init --recursive vendor/sundog
} else {
    Write-Host "[gone-rogue-runner] vendor/sundog already initialised." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# 2. Create/re-use venv
# ---------------------------------------------------------------------------
$VenvDir = ".venv_runner_build"

if (-not (Test-Path "$VenvDir\Scripts\python.exe")) {
    Write-Host "[gone-rogue-runner] Creating venv with py -$PythonVersion..." -ForegroundColor Cyan
    py "-$PythonVersion" -m venv $VenvDir
} else {
    Write-Host "[gone-rogue-runner] Re-using existing venv $VenvDir." -ForegroundColor Green
}

$Pip = "$VenvDir\Scripts\pip.exe"
$Python = "$VenvDir\Scripts\python.exe"

# ---------------------------------------------------------------------------
# 3. Install dependencies
# ---------------------------------------------------------------------------
Write-Host "[gone-rogue-runner] Upgrading pip / setuptools / wheel..." -ForegroundColor Cyan
& $Pip install --upgrade pip setuptools wheel

Write-Host "[gone-rogue-runner] Installing build requirements..." -ForegroundColor Cyan
& $Pip install -r tools\py\requirements-build.txt

Write-Host "[gone-rogue-runner] Installing runner requirements..." -ForegroundColor Cyan
& $Pip install -r tools\py\requirements-runner.txt

# ---------------------------------------------------------------------------
# 4. Install sundog (non-editable); fall back to pathex if not installable
# ---------------------------------------------------------------------------
Write-Host "[gone-rogue-runner] Attempting pip install vendor\sundog..." -ForegroundColor Cyan
try {
    & $Pip install vendor\sundog 2>&1 | Tee-Object -Variable InstallOutput
    if ($LASTEXITCODE -ne 0) { throw "pip install vendor\sundog exited $LASTEXITCODE" }
    Write-Host "[gone-rogue-runner] sundog installed via pip." -ForegroundColor Green
} catch {
    Write-Warning "[gone-rogue-runner] Could not install sundog as a package: $_"
    Write-Warning "[gone-rogue-runner] PyInstaller pathex fallback will be used instead."
}

# ---------------------------------------------------------------------------
# 5. Install Playwright Chromium
# ---------------------------------------------------------------------------
Write-Host "[gone-rogue-runner] Installing Playwright Chromium..." -ForegroundColor Cyan
& "$VenvDir\Scripts\playwright.exe" install chromium

# ---------------------------------------------------------------------------
# 6. Run PyInstaller
# ---------------------------------------------------------------------------
Write-Host "[gone-rogue-runner] Running PyInstaller..." -ForegroundColor Cyan
& $Python -m PyInstaller tools\pyinstaller\gone-rogue-runner.spec --noconfirm --clean

# ---------------------------------------------------------------------------
# 7. Write version.txt
# ---------------------------------------------------------------------------
$BuildTime  = (Get-Date -Format "o")
$EyesOnlySha = (git rev-parse HEAD 2>$null) ?? "unknown"
$SundogSha   = (git -C vendor\sundog rev-parse HEAD 2>$null) ?? "unknown"
$PythonVer   = (& $Python --version 2>&1).ToString().Trim()

$VersionContent = @"
build_time=$BuildTime
eyesonly_sha=$EyesOnlySha
sundog_sha=$SundogSha
python=$PythonVer
"@

$VersionFile = "dist\gone-rogue-runner\version.txt"
Write-Host "[gone-rogue-runner] Writing $VersionFile..." -ForegroundColor Cyan
$VersionContent | Set-Content -Path $VersionFile -Encoding UTF8

# ---------------------------------------------------------------------------
# 8. Sanity check
# ---------------------------------------------------------------------------
Write-Host "[gone-rogue-runner] Running sanity check (--help)..." -ForegroundColor Cyan
& "dist\gone-rogue-runner\gone-rogue-runner.exe" --help

Write-Host "[gone-rogue-runner] Build complete." -ForegroundColor Green
Write-Host "[gone-rogue-runner] Output: dist\gone-rogue-runner\" -ForegroundColor Green
