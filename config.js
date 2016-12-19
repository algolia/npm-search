const defaultConfig = {
  npmRegistryEndpoint: 'https://replicate.npmjs.com/registry',
  npmDownloadsEndpoint: 'https://api.npmjs.org/downloads',
  popularDownloadsRatio: 0.2,
  appId: 'OFCNCOG2CU',
  apiKey: '',
  indexName: 'npm-search',
  concurrency: 200,
  seq: null,
};

export default Object
  .entries(defaultConfig)
  .reduce((res, [key, defaultValue]) => ({
    ...res,
    [key]: key in process.env ?
      JSON.parse(
        typeof defaultValue === 'string' ?
          `"${process.env[key]}"`
          : process.env[key]
      )
      : defaultValue,
  }), {});
