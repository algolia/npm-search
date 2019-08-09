FROM node:12.7.0 AS base

ENV NODE_ENV production

WORKDIR /app/npmsearch

COPY . /app/npmsearch

RUN yarn install --production=true
