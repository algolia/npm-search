import { log } from '../../utils/log';
import * as api from '../index';

jest.mock('../../utils/log', () => {
  return {
    log: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  };
});

jest.setTimeout(10000);

// eslint-disable-next-line jest/require-top-level-describe
beforeEach(() => {
  jest.resetAllMocks();
});

describe('hits', () => {
  describe('getHits()', () => {
    beforeAll(() => {
      api.hits.clear();
      api.hits.set('jquery', 1234);
    });

    it('should get one formatted hit', () => {
      expect(api.getHits([{ name: 'jquery' }])).toEqual([
        {
          jsDelivrHits: 1234,
          _searchInternal: {
            jsDelivrPopularity: 1,
          },
        },
      ]);
    });
    it('should get multiple formatted hits', () => {
      expect(
        api.getHits([{ name: 'jquery' }, { name: 'thispackagedoesnotexist' }])
      ).toEqual([
        {
          jsDelivrHits: 1234,
          _searchInternal: {
            jsDelivrPopularity: 1,
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

  describe('loadHits()', () => {
    beforeAll(async () => {
      await api.loadHits();
    });
    it('should download all packages hits', () => {
      expect(api.hits.size).toBeGreaterThan(60000); // 66790 (2019-08)
    });

    it('should get one hit', () => {
      expect(api.hits.get('jquery')).toBeGreaterThan(1000000000); // 1065750968 (2019-08)
    });

    it('should not get one hit', () => {
      expect(api.hits.get('thispackagedoesnotexist')).toBeUndefined();
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
      expect(log.error.mock.calls[0][0]).toEqual(
        'Failed to fetch https://data.jsdelivr.com/v1/package/npm/thispackagedoesnotexist@3.33.0/flat'
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
      expect(log.error.mock.calls[0][0]).toEqual(
        'Failed to fetch https://data.jsdelivr.com/v1/package/npm/thispackagedoesnotexist@3.33.0/flat'
      );
    });
  });
});
