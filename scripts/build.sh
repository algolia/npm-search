#! /bin/sh

set -e

current=$(node -e "console.log(require('./package.json').version)")
echo "Releasing: $current"
echo ""

docker build \
	--platform linux/amd64 \
	-t algolia/npm-search \
	-t "algolia/npm-search:${current}" \
	.
