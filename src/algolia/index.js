import algoliasearch from 'algoliasearch';

function createClient(appId, apiKey, indexName) {
  if (!apiKey)
    throw new Error(
      'npm-search: Please provide the `apiKey` env variable and restart'
    );

  const client = algoliasearch(appId, apiKey);
  return {
    index: client.initIndex(indexName),
    client,
  };
}

/**
 * Prepare algolia for indexing
 * @param {object} config
 */
async function prepare(config) {
  // Get main index and boostrap algolia client
  const { index: mainIndex, client } = createClient(
    config.appId,
    config.apiKey,
    config.indexName
  );
  const { index: bootstrapIndex } = createClient(
    config.appId,
    config.apiKey,
    config.bootstrapIndexName
  );

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
 * @param {AlgoliasearchIndex} index
 * @param {object} config
 */
async function putDefaultSettings(index, config) {
  await index.setSettings(config.indexSettings);

  await index.batchSynonyms(config.indexSynonyms, {
    replaceExistingSynonyms: true,
  });
  const { taskID } = await index.batchRules(config.indexRules, {
    replaceExistingRules: true,
  });

  await index.waitTask(taskID);
}

export { prepare, putDefaultSettings };
