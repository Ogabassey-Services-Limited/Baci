from datetime import datetime, timezone
import ipaddress
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import urlparse

paths = [
    Path('/etc/nginx/sites-enabled/cdn.ogabassey.com'),
    Path('/etc/nginx/sites-available/cdn.ogabassey.com'),
]
backup_dir = Path('/etc/nginx/backup/cdn-transformer')
marker_text = '# Images - auto-serve WebP if supported'
nginx_test_timeout_seconds = 10
default_transformer_host = '127.0.0.1'
default_transformer_port = '8095'
default_media_storage_origin = (
    'https://aivqthbxdshhltbwipbr.supabase.co/storage/v1/object/public/media'
)
hostname_pattern = re.compile(
    r'^(?:localhost|[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?'
    r'(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*)$'
)


def normalize_transformer_host(raw_host):
    host = raw_host.strip()

    if not host:
        raise SystemExit('CDN_TRANSFORMER_HOST must not be empty')

    if any(character in host for character in ';\r\n\t {}'):
        raise SystemExit(f'Invalid CDN_TRANSFORMER_HOST "{host}"')

    if host.startswith('[') and host.endswith(']'):
        host = host[1:-1]

    try:
        ip_address = ipaddress.ip_address(host)
    except ValueError:
        if hostname_pattern.fullmatch(host):
            return host
        raise SystemExit(f'Invalid CDN_TRANSFORMER_HOST "{host}"') from None

    if ip_address.version == 6:
        return f'[{ip_address.compressed}]'

    return ip_address.compressed


def get_transformer_upstream():
    host = normalize_transformer_host(
        os.environ.get('CDN_TRANSFORMER_HOST', default_transformer_host)
    )
    raw_port = os.environ.get('CDN_TRANSFORMER_PORT', default_transformer_port)

    if not re.fullmatch(r'[0-9]+', raw_port):
        raise SystemExit(
            f'Invalid CDN_TRANSFORMER_PORT "{raw_port}": expected an integer from 1 to 65535'
        )

    port = int(raw_port)
    if port < 1 or port > 65535:
        raise SystemExit(
            f'Invalid CDN_TRANSFORMER_PORT "{raw_port}": expected an integer from 1 to 65535'
        )

    return f'{host}:{port}'


def get_media_storage_origin():
    raw_origin = os.environ.get(
        'CDN_MEDIA_STORAGE_ORIGIN',
        default_media_storage_origin,
    ).strip()

    if any(character in raw_origin for character in ';\r\n\t {}'):
        raise SystemExit(f'Invalid CDN_MEDIA_STORAGE_ORIGIN "{raw_origin}"')

    parsed = urlparse(raw_origin.rstrip('/'))
    if (
        parsed.scheme != 'https'
        or not parsed.netloc
        or parsed.params
        or parsed.query
        or parsed.fragment
        or parsed.username
        or parsed.password
    ):
        raise SystemExit(f'Invalid CDN_MEDIA_STORAGE_ORIGIN "{raw_origin}"')

    if parsed.hostname is None:
        raise SystemExit(f'Invalid CDN_MEDIA_STORAGE_ORIGIN "{raw_origin}"')

    media_path = '/storage/v1/object/public/media'
    if parsed.path != media_path and not parsed.path.startswith(f'{media_path}/'):
        raise SystemExit(f'Invalid CDN_MEDIA_STORAGE_ORIGIN "{raw_origin}"')

    host = normalize_transformer_host(parsed.hostname)
    sni_host = host[1:-1] if host.startswith('[') and host.endswith(']') else host
    try:
        raw_port = parsed.port
    except ValueError as error:
        raise SystemExit(f'Invalid CDN_MEDIA_STORAGE_ORIGIN "{raw_origin}"') from error

    port = f':{raw_port}' if raw_port else ''
    return {
        'host': f'{host}{port}',
        'sni_host': sni_host,
        'url': f'https://{host}{port}{parsed.path or ""}',
    }


def build_transformer_block(upstream=None):
    if upstream is None:
        upstream = get_transformer_upstream()

    return f"""
    # Responsive image transformer for Next.js srcset variants.
    # Cloudflare reserves /cdn-cgi/image unless Image Transformations are enabled,
    # so app-generated responsive URLs use this origin-owned path instead.
    location ^~ /image/ {{
        limit_req zone=cdn_limit burst=50 nodelay;
        proxy_pass http://{upstream};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering on;
        proxy_buffer_size 16k;
        proxy_buffers 8 32k;
    }}

"""


