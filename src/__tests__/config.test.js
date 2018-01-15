import config from '../config';

it('gets the correct keys from env variables', () => {
  // from mocked .env
  expect(config.apiKey).toBe('fake-api-key');
  // from config.js
  expect(config.maxObjSize).toBe(450000);
  expect(config).toMatchSnapshot();
});
