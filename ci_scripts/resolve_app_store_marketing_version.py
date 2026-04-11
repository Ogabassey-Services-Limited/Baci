#!/usr/bin/env python3

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from tempfile import NamedTemporaryFile


APP_STORE_CONNECT_API_BASE = "https://api.appstoreconnect.apple.com/v1"


@dataclass(frozen=True)
class AppConfig:
    app_store_connect_app_id: str | None
    info_plist_paths: tuple[str, ...]


APP_CONFIGS: dict[str, AppConfig] = {
    "apps/mobile-admin": AppConfig(
        app_store_connect_app_id="6757810806",
        info_plist_paths=(
            "apps/mobile-admin/ios/Baci/Info.plist",
            "apps/mobile-admin/ios/BaciTheEcommerceBuilder/Info.plist",
        ),
    ),
    "apps/mobile-storefront": AppConfig(
        app_store_connect_app_id=None,
        info_plist_paths=(
            "apps/mobile-storefront/ios/OgabasseyEasybuyGadgets/Info.plist",
            "apps/mobile-storefront/ios/Ogabassey/Info.plist",
        ),
    ),
}


def eprint(message: str) -> None:
    print(message, file=sys.stderr)


def base64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def load_private_key_bytes(raw_value: str) -> bytes:
    normalized = raw_value.strip()
    if "BEGIN PRIVATE KEY" in normalized:
        return normalized.encode("utf-8")

    try:
        return base64.b64decode(normalized)
    except Exception as exc:  # pragma: no cover - defensive
        raise ValueError("BACI_ASC_PRIVATE_KEY is neither PEM text nor base64") from exc


def read_der_length(der: bytes, offset: int) -> tuple[int, int]:
    first = der[offset]
    offset += 1
    if first < 0x80:
        return first, offset
    length_bytes = first & 0x7F
    return int.from_bytes(der[offset : offset + length_bytes], "big"), offset + length_bytes


def decode_der_signature(der_signature: bytes) -> tuple[int, int]:
    if not der_signature or der_signature[0] != 0x30:
        raise ValueError("Invalid DER signature sequence")

    _, offset = read_der_length(der_signature, 1)
    if der_signature[offset] != 0x02:
        raise ValueError("Invalid DER signature integer (r)")
    r_length, offset = read_der_length(der_signature, offset + 1)
    r = int.from_bytes(der_signature[offset : offset + r_length], "big")
    offset += r_length

    if der_signature[offset] != 0x02:
        raise ValueError("Invalid DER signature integer (s)")
    s_length, offset = read_der_length(der_signature, offset + 1)
    s = int.from_bytes(der_signature[offset : offset + s_length], "big")
    return r, s


def sign_es256(message: bytes, private_key_bytes: bytes) -> bytes:
    with NamedTemporaryFile("wb", delete=True) as key_file:
        key_file.write(private_key_bytes)
        key_file.flush()
        process = subprocess.run(
            [
                "openssl",
                "dgst",
                "-sha256",
                "-sign",
                key_file.name,
            ],
            input=message,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )

    if process.returncode != 0:
        raise RuntimeError(
            f"openssl failed to sign App Store Connect token: {process.stderr.decode('utf-8', errors='replace')}"
        )

    r, s = decode_der_signature(process.stdout)
    return r.to_bytes(32, "big") + s.to_bytes(32, "big")


def build_jwt(key_id: str, issuer_id: str, private_key_bytes: bytes) -> str:
    now = int(time.time())
    header = {"alg": "ES256", "kid": key_id, "typ": "JWT"}
    payload = {
        "iss": issuer_id,
        "iat": now,
        "exp": now + 19 * 60,
        "aud": "appstoreconnect-v1",
    }
    header_b64 = base64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = base64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature_b64 = base64url_encode(sign_es256(signing_input, private_key_bytes))
    return f"{header_b64}.{payload_b64}.{signature_b64}"


def parse_version(version: str) -> tuple[int, int, int]:
    parts = version.split(".")
    if len(parts) != 3 or any(not part.isdigit() for part in parts):
        raise ValueError(f"Invalid semantic version: {version}")
    return tuple(int(part) for part in parts)  # type: ignore[return-value]


def format_version(parts: tuple[int, int, int]) -> str:
    return ".".join(str(part) for part in parts)


def bump_version(version: str, strategy: str) -> str:
    major, minor, patch = parse_version(version)
    if strategy == "major":
        return format_version((major + 1, 0, 0))
    if strategy == "minor":
        return format_version((major, minor + 1, 0))
    return format_version((major, minor, patch + 1))


def compare_versions(left: str, right: str) -> int:
    left_parts = parse_version(left)
    right_parts = parse_version(right)
    if left_parts < right_parts:
        return -1
    if left_parts > right_parts:
        return 1
    return 0


