#!/usr/bin/env bash
set -euo pipefail
umask 077
# Restore into a newly created disposable DB; never start the restored app or channels.
source /etc/mrsaal-backup.env
: "${POSTGRES_CONTAINER:?}" "${PGUSER:?}" "${PGDATABASE:?}" "${RESTIC_REPOSITORY:?}" "${RESTIC_PASSWORD_FILE:?}"
snapshot="${1:?Usage: sudo bash verify-restore.sh SNAPSHOT_ID}"
app_container="${2:?Specify the running Mrsaal app container for an encryption-key check}"
restore_workdir="$(mktemp -d)"
restore_database="mrsaal_restore_$(date +%Y%m%d%H%M%S)_${RANDOM}"
cleanup(){ docker exec "$POSTGRES_CONTAINER" dropdb -U "$PGUSER" --if-exists "$restore_database" >/dev/null 2>&1 || true; rm -rf "$restore_workdir"; }
trap cleanup EXIT
restic restore "$snapshot" --target "$restore_workdir" --include '**/database.dump'
mapfile -t dumps < <(find "$restore_workdir" -type f -name database.dump)
[[ "${#dumps[@]}" -eq 1 ]] || { echo 'Expected one database dump in snapshot'; exit 1; }
docker exec "$POSTGRES_CONTAINER" createdb -U "$PGUSER" "$restore_database"
docker exec -i "$POSTGRES_CONTAINER" pg_restore -U "$PGUSER" --exit-on-error -d "$restore_database" < "${dumps[0]}"
docker exec -i -w /app -e PGDATABASE="$restore_database" "$app_container" node <<'NODE'
(async()=>{const {pool}=require('./utils/db');try{
 for(const table of ['users','companies','cv_profiles','email_log','gmail_accounts','support_tickets']){const result=await pool.query('SELECT COUNT(*) AS n FROM '+table);console.log(table+': '+result.rows[0].n);}
 const {unseal}=require('./utils/connection-secrets');
 for(const table of ['gmail_accounts','ai_connections']){const result=await pool.query('SELECT credentials FROM '+table+' WHERE credentials IS NOT NULL LIMIT 1');if(result.rows.length){unseal(result.rows[0].credentials);console.log('PASS '+table+' credentials decrypt with current app key');}}
 const wa=await pool.query('SELECT encrypted_value FROM whatsapp_auth LIMIT 1').catch(()=>({rows:[]}));if(wa.rows.length){const crypto=require('crypto'),bytes=Buffer.from(wa.rows[0].encrypted_value,'base64');const key=crypto.createHash('sha256').update(process.env.WHATSAPP_AUTH_SECRET).digest();const cipher=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));cipher.setAuthTag(bytes.subarray(12,28));Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]);console.log('PASS WhatsApp credentials decrypt');}
 console.log('PASS isolated database restore; no app workers or channels started');
 }catch(error){console.error('FAIL restore verification:',error.code||error.name);process.exitCode=1;}finally{await pool.end();}})();
NODE
mkdir -p /var/lib/mrsaal-backup
printf '{"restoreSucceededAt":"%s"}\n' "$(date -u +%FT%TZ)" > /var/lib/mrsaal-backup/restore-status.json
