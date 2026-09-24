#!/bin/sh
# Run on the existing Monitor Municipios credential host. No secrets cross SSH.
set -eu
: "${MUNICIPIOS_REPO:?Set the existing Monitor Municipios checkout}"
: "${WM_SEED_ENV_FILE:?Set its existing environment file}"
: "${MUNICIPIOS_OUTPUT:?Set the local public snapshot path}"
: "${MUNICIPIOS_REMOTE:?Set the existing SSH host alias}"
: "${MUNICIPIOS_REMOTE_DIR:?Set the remote public/chile directory}"
: "${MUNICIPIOS_NODE:=node}"
case "$MUNICIPIOS_REMOTE_DIR" in *[!a-zA-Z0-9/_-]*) exit 2;; esac
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
"$MUNICIPIOS_NODE" "$script_dir/chile-export-municipios.mjs" "$MUNICIPIOS_OUTPUT"
scp -q -o BatchMode=yes -o ConnectTimeout=15 "$MUNICIPIOS_OUTPUT" "$MUNICIPIOS_REMOTE:$MUNICIPIOS_REMOTE_DIR/municipios-13108.json.incoming"
ssh -o BatchMode=yes -o ConnectTimeout=15 "$MUNICIPIOS_REMOTE" "mv '$MUNICIPIOS_REMOTE_DIR/municipios-13108.json.incoming' '$MUNICIPIOS_REMOTE_DIR/municipios-13108.json'"
