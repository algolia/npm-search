import { createNodeHttpRequester } from '@algolia/requester-node-http';
import type { SearchClient, SearchIndex } from 'algoliasearch';
import algoliasearch from 'algoliasearch';

import type { Config } from '../config';
import { httpAgent, httpsAgent, USER_AGENT } from '../utils/request';

export interface AlgoliaStore {
  mainIndex: SearchIndex;
  mainLostIndex: SearchIndex;
  bootstrapIndex: SearchIndex;
  bootstrapLostIndex: SearchIndex;
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
  const { index: mainLostIndex } = createClient({
    appId: config.appId,
    apiKey: config.apiKey,
    indexName: `${config.indexName}.lost`,
  });
  const { index: bootstrapIndex } = createClient({
    appId: config.appId,
    apiKey: config.apiKey,
    indexName: config.bootstrapIndexName,
  });
  const { index: bootstrapLostIndex } = createClient({
    appId: config.appId,
    apiKey: config.apiKey,
    indexName: `${config.bootstrapIndexName}.lost`,
  });

  // Ensure indices exists by calling an empty setSettings()
  await mainIndex.setSettings({}).wait();
  await bootstrapIndex.setSettings({}).wait();
  await mainLostIndex.setSettings({}).wait();
  await bootstrapLostIndex.setSettings({}).wait();

  return {
    client,
    mainIndex,
    mainLostIndex,
    bootstrapIndex,
    bootstrapLostIndex,
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
