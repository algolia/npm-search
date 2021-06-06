import type { SearchClient, SearchIndex } from 'algoliasearch';
import algoliasearch from 'algoliasearch';

import type { Config } from '../config';

function createClient({
  appId,
  apiKey,
  indexName,
}: {
  appId: string;
  apiKey: string;
  indexName: string;
}): { index: SearchIndex; client: SearchClient } {
  const client = algoliasearch(appId, apiKey);
  return {
    index: client.initIndex(indexName),
    client,
  };
}

/**
 * Prepare algolia for indexing.
 *
 * @param config
 */
async function prepare(config: Config): Promise<{
  mainIndex: SearchIndex;
  bootstrapIndex: SearchIndex;
  client: SearchClient;
}> {
  if (!config.apiKey) {
    throw new Error(
      'npm-search: Please provide the `apiKey` env variable and restart'
    );
  }

  // Get main index and boostrap algolia client
  const { index: mainIndex, client } = createClient(config);
  const { index: bootstrapIndex } = createClient({
    appId: config.appId,
    apiKey: config.apiKey,
    indexName: config.bootstrapIndexName,
  });

  // Ensure indices exists by calling an empty setSettings()
  await mainIndex.setSettings({});
  await bootstrapIndex.setSettings({});

  return {
    client,
    mainIndex,
    bootstrapIndex,
  };
}

/**
 *
 * @param index
 * @param config
 */
async function putDefaultSettings(
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

export { prepare, putDefaultSettings };
