"""Crontab construction for the remediation transition transaction."""

import shlex


def is_legacy_owned(line, remote_dir, node_bin, targets):
    for name, schedule, wait in targets:
        prefix = f"{schedule} flock -n {remote_dir}/locks/{name}.lock bash -lc '"
        suffix = f"{node_bin} {remote_dir}/jobs/{name}.mjs' >> {remote_dir}/logs/{name}.log 2>&1"
        if line.startswith(prefix) and line.endswith(suffix) and f'cd {remote_dir} && ' in line:
            return True
        prefix = f"{schedule} flock -n {remote_dir}/locks/{name}.lock flock {wait}"
        if (
            line.startswith(f'{prefix} {remote_dir}/locks/error-remediator-global.lock bash -lc \'')
            or line.startswith(f'{prefix} -E 75 {remote_dir}/locks/error-remediator-global.lock bash -lc \'')
        ) and line.endswith(suffix) and f'cd {remote_dir} && ' in line:
            return True
    return False


def transition_crontab(
    original, remote_dir, node_bin, codex_image, codex_container_bin, targets, block_start, block_end
):
    retained = []
    lines = original.splitlines()
    index = 0
    while index < len(lines):
        line = lines[index]
        if line == block_start:
            try:
                index = lines.index(block_end, index + 1) + 1
            except ValueError as error:
                raise RuntimeError('unterminated owned remediation cron block') from error
            continue
        if line == block_end:
            raise RuntimeError('unexpected remediation cron block terminator')
        if not is_legacy_owned(line, remote_dir, node_bin, targets):
            retained.append(line)
        index += 1
    while retained and not retained[-1].strip():
        retained.pop()
    remote = shlex.quote(remote_dir)
    command = (
        f'export BACI_CODEX_DOCKER_IMAGE={shlex.quote(codex_image)} '
        f'BACI_CODEX_CONTAINER_BIN={shlex.quote(codex_container_bin)} '
        f'&& cd {remote} && exec flock -F '
    )
    block = [block_start]
    for name, schedule, wait in targets:
        payload = (
            f'{command}{wait} -E 75 {remote}/locks/error-remediator-global.lock '
            f'{shlex.quote(node_bin)} {remote}/jobs/{name}.mjs'
        )
        block.append(
            f'{schedule} flock -n {remote}/locks/{name}.lock bash -lc {shlex.quote(payload)} '
            f'>> {remote}/logs/{name}.log 2>&1'
        )
    block.append(block_end)
    return '\n'.join([*retained, *([''] if retained else []), *block]).replace('%', r'\%') + '\n'
