const defaultConfig = {
  registryEndpoint: 'http://registry.npmjs.org',
  appId: 'OFCNCOG2CU',
  apiKey: '',
  indexName: 'npm-search',
  maximumConcurrency: 200,
  reset: false,
  connectTimeout: 60 * 1000,
  writeTimeout: 60 * 1000,
  readTimeout: 60 * 1000,
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
