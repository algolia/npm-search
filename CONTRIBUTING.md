# Contributing

## Dev

```sh
cp .env.example .env
# Fill appId and apiKye

yarn
yarn build:hot
yarn dev
```

## Tests & Lint

```sh
yarn test
yarn lint
```

## Env variables

Everything in [src/config.ts](./src/config.ts) can be overriden via Env vars.
You may want to override at least in your `.env`:

- `apiKey`: [Algolia](https://www.algolia.com/) apiKey - **required**
- `appId`: [Algolia](https://www.algolia.com/) appId - _default `OFCNCOG2CU`_
- `indexName`: [Algolia](https://www.algolia.com/) indexName - _default `npm-search`_
- `DOGSTATSD_HOST`: Metrics reporting - _default `localhost`_
- `SENTRY_DSN`: Error reporting - _default `empty`_

## Releasing New Version

> This step is done by the CI

```sh
GH_TOKEN="token" yarn semantic-release --ci=false
```

## Releasing Docker

> This step is done by the CI

```sh
yarn docker:build
yarn docker:release
```

## Deploying new version

> Showing for GCP, but the image can be used anywhere

- Go to "Compute Engine > VM Instances > `name_of_the_vm`
- Edit
- Change container image with new version
- Save

## Deploying first time

> You need to replace value with `PUT_`

```sh
gcloud beta compute \
  --project=npm-search-2 instances create-with-container npm-search-3 \
  --zone=us-central1-a \
  --machine-type=e2-medium \
  --subnet=default \
  --network-tier=STANDARD \
  --metadata=google-logging-enabled=true \
  --maintenance-policy=MIGRATE \
  --service-account=PUT_YOUR_SERVICE_ACCOUNT
  --scopes=https://www.googleapis.com/auth/devstorage.read_only,https://www.googleapis.com/auth/logging.write,https://www.googleapis.com/auth/monitoring.write,https://www.googleapis.com/auth/servicecontrol,https://www.googleapis.com/auth/service.management.readonly,https://www.googleapis.com/auth/trace.append \
  --image=cos-stable-89-16108-470-1 \
  --image-project=cos-cloud \
  --boot-disk-size=10GB \
  --boot-disk-type=pd-balanced \
  --boot-disk-device-name=npm-search-3 \
  --no-shielded-secure-boot \
  --shielded-vtpm \
  --shielded-integrity-monitoring \
  --container-image=docker.io/algolia/npm-search:PUT_VERSION \
  --container-restart-policy=always \
  --container-command=node \
  --container-arg=--async-stack-traces \
  --container-arg=--max-semi-space-size=32 \
  --container-arg=--max-old-space-size=3000 \
  --container-arg=dist/index.js \
  --container-env=indexName=npm-search,bootstrapIndexName=npm-search-bootstrap,bootstrapConcurrency=40,apiKey=PUT_ALGOLIA_API_KEY,UV_THREADPOOL_SIZE=128,SENTRY_DSN=PUT_SENTRY_URL,DOGSTATSD_HOST=datadog \
  --labels=container-vm=cos-stable-89-16108-470-1 \
  --reservation-affinity=any
```
