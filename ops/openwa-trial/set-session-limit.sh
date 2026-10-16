#!/usr/bin/env bash
set -euo pipefail
umask 077

limit="${1:?Usage: set-session-limit.sh 0 (unlimited) or 1..50}"
if [[ ! "$limit" =~ ^(0|[1-9]|[1-4][0-9]|50)$ ]]; then
  echo 'Use 0 for unlimited or an integer from 1 to 50.' >&2
  exit 1
fi
folder="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
test -f "$folder/.env"
test -f "$folder/compose.yaml"
python3 - "$folder" "$limit" <<'PY'
from pathlib import Path
from datetime import datetime
import re, shutil, sys
folder=Path(sys.argv[1]); limit=sys.argv[2]
if 'MRSAALWA_MAX_SESSIONS' not in (folder/'compose.yaml').read_text():
    raise SystemExit('Compose does not expose MRSAALWA_MAX_SESSIONS; no change made.')
p=folder/'.env'; text=p.read_text()
pattern=r'(?m)^[ \t]*MRSAALWA_MAX_SESSIONS[ \t]*=.*$'
if len(re.findall(pattern,text))>1:
    raise SystemExit('Duplicate session-limit settings; no change made.')
backup=p.with_name('.env.before-session-limit-'+datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
shutil.copy2(p,backup); backup.chmod(0o600)
text=re.sub(pattern,'MRSAALWA_MAX_SESSIONS='+limit,text) if re.search(pattern,text) else text.rstrip()+'\nMRSAALWA_MAX_SESSIONS='+limit+'\n'
p.write_text(text);p.chmod(0o600)
print('Session limit saved. Existing secrets and network settings preserved.')
PY
docker compose --project-directory "$folder" --env-file "$folder/.env" -f "$folder/compose.yaml" up -d --no-build openwa-trial
docker compose --project-directory "$folder" --env-file "$folder/.env" -f "$folder/compose.yaml" ps openwa-trial
