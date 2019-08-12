import * as api from '../index.js';
import log from '../../log.js';

jest.mock('../../log.js', () => {
  return {
    info: jest.fn(),
    warn: jest.fn(),
  };
});

beforeEach(() => {
  jest.resetAllMocks();
});

describe('hits', () => {
  beforeAll(async () => {
    await api.loadHits();
  });
  describe('loadHits()', () => {
    it('should download all packages hits', () => {
      expect(api.hits.size).toBeGreaterThan(60000); // 66790 (2019-08)
    });

    it('should get one hit', () => {
      expect(api.hits.get('jquery')).toBeGreaterThan(1000000000); // 1065750968 (2019-08)
    });

    it('should not get one hit', () => {
      expect(api.hits.get('thispackagedoesnotexist')).toBe(undefined);
    });
  });

  describe('getHits()', () => {
    it('should get one formatted hit', () => {
      expect(api.getHits(['jquery'])).toEqual([
        {
          jsDelivrHits: expect.any(Number),
          _searchInternal: {
            jsDelivrPopularity: expect.any(Number),
          },
        },
      ]);
    });
    it('should get multiple formatted hits', () => {
      expect(api.getHits(['jquery', 'thispackagedoesnotexist'])).toEqual([
        {
          jsDelivrHits: expect.any(Number),
          _searchInternal: {
            jsDelivrPopularity: expect.any(Number),
          },
        },
        {
          jsDelivrHits: 0,
          _searchInternal: {
            jsDelivrPopularity: 0,
          },
        },
      ]);
    });
  });
});

describe('files', () => {
  describe('getFilesList()', () => {
    it('should get a flat list of files', async () => {
      const files = await api.getFilesList({
        name: 'jest',
        version: '24.8.0',
      });
      expect(files).toMatchSnapshot();
    });

    it('should not get a files list for fake package', async () => {
      const files = await api.getFilesList({
        name: 'thispackagedoesnotexist',
        version: '3.33.0',
      });
      expect(files).toEqual([]);
      expect(log.warn.mock.calls[0][0].message).toMatchInlineSnapshot(
        `"Response code 404 (Not Found)"`
      );
    });
  });

  describe('getAllFilesList()', () => {
    it('should get a flat list of files', async () => {
      const files = await api.getAllFilesList([
        { name: 'jest', version: '24.8.0' },
      ]);
      expect(files).toMatchSnapshot();
    });

    it('should get multiple flat list of files', async () => {
      const files = await api.getAllFilesList([
        {
          name: 'jest',
          version: '24.8.0',
        },
        {
          name: 'thispackagedoesnotexist',
          version: '3.33.0',
        },
      ]);
      expect(files).toMatchSnapshot();
      expect(log.warn.mock.calls[0][0].message).toMatchInlineSnapshot(
        `"Response code 404 (Not Found)"`
      );
    });
  });
});
