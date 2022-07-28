# ---- Base ----
FROM node:16.16.0-alpine AS base

# ------------------
# package.json cache
# ------------------
FROM apteno/alpine-jq:2022-03-27 AS deps

# To prevent cache invalidation from changes in fields other than dependencies
COPY package.json /tmp
RUN jq 'walk(if type == "object" then with_entries(select(.key | test("^jest|prettier|eslint|semantic|dotenv|nodemon|renovate") | not)) else . end) | { name, dependencies, devDependencies, packageManager }' < /tmp/package.json > /tmp/deps.json

# ------------------
# New base image
# ------------------
FROM base as tmp

ENV IN_DOCKER true
ENV PLAYWRIGHT_BROWSERS_PATH="/ms-playwright"
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD="true"

# Setup the app WORKDIR
WORKDIR /app/tmp

# Copy and install dependencies separately from the app's code
# To leverage Docker's cache when no dependency has change
COPY --from=deps /tmp/deps.json ./package.json
COPY yarn.lock .yarnrc.yml ./
COPY .yarn .yarn

# Install dependencies for native deps
RUN apk add --no-cache bash python3

# Install dev dependencies
RUN true \
  # Use local version instead of letting yarn auto upgrade itself
  && yarn set version $(ls -d $PWD/.yarn/releases/*) \
  && yarn install

# This step will invalidates cache
COPY . ./
RUN ls -lah /app/tmp

# Builds the code and reinstall node_modules in prod mode
RUN true \
  && yarn build \
  # Finally remove all dev packages
  && yarn workspaces focus --all --production \
  && rm -rf src/ \
  && rm -rf .yarn/

# ---- Final ----
# Resulting new, minimal image
# This image must have the minimum amount of layers
FROM node:16.16.0-alpine as final

ENV NODE_ENV production

# Do not use root to run the app
USER node

WORKDIR /app

COPY --from=tmp --chown=node:node /app/tmp /app

EXPOSE 8000

CMD [ "node", "dist/src/index.js" ]
