#!/usr/bin/env bash
set -euo pipefail
umask 077
trial_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
command -v docker >/dev/null
command -v python3 >/dev/null
# Never overwrite an existing key or volume. Only this project's .env is created.
python3 - "$trial_dir/.env" <<'PY'
from pathlib import Path
import secrets,sys
path=Path(sys.argv[1])
if not path.exists():
    with path.open('x') as f:
        f.write('OPENWA_MASTER_KEY='+secrets.token_hex(32)+'\nOPENWA_DOCKER_NETWORK=coolify\n')
    path.chmod(0o600)
    print('Local secret file created (mode 600). Its value is not printed.')
else:
    print('Existing local configuration kept.')
PY
docker compose --project-directory "$trial_dir" --env-file "$trial_dir/.env" -f "$trial_dir/compose.yaml" config --quiet
docker compose --project-directory "$trial_dir" --env-file "$trial_dir/.env" -f "$trial_dir/compose.yaml" up -d --build
docker compose --project-directory "$trial_dir" --env-file "$trial_dir/.env" -f "$trial_dir/compose.yaml" ps
printf 'Dashboard is bound to 127.0.0.1:2785. Use an SSH tunnel; no public port was opened.\n'
