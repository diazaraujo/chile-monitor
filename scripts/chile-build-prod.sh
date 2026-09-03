#!/bin/bash
# Build de la imagen prod de Chile Monitor desde este checkout, con el SHA embebido en /version.json.
# Sobre NFS el "transferring context" tarda 5-10 min: correr con setsid nohup y log.
set -e
cd "$(dirname "$0")/.."
SHA=$(git rev-parse HEAD)
docker build --build-arg VITE_VARIANT=chile --build-arg GIT_SHA="$SHA" -t chile-monitor:prod -f Dockerfile .
echo "BUILD-OK $SHA"
