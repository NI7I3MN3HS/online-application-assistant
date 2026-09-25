#!/usr/bin/env python3
"""Build and verify a self-contained unpacked-extension ZIP with no dependencies."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile
from datetime import date, datetime
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parent.parent
PACKAGE_FOLDER = "online-application-assistant"
RUNTIME_DIRECTORIES = ("src", "icons", "vendor")
DOCUMENTS = (
    "manifest.json",
    "README.md",
    "README.en.md",
    "LICENSE",
    "sample-profile.json",
    "assets/logo.png",
    "docs/application-records.md",
    "docs/resume-parser-selection.md",
    "docs/development.md",
    "docs/development.en.md",
)
EXCLUDED_DIRECTORIES = {"node_modules", "__pycache__", "coverage", "dist", "build"}
REQUIRED_ASSETS = (
    "src/applications.html",
    "src/shell.js",
    "src/ui.css",
    "vendor/checksums.json",
    "vendor/THIRD_PARTY_NOTICES.md",
    "vendor/paddle/ch_PP-OCRv4_det_infer.onnx",
    "vendor/paddle/ch_PP-OCRv4_rec_infer.onnx",
    "vendor/paddle/ort-wasm-simd-threaded.wasm",
    "vendor/paddle/ppocr_keys_v1.txt",
    "vendor/fonts/cormorant.css",
    "vendor/fonts/jakarta.css",
    "vendor/fonts/noto-serif-sc.css",
    "vendor/fonts/cormorant-OFL.txt",
    "vendor/fonts/jakarta-OFL.txt",
    "vendor/fonts/noto-serif-sc-OFL.txt",
)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def collect_files():
    files = {ROOT / name for name in DOCUMENTS}
    for directory in RUNTIME_DIRECTORIES:
        base = ROOT / directory
        if base.is_symlink() or not base.is_dir():
            raise ValueError(f"Expected runtime directory: {base}")
        for path in base.rglob("*"):
            if path.is_symlink():
                raise ValueError(f"Symlinks are not packaged: {path}")
            parts = path.relative_to(ROOT).parts
            if any(part.startswith(".") or part in EXCLUDED_DIRECTORIES for part in parts):
                continue
            if path.is_file() and path.suffix not in {".log", ".pyc", ".tmp", ".bak"}:
                files.add(path)
    for path in files:
        if path.is_symlink() or not path.is_file():
            raise ValueError(f"Missing or unsafe release file: {path}")
    return sorted(files)


def validate_inputs(files):
    manifest = read_json(ROOT / "manifest.json")
    package = read_json(ROOT / "package.json")
    lock = read_json(ROOT / "package-lock.json")
    version = manifest["version"]
    if {version, package["version"], lock["version"], lock["packages"][""]["version"]} != {version}:
        raise ValueError("manifest.json, package.json and package-lock.json versions must match")

    included = {path.relative_to(ROOT).as_posix() for path in files}
    required = set(REQUIRED_ASSETS)
    required.update(manifest.get("icons", {}).values())
    required.update(manifest.get("action", {}).get("default_icon", {}).values())
    required.update((
        manifest["background"]["service_worker"],
        manifest["action"]["default_popup"],
        manifest["options_page"],
    ))
    if required - included:
        raise ValueError(f"Missing runtime assets: {sorted(required - included)}")

    checksums = read_json(ROOT / "vendor/checksums.json")
    for relative, expected in checksums.items():
        name = f"vendor/{relative}"
        if name not in included or sha256((ROOT / name).read_bytes()) != expected:
            raise ValueError(f"Vendored asset checksum mismatch: {name}")

    # Check all bundled font files and licenses, including newly added families.
    import re
    for path in sorted((ROOT / "vendor/fonts").glob("*.css")):
        for url in re.findall(r"url\(['\"]?([^)'\"]+)", path.read_text(encoding="utf-8")):
            asset = path.parent / url
            if not asset.is_file() or asset.relative_to(ROOT).as_posix() not in included:
                raise ValueError(f"Missing bundled font referenced by {path.name}: {url}")
    return version


def build(release_date):
    files = collect_files()
    version = validate_inputs(files)
    destination = ROOT / "dist"
    destination.mkdir(exist_ok=True)
    archive = destination / f"{PACKAGE_FOLDER}-v{version}-{release_date:%Y%m%d}.zip"
    timestamp = (release_date.year, release_date.month, release_date.day, 0, 0, 0)
    descriptor, temporary = tempfile.mkstemp(prefix=".release-", suffix=".zip", dir=destination)
    os.close(descriptor)
    temporary = Path(temporary)
    hashes = {}
    try:
        with ZipFile(temporary, "w", compression=ZIP_DEFLATED, compresslevel=9) as package:
            for path in files:
                name = f"{PACKAGE_FOLDER}/{path.relative_to(ROOT).as_posix()}"
                content = path.read_bytes()
                hashes[name] = sha256(content)
                entry = ZipInfo(name, date_time=timestamp)
                entry.create_system = 3
                entry.external_attr = 0o100644 << 16
                package.writestr(entry, content, compress_type=ZIP_DEFLATED, compresslevel=9)

        with ZipFile(temporary) as package:
            if package.namelist() != list(hashes) or package.testzip() is not None:
                raise ValueError("ZIP file list or CRC verification failed")
            for name, expected in hashes.items():
                relative = name.removeprefix(f"{PACKAGE_FOLDER}/")
                if sha256(package.read(name)) != expected or sha256((ROOT / relative).read_bytes()) != expected:
                    raise ValueError(f"Archive differs from current source: {relative}")
            packed_manifest = json.loads(package.read(f"{PACKAGE_FOLDER}/manifest.json"))
            if packed_manifest["version"] != version:
                raise ValueError("Packaged manifest version does not match")

        digest = sha256(temporary.read_bytes())
        temporary.replace(archive)
        checksum = archive.with_suffix(".zip.sha256")
        checksum.write_text(f"{digest}  {archive.name}\n", encoding="utf-8")
        print(f"Version: {version}")
        print(f"Archive: {archive}")
        print(f"Files: {len(files)}; size: {archive.stat().st_size:,} bytes")
        print(f"SHA-256: {digest}")
        print(f"Checksum file: {checksum}")
        print("Verified: dependency checksums, bundled fonts, manifest, ZIP CRC and every packaged file.")
    finally:
        temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", default=date.today().strftime("%Y%m%d"), help="Release date (YYYYMMDD); defaults to today")
    args = parser.parse_args()
    try:
        release_date = datetime.strptime(args.date, "%Y%m%d").date()
        if not 1980 <= release_date.year <= 2107:
            raise ValueError("Release date must fit the ZIP timestamp range (1980–2107)")
        build(release_date)
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, f"Packaging failed: {error}\n")


if __name__ == "__main__":
    main()
