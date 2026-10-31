#!/usr/bin/env bash
# Release-based deploys on the EC2 server (run by the GitHub workflows, or by hand for a rollback).
#
#   $ROOT/
#     releases/<id>/   one complete, never-edited copy of the code per deploy (last $KEEP_RELEASES kept)
#     shared/          server-only files, kept forever and linked into every release:
#                      .env*, secrets/, uploads*/, logs/, backend/secretAssets/
#     current -> releases/<id>   what pm2 runs (switched atomically)
#
# A deploy only switches after the new release has started and answered on a spare port (preflight); if the
# live health check still fails after the switch, it switches back automatically.
#
# Usage:
#   release.sh activate <root> <release-id> <pm2-env> <pm2-app> <port>
#   release.sh rollback <root> <pm2-env> <pm2-app> <port> [release-id]   (default: the previous release)
set -euo pipefail

ACTION="$1"
ROOT="$2"
SHARED="$ROOT/shared"
CURRENT="$ROOT/current"
KEEP_RELEASES="${KEEP_RELEASES:-5}"

log() { echo "▸ $*"; }

# Links everything in shared/ into a release (replacing whatever is at those paths).
link_shared() {
  local rel="$1"
  shopt -s nullglob dotglob
  for item in "$SHARED"/*; do
    local name
    name="$(basename "$item")"
    if [ "$name" = "backend" ]; then
      for sub in "$SHARED"/backend/*; do
        rm -rf "$rel/backend/$(basename "$sub")"
        ln -sfn "$sub" "$rel/backend/$(basename "$sub")"
      done
    else
      rm -rf "${rel:?}/$name"
      ln -sfn "$item" "$rel/$name"
    fi
  done
  shopt -u nullglob dotglob
}

# Points `current` at a release in one atomic rename.
switch_to() {
  ln -sfn "$1" "$ROOT/current.next"
  # GNU mv -T (the server); BSD mv -h on macOS. Both replace the link itself, never write into its target.
  mv -Tf "$ROOT/current.next" "$CURRENT" 2>/dev/null || mv -fh "$ROOT/current.next" "$CURRENT"
}

# Starts or reloads pm2 from `current` (zero-downtime reloads). An app of the same name running from any
# other folder is replaced, so pm2 always serves the release `current` points to.
pm2_apply() {
  local env="$1" app="$2"
  export APP_ROOT="$CURRENT" PM2_APP_NAME="$app"
  local running_cwd
  running_cwd="$(pm2 jlist 2>/dev/null | tail -n 1 | node -e '
    let s = ""; process.stdin.on("data", d => (s += d)).on("end", () => {
      const p = JSON.parse(s || "[]").find(x => x.name === process.argv[1]);
      process.stdout.write(p ? p.pm2_env.pm_cwd || "" : "");
    });' "$app" || true)"
  if [ -n "$running_cwd" ] && [ "$running_cwd" != "$CURRENT" ]; then
    log "Moving pm2 app $app from $running_cwd to $CURRENT"
    pm2 delete "$app" >/dev/null 2>&1 || true
  fi
  pm2 startOrReload "$CURRENT/backend/config/ecosystem.config.js" --env "$env" --update-env
  pm2 save >/dev/null
}

healthy() {
  local port="$1"
  for _ in $(seq 1 15); do
    curl -fsS -m 5 "http://127.0.0.1:$port/api/languages" >/dev/null 2>&1 && return 0
    sleep 2
  done
  return 1
}

# Starts the new release on a spare port (PORT + 100) and checks it answers, before any traffic moves to it.
# Catches builds that crash on start (syntax errors, missing packages, bad config) with zero downtime.
preflight() {
  local rel="$1" env="$2" port="$(( $3 + 100 ))" log="$SHARED/logs/preflight.log" ok=1
  (cd "$rel" && exec env NODE_ENV="$env" PORT="$port" node backend/server.js) >"$log" 2>&1 &
  local pid=$!
  for _ in $(seq 1 30); do
    if curl -fsS -m 3 "http://127.0.0.1:$port/api/languages" >/dev/null 2>&1; then ok=0; break; fi
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  if [ "$ok" -ne 0 ]; then
    echo "✕ The new release did not start (preflight on port $port). Last log lines:"
    tail -n 25 "$log" || true
  fi
  return "$ok"
}

# Releases newest first (by modification time), one per line.
releases_by_age() { ls -1dt "$ROOT"/releases/*/ 2>/dev/null | sed 's#/$##'; }

