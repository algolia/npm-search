/* eslint-disable import/first */
process.env.apiKey = 'fake-api-key';

import { config } from '../config.ts';

it('gets the correct keys from env variables', () => {
  // from mocked .env
  expect(config.apiKey).toBe('fake-api-key');
  // from config.js
  expect(config.maxObjSize).toBe(450000);
});

const objectIDRe = /^[A-Za-z0-9_-]+$/;

it('sets correct objectIDs for query rules', () => {
  config.indexRules.forEach(({ objectID }) => {
    expect(objectID).toMatch(objectIDRe);
  });
});

it('sets correct objectIDs for synonyms', () => {
  config.indexSynonyms.forEach(({ objectID }) => {
    expect(objectID).toMatch(objectIDRe);
  });
});