def build_media_storage_block(origin=None):
    if origin is None:
        origin = get_media_storage_origin()

    return f"""
    # Public media bucket origin for merchant-uploaded blog assets.
    # The app persists /media/<bucket path> CDN URLs; nginx maps them to Supabase.
    location ^~ /media/ {{
        limit_req zone=cdn_limit burst=100 nodelay;
        proxy_pass {origin['url']}/;
        proxy_http_version 1.1;
        proxy_ssl_server_name on;
        proxy_ssl_name {origin['sni_host']};
        proxy_set_header Host {origin['host']};
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_hide_header Access-Control-Allow-Origin;
        proxy_hide_header Set-Cookie;
        proxy_buffering on;
        proxy_buffer_size 16k;
        proxy_buffers 8 32k;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header Access-Control-Allow-Origin "*" always;
    }}

"""


def read_config(path):
    try:
        return path.read_text(encoding='utf-8')
    except FileNotFoundError as error:
        raise SystemExit(f'{path}: config file not found') from error
    except PermissionError as error:
        raise SystemExit(f'{path}: permission denied reading config') from error


def resolve_write_path(path):
    if path.is_symlink():
        return path.resolve()
    return path


def find_marker_index(text):
    offset = 0
    for line in text.splitlines(keepends=True):
        if line.strip() == marker_text:
            return offset
        offset += len(line)
    return -1


def build_missing_route_blocks(text):
    blocks = []
    has_image_route = re.search(r'(?m)^\s*location\s+\^~\s+/image/', text)
    has_media_route = re.search(r'(?m)^\s*location\s+\^~\s+/media/', text)
    if not has_image_route:
        blocks.append(build_transformer_block())
    if not has_media_route:
        blocks.append(build_media_storage_block())
    return ''.join(blocks)


def atomic_write(path, text, file_stat):
    temp_path = path.with_name(f'.{path.name}.tmp-{os.getpid()}')
    try:
        with temp_path.open('w', encoding='utf-8') as file:
            file.write(text)
            file.flush()
            os.fsync(file.fileno())
        os.chown(temp_path, file_stat.st_uid, file_stat.st_gid)
        os.chmod(temp_path, file_stat.st_mode)
        temp_path.replace(path)
    except Exception:
        temp_path.unlink(missing_ok=True)
        raise


def validate_nginx_or_restore(path, original_text, file_stat):
    try:
        result = subprocess.run(
            ['nginx', '-t'],
            capture_output=True,
            text=True,
            check=False,
            timeout=nginx_test_timeout_seconds,
        )
    except subprocess.TimeoutExpired as error:
        atomic_write(path, original_text, file_stat)
        stdout = error.stdout or ''
        stderr = error.stderr or ''
        raise SystemExit(
            f'{path}: nginx -t timed out after {error.timeout}s; '
            'restored original config\n'
            f'stdout:\n{stdout}\n'
            f'stderr:\n{stderr}'
        ) from error
    except OSError as error:
        atomic_write(path, original_text, file_stat)
        raise SystemExit(
            f'{path}: nginx -t could not run; restored original config\n'
            f'error:\n{error}'
        ) from error

    if result.returncode == 0:
        return

    atomic_write(path, original_text, file_stat)
    message = (
        f'{path}: nginx -t failed after update; restored original config\n'
        f'stdout:\n{result.stdout}\n'
        f'stderr:\n{result.stderr}'
    )
    raise SystemExit(message)


def configure_paths(config_paths=None, config_backup_dir=None):
    if config_paths is None:
        config_paths = paths
    if config_backup_dir is None:
        config_backup_dir = backup_dir

    processed_targets = set()
    stamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
    config_backup_dir.mkdir(parents=True, exist_ok=True)

    for path in config_paths:
        target_path = resolve_write_path(path)
        if target_path in processed_targets:
            print(f'{path}: already handled via {target_path}')
            continue

        text = read_config(target_path)
        route_blocks = build_missing_route_blocks(text)
        if not route_blocks:
            print(f'{path}: already configured target={target_path}')
            processed_targets.add(target_path)
            continue

        marker_index = find_marker_index(text)
        if marker_index == -1:
            raise SystemExit(f'{path}: marker not found: {marker_text}')

        file_stat = target_path.stat()
        backup = config_backup_dir / f'{path.parent.name}-{path.name}.bak-{stamp}'
        backup.write_text(text, encoding='utf-8')
        updated_text = f'{text[:marker_index]}{route_blocks}{text[marker_index:]}'
        atomic_write(target_path, updated_text, file_stat)
        validate_nginx_or_restore(target_path, text, file_stat)
        processed_targets.add(target_path)
        print(f'{path}: configured target={target_path}, backup={backup}')


def main():
    configure_paths()


if __name__ == '__main__':
    main()
