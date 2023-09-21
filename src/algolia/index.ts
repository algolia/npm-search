import { createNodeHttpRequester } from '@algolia/requester-node-http';
import type { SearchClient, SearchIndex } from 'algoliasearch';
import algoliasearch from 'algoliasearch';

import type { Config } from '../config';
import { httpAgent, httpsAgent, USER_AGENT } from '../utils/request';

export interface AlgoliaStore {
  mainIndex: SearchIndex;
  mainQueueIndex: SearchIndex;
  mainLostIndex: SearchIndex;
  mainNotFoundIndex: SearchIndex;
  bootstrapIndex: SearchIndex;
  bootstrapQueueIndex: SearchIndex;
  bootstrapLostIndex: SearchIndex;
  bootstrapNotFoundIndex: SearchIndex;
  oneTimeDataIndex: SearchIndex;
  periodicDataIndex: SearchIndex;
  client: SearchClient;
}

const requester = createNodeHttpRequester({
  agent: httpsAgent,
  httpAgent,
  httpsAgent,
});

function createClient({
  appId,
  apiKey,
  indexName,
}: {
  appId: string;
  apiKey: string;
  indexName: string;
}): { index: SearchIndex; client: SearchClient } {
  const client = algoliasearch(appId, apiKey, {
    requester,
  });
  client.addAlgoliaAgent(USER_AGENT);
  return {
    index: client.initIndex(indexName),
    client,
  };
}

/**
 * Prepare algolia for indexing.
 */
export async function prepare(config: Config): Promise<AlgoliaStore> {
  if (!config.apiKey) {
    throw new Error(
      'npm-search: Please provide the `apiKey` env variable and restart'
    );
  }

  // Get main index and boostrap algolia client
  const { index: mainIndex, client } = createClient(config);
  const { index: mainQueueIndex } = createClient({
    appId: config.appId,
    apiKey: config.apiKey,
    indexName: `${config.indexName}.queue`,
  });
  const { index: mainLostIndex } = createClient({
    appId: config.appId,
    apiKey: config.apiKey,
    indexName: `${config.indexName}.lost`,
  });
  const { index: mainNotFoundIndex } = createClient({
    appId: config.appId,
    apiKey: config.apiKey,
    indexName: `${config.indexName}.not-found`,
  });
  const { index: bootstrapIndex } = createClient({
    appId: config.appId,
    apiKey: config.apiKey,
    indexName: config.bootstrapIndexName,
  });
  const { index: bootstrapQueueIndex } = createClient({
    appId: config.appId,
    apiKey: config.apiKey,
    indexName: `${config.bootstrapIndexName}.queue`,
  });
  const { index: bootstrapLostIndex } = createClient({
    appId: config.appId,
    apiKey: config.apiKey,
    indexName: `${config.bootstrapIndexName}.lost`,
  });
  const { index: bootstrapNotFoundIndex } = createClient({
    appId: config.appId,
    apiKey: config.apiKey,
    indexName: `${config.bootstrapIndexName}.not-found`,
  });
  const { index: oneTimeDataIndex } = createClient({
    appId: config.appId,
    apiKey: config.apiKey,
    indexName: `${config.indexName}.one-time-data`,
  });
  const { index: periodicDataIndex } = createClient({
    appId: config.appId,
    apiKey: config.apiKey,
    indexName: `${config.indexName}.periodic-data`,
  });

  // Ensure indices exists by calling an empty setSettings()
  await mainIndex.setSettings({}).wait();
  await bootstrapIndex.setSettings({}).wait();
  await bootstrapQueueIndex
    .setSettings({
      attributesForFaceting: ['retries'],
    })
    .wait();
  await mainLostIndex.setSettings({}).wait();
  await mainNotFoundIndex.setSettings({}).wait();
  await bootstrapLostIndex.setSettings({}).wait();
  await bootstrapNotFoundIndex.setSettings({}).wait();
  await oneTimeDataIndex.setSettings({}).wait();
  await periodicDataIndex.setSettings({}).wait();

  return {
    client,
    mainIndex,
    mainQueueIndex,
    mainLostIndex,
    mainNotFoundIndex,
    bootstrapIndex,
    bootstrapQueueIndex,
    bootstrapLostIndex,
    bootstrapNotFoundIndex,
    oneTimeDataIndex,
    periodicDataIndex,
  };
}

export async function putDefaultSettings(
  index: SearchIndex,
  config: Config
): Promise<void> {
  await index.setSettings(config.indexSettings);

  await index.saveSynonyms(config.indexSynonyms, {
    replaceExistingSynonyms: true,
  });
  const { taskID } = await index.saveRules(config.indexRules, {
    replaceExistingRules: true,
  });

  await index.waitTask(taskID);
}
