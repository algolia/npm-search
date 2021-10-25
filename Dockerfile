# ---- Base ----
FROM node:16.12.0-alpine AS base

ENV NODE_ENV production

# Install dependencies for native deps
RUN apk add --no-cache bash python3

# Setup the app WORKDIR
WORKDIR /app

# Copy and install dependencies separately from the app's code
# To leverage Docker's cache when no dependency has change
COPY package.json yarn.lock ./

# Install dev dependencies
RUN true \
  # && yarn set version berry \
  && yarn install --production=false

# This step will invalidates cache
COPY . /app
RUN ls -lah /app

# Builds the code and reinstall node_modules in prod mode
RUN true \
  && yarn build \
  && yarn install --production=true \
  && rm -rf src/ \
  && rm -rf .yarn/

# ---- Final ----
# Resulting new, minimal image
# This image must have the minimum amount of layers
FROM node:16.12.0-alpine as final

ENV NODE_ENV production

# Do not use root to run the app
USER node

WORKDIR /app

COPY --from=base --chown=node:node /app /app

EXPOSE 8000

CMD [ "npm", "start" ]