def api_get(url: str, token: str) -> dict:
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def resolve_app_store_connect_app_id(app_dir: str) -> str | None:
    if env_value := os.getenv("CI_APP_STORE_CONNECT_APP_ID"):
        return env_value
    if env_value := os.getenv("ASC_APP_ID"):
        return env_value
    config = APP_CONFIGS.get(app_dir)
    return config.app_store_connect_app_id if config else None


def resolve_info_plist_path(app_dir: str) -> Path:
    config = APP_CONFIGS.get(app_dir)
    if not config:
        raise ValueError(f"Unsupported app_dir for repo version resolution: {app_dir}")

    for candidate in config.info_plist_paths:
        candidate_path = Path(candidate)
        if candidate_path.exists():
            return candidate_path

    raise ValueError(
        f"Info.plist not found for {app_dir}. Checked: {', '.join(config.info_plist_paths)}"
    )


def fetch_latest_app_store_version(token: str, app_id: str) -> str | None:
    query = urllib.parse.urlencode(
        {
            "filter[app]": app_id,
            "limit": "200",
            "sort": "-versionString",
            "fields[appStoreVersions]": "versionString,appStoreState",
        }
    )
    payload = api_get(f"{APP_STORE_CONNECT_API_BASE}/appStoreVersions?{query}", token)
    versions = []
    for item in payload.get("data", []):
        attributes = item.get("attributes", {})
        version_string = attributes.get("versionString")
        if not version_string:
            continue
        try:
            parse_version(version_string)
        except ValueError:
            continue
        versions.append(version_string)

    if not versions:
        return None

    versions.sort(key=parse_version, reverse=True)
    return versions[0]


def current_repo_version(app_dir: str) -> str:
    plist_path = resolve_info_plist_path(app_dir)

    content = plist_path.read_text(encoding="utf-8")
    marker = "<key>CFBundleShortVersionString</key>"
    if marker not in content:
        raise ValueError(f"CFBundleShortVersionString missing in {plist_path}")

    tail = content.split(marker, 1)[1]
    start = tail.find("<string>")
    end = tail.find("</string>", start)
    if start == -1 or end == -1:
        raise ValueError(f"Unable to parse CFBundleShortVersionString from {plist_path}")

    return tail[start + 8 : end].strip()


def resolve_marketing_version(app_dir: str) -> str:
    if explicit_version := os.getenv("CI_MARKETING_VERSION"):
        return explicit_version

    repo_version = current_repo_version(app_dir)
    bump_strategy = os.getenv("CI_MARKETING_BUMP", "patch").strip().lower() or "patch"
    if bump_strategy not in {"patch", "minor", "major"}:
        raise ValueError(
            f"Invalid CI_MARKETING_BUMP '{bump_strategy}'. Expected patch, minor, or major."
        )

    key_id = os.getenv("BACI_ASC_KEY_ID", "").strip()
    issuer_id = os.getenv("BACI_ASC_ISSUER_ID", "").strip()
    private_key_raw = os.getenv("BACI_ASC_PRIVATE_KEY", "").strip()
    app_store_connect_app_id = resolve_app_store_connect_app_id(app_dir)

    if not key_id or not issuer_id or not private_key_raw or not app_store_connect_app_id:
        missing = []
        if not key_id:
            missing.append("BACI_ASC_KEY_ID")
        if not issuer_id:
            missing.append("BACI_ASC_ISSUER_ID")
        if not private_key_raw:
            missing.append("BACI_ASC_PRIVATE_KEY")
        if not app_store_connect_app_id:
            missing.append("CI_APP_STORE_CONNECT_APP_ID/ASC_APP_ID")
        eprint(
            "warning: App Store Connect version lookup skipped because these values are missing: "
            + ", ".join(missing)
        )
        return repo_version

    try:
        token = build_jwt(key_id, issuer_id, load_private_key_bytes(private_key_raw))
        latest_version = fetch_latest_app_store_version(token, app_store_connect_app_id)
    except Exception as exc:
        eprint(f"warning: App Store Connect version lookup failed ({exc}); using repo version.")
        return repo_version

    if latest_version is None:
        eprint("warning: App Store Connect returned no existing app store versions; using repo version.")
        return repo_version

    if compare_versions(repo_version, latest_version) > 0:
        return repo_version

    return bump_version(latest_version, bump_strategy)


def main() -> int:
    app_dir = sys.argv[1] if len(sys.argv) > 1 else os.getenv("CI_APP_DIR", "").strip()
    if not app_dir:
        eprint("error: app_dir argument is required")
        return 1

    if app_dir not in APP_CONFIGS:
        eprint(f"error: Unsupported app_dir '{app_dir}'")
        return 1

    try:
        resolved_version = resolve_marketing_version(app_dir)
    except Exception as exc:
        eprint(f"error: Unable to resolve marketing version: {exc}")
        return 1

    print(resolved_version)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
