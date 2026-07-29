#!/usr/bin/env bash
# One-shot operator script: submit the master index into the PROD import queue over an SSH tunnel.
#
#   bash run-prod-submit.sh [--limit N] [--dry-run]
#
# Prereqs: ssh key ~/.ssh/beecompete_admin, tools/seeding/.env with ANTHROPIC_API_KEY.
# The prod Spring API is not publicly exposed; this reaches it via a socat relay container
# on the VPS loopback (127.0.0.1:18080) + an SSH -L tunnel. ADMIN_API_TOKEN is read from the
# VPS prod .env at runtime and never written to disk here.
set -euo pipefail
cd "$(dirname "$0")"

VPS="root@74.208.212.158"
KEY="$HOME/.ssh/beecompete_admin"
LOCAL_PORT=18080
INDEX="../../docs/seeding/master-index.csv"
LOG="submit-$(date +%Y%m%d-%H%M%S).log"
EXTRA_ARGS=("$@")

ssh_vps() { ssh -i "$KEY" -o BatchMode=yes "$VPS" "$@"; }

echo "[1/6] Ensuring socat relay container on VPS loopback..."
ssh_vps 'docker inspect seed-relay >/dev/null 2>&1 || docker run -d --name seed-relay \
  --network beecompete-prod_internal -p 127.0.0.1:18080:8080 \
  alpine/socat TCP-LISTEN:8080,fork,reuseaddr TCP:api:8080'

echo "[2/6] Opening SSH tunnel localhost:${LOCAL_PORT} -> VPS loopback..."
if ! curl -s -o /dev/null --max-time 2 "http://localhost:${LOCAL_PORT}/actuator/health"; then
  ssh -f -N -o ExitOnForwardFailure=yes -o BatchMode=yes -i "$KEY" \
    -L "${LOCAL_PORT}:127.0.0.1:18080" "$VPS"
fi

echo "[3/6] Health gate (fails while the Neon quota is still exhausted)..."
HEALTH=$(curl -s --max-time 30 "http://localhost:${LOCAL_PORT}/actuator/health" || true)
if ! echo "$HEALTH" | grep -q '"UP"'; then
  echo "ABORT: prod API health is not UP: ${HEALTH:-<no response>}"
  echo "If this is before Aug 1, the Neon free-tier compute quota is likely still exhausted."
  exit 1
fi

echo "[4/6] Reading ADMIN_API_TOKEN from VPS prod .env (kept in memory only)..."
ADMIN_API_TOKEN=$(ssh_vps "grep '^ADMIN_API_TOKEN=' /home/deploy/beecompete-prod/.env | cut -d= -f2-")
[ -n "$ADMIN_API_TOKEN" ] || { echo "ABORT: no ADMIN_API_TOKEN on VPS"; exit 1; }
export ADMIN_API_TOKEN
export BEECOMPETE_API_BASE="http://localhost:${LOCAL_PORT}"

echo "[5/6] Building run CSV, skipping URLs already PENDING in the queue (rerun-safe)..."
PENDING=$(mktemp)
page=0
while :; do
  RESP=$(curl -s --max-time 30 -H "x-admin-token: ${ADMIN_API_TOKEN}" \
    "${BEECOMPETE_API_BASE}/api/v1/admin/import-records?status=PENDING&size=100&page=${page}")
  echo "$RESP" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const j=JSON.parse(d);j.content.forEach(r=>console.log(r.sourceUrl));process.exit(j.last?2:0)})' >>"$PENDING" && { page=$((page+1)); continue; } || break
done
RUN_CSV=$(mktemp --suffix=.csv)
node -e '
const fs=require("fs");
const pending=new Set(fs.readFileSync(process.argv[1],"utf8").split(/\r?\n/).filter(Boolean)
  .map(u=>u.replace(/\/+$/,"")));
const lines=fs.readFileSync(process.argv[2],"utf8").split(/\r?\n/).filter(Boolean);
const out=[lines[0]];
let skipped=0;
for(const line of lines.slice(1)){
  const m=line.match(/https?:\/\/[^,"]+/);
  if(m&&pending.has(m[0].replace(/\/+$/,""))){skipped++;continue;}
  out.push(line);
}
fs.writeFileSync(process.argv[3],out.join("\n")+"\n");
console.error(`queue already PENDING: ${pending.size} url(s); skipped ${skipped} matching row(s); ${out.length-1} row(s) to run`);
' "$PENDING" "$INDEX" "$RUN_CSV"

echo "[6/6] Running the S3 pipeline (SUBMIT mode) — log: ${LOG}"
node --env-file=.env --import tsx src/index.ts --batch "$RUN_CSV" "${EXTRA_ARGS[@]}" 2>&1 | tee "$LOG"

echo "Done. Tunnel left open; close with: taskkill on the ssh process, or just reboot."
echo "Optional VPS cleanup: ssh -i $KEY $VPS 'docker rm -f seed-relay'"
