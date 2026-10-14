#!/usr/bin/env bash
set -euo pipefail
# Read-only checks. Prints statuses, never application environment values.
app_container="${1:?Usage: sudo bash readiness-check.sh APP_CONTAINER POSTGRES_CONTAINER}"
database_container="${2:?Specify Mrsaal PostgreSQL, not coolify-db}"
failures=0
if ! docker exec -i -w /app "$app_container" node <<'NODE'
const env=process.env;
const checks=[
 ['production mode',env.NODE_ENV==='production'],
 ['session secret configured',String(env.SESSION_SECRET||'').length>=32],
 ['Google client configured',!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&env.GOOGLE_REDIRECT_URI)],
 ['admin allowlist configured',!!env.ADMIN_EMAILS?.trim()],
 ['WhatsApp encryption secret configured',String(env.WHATSAPP_AUTH_SECRET||'').length>=32],
 ['local AI configured',!!(env.LOCAL_AI_BASE_URL&&env.LOCAL_AI_API_KEY&&env.LOCAL_AI_MODEL)]
];
try{checks.push(['HTTPS site and callback',new URL(env.BASE_URL).protocol==='https:'&&new URL(env.GOOGLE_REDIRECT_URI).origin===new URL(env.BASE_URL).origin]);}catch{checks.push(['HTTPS site and callback',false]);}
let failed=false;for(const [label,ok]of checks){console.log((ok?'PASS ':'FAIL ')+label);if(!ok)failed=true;}
console.log(env.SUPABASE_SERVICE_ROLE_KEY?'PASS account deletion admin key configured':'WARN Supabase full deletion key not configured');
console.log('MANUAL Google publishing and verification, Supabase Confirm email/CAPTCHA, admin MFA and provider credentials must be checked in their dashboards.');
process.exitCode=failed?1:0;
NODE
then failures=$((failures+1)); fi
published_ports="$(docker port "$database_container" 5432/tcp 2>/dev/null || true)"
if [[ -n "$published_ports" ]]; then echo 'WARN PostgreSQL port is published; verify binding and firewall before public launch'; else echo 'PASS PostgreSQL port not published by Docker'; fi
if systemctl is-active --quiet mrsaal-backup.timer; then echo 'PASS backup timer active'; else echo 'FAIL backup timer inactive'; failures=$((failures+1)); fi
python3 <<'PY'
import json,pathlib,datetime
for filename,label in [('backup-status.json','backup'),('restore-status.json','restore drill')]:
 path=pathlib.Path('/var/lib/mrsaal-backup')/filename
 try:
  data=json.loads(path.read_text());print(label+': '+str(data.get('backupSucceededAt') or data.get('restoreSucceededAt') or 'unknown'))
 except (OSError,ValueError):print('WARN no recorded successful '+label)
PY
exit "$failures"
