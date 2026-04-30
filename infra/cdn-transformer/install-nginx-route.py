from datetime import datetime, timezone
import os
from pathlib import Path
import subprocess

paths = [
    Path('/etc/nginx/sites-enabled/cdn.ogabassey.com'),
    Path('/etc/nginx/sites-available/cdn.ogabassey.com'),
]
backup_dir = Path('/etc/nginx/backup/cdn-transformer')
marker_text = '# Images - auto-serve WebP if supported'

block = """
    # Responsive image transformer for Next.js srcset variants.
    # Cloudflare reserves /cdn-cgi/image unless Image Transformations are enabled,
    # so app-generated responsive URLs use this origin-owned path instead.
    location ^~ /image/ {
        limit_req zone=cdn_limit burst=50 nodelay;
        proxy_pass http://127.0.0.1:8095;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering on;
        proxy_buffer_size 16k;
        proxy_buffers 8 32k;
    }

"""


def read_config(path):
    try:
        return path.read_text(encoding='utf-8')
    except FileNotFoundError as error:
        raise SystemExit(f'{path}: config file not found') from error
    except PermissionError as error:
        raise SystemExit(f'{path}: permission denied reading config') from error


def find_marker_index(text):
    offset = 0
    for line in text.splitlines(keepends=True):
        if line.strip() == marker_text:
            return offset
        offset += len(line)
    return -1


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
    result = subprocess.run(['nginx', '-t'], capture_output=True, text=True, check=False)
    if result.returncode == 0:
        return

    atomic_write(path, original_text, file_stat)
    message = (
        f'{path}: nginx -t failed after update; restored original config\n'
        f'stdout:\n{result.stdout}\n'
        f'stderr:\n{result.stderr}'
    )
    raise SystemExit(message)


stamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
backup_dir.mkdir(parents=True, exist_ok=True)

for path in paths:
    text = read_config(path)
    if 'location ^~ /image/' in text:
        print(f'{path}: already configured')
        continue

    marker_index = find_marker_index(text)
    if marker_index == -1:
        raise SystemExit(f'{path}: marker not found: {marker_text}')

    file_stat = path.stat()
    backup = backup_dir / f'{path.parent.name}-{path.name}.bak-{stamp}'
    backup.write_text(text, encoding='utf-8')
    updated_text = f'{text[:marker_index]}{block}{text[marker_index:]}'
    atomic_write(path, updated_text, file_stat)
    validate_nginx_or_restore(path, text, file_stat)
    print(f'{path}: configured, backup={backup}')
