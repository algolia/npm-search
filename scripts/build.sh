#! /bin/sh

set -e

current=$(npx json -f package.json version)
echo "Releasing: $current"
echo ""

docker build \
  -t algolia/npm-search \
  -t "algolia/npm-search:${current}" \
  .