case "$ACTION" in
activate)
  RELEASE="$3" PM2_ENV="$4" PM2_APP="$5" PORT="$6"
  REL="$ROOT/releases/$RELEASE"
  [ -d "$REL" ] || { echo "Release $REL not found"; exit 1; }

  # Server-only files must already be in shared/ (the workflow uploads .env.<env> from GitHub secrets;
  # secrets/ such as the Firebase service account are copied there once by hand).
  if [ ! -f "$SHARED/.env.$PM2_ENV" ]; then
    echo "✕ $SHARED/.env.$PM2_ENV is missing — set the ENV_$(echo "$PM2_ENV" | tr "[:lower:]" "[:upper:]") GitHub secret or create the file on the server"
    rm -rf "$REL"
    exit 1
  fi
  mkdir -p "$SHARED/logs" "$SHARED/uploads"

  log "Linking shared files into $RELEASE"
  link_shared "$REL"

  log "Installing dependencies"
  (cd "$REL" && npm ci --omit=dev --no-audit --no-fund)

  log "Preflight: starting the new release on port $((PORT + 100))"
  if ! preflight "$REL" "$PM2_ENV" "$PORT"; then
    echo "✕ Deploy stopped — the live release was not touched"
    rm -rf "$REL" 2>/dev/null || sudo rm -rf "$REL"
    exit 1
  fi

  PREVIOUS="$(readlink "$CURRENT" 2>/dev/null || true)"
  log "Switching current → releases/$RELEASE"
  switch_to "$REL"
  touch "$REL"
  pm2_apply "$PM2_ENV" "$PM2_APP"

  if ! healthy "$PORT"; then
    echo "✕ Health check failed on port $PORT"
    if [ -n "$PREVIOUS" ]; then
      echo "↩ Rolling back to $(basename "$PREVIOUS")"
      switch_to "$PREVIOUS"
      pm2_apply "$PM2_ENV" "$PM2_APP"
      # Drop the broken release so a later rollback can never pick it.
      rm -rf "$REL" 2>/dev/null || sudo rm -rf "$REL"
    fi
    exit 1
  fi
  log "Healthy"

  # Remove releases beyond the newest $KEEP_RELEASES (never the live one).
  LIVE="$(readlink -f "$CURRENT")"
  releases_by_age | tail -n +"$((KEEP_RELEASES + 1))" | while read -r old; do
    [ "$(readlink -f "$old")" = "$LIVE" ] && continue
    rm -rf "$old" 2>/dev/null || sudo rm -rf "$old"
    log "Removed old release $(basename "$old")"
  done
  ;;

rollback)
  PM2_ENV="$3" PM2_APP="$4" PORT="$5" TARGET="${6:-}"
  LIVE="$(readlink -f "$CURRENT")"
  if [ -z "$TARGET" ]; then
    TARGET="$(releases_by_age | while read -r r; do [ "$(readlink -f "$r")" != "$LIVE" ] && basename "$r" && break; done)"
  fi
  REL="$ROOT/releases/$TARGET"
  [ -n "$TARGET" ] && [ -d "$REL" ] || { echo "No release to roll back to"; exit 1; }
  log "Rolling back $(basename "$LIVE") → $TARGET"
  link_shared "$REL"
  switch_to "$REL"
  touch "$REL"
  pm2_apply "$PM2_ENV" "$PM2_APP"
  healthy "$PORT" && log "Healthy on $TARGET" || { echo "✕ Health check failed after rollback"; exit 1; }
  ;;

*)
  echo "Unknown action: $ACTION"
  exit 1
  ;;
esac
