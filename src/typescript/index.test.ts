import * as npm from '../npm';
import { fileExistsInUnpkg } from '../unpkg';

import * as api from './index';

jest.mock('../npm');
jest.mock('../unpkg');

describe('loadTypesIndex()', () => {
  it('should download and cache all @types', async () => {
    expect(api.typesCache).not.toHaveProperty('algoliasearch');
    expect(api.isDefinitelyTyped({ name: 'algoliasearch' })).toBe(undefined);

    await api.loadTypesIndex();
    expect(api.typesCache).toHaveProperty('algoliasearch');
    expect(api.typesCache).not.toHaveProperty('algoliasearch/lite');

    expect(api.typesCache.algoliasearch).toBe('algoliasearch');
    expect(api.typesCache['algoliasearch/lite']).toBe(undefined);
    expect(api.typesCache.doesnotexist).toBe(undefined);

    expect(api.isDefinitelyTyped({ name: 'algoliasearch' })).toBe(
      'algoliasearch'
    );
  });
});

describe('getTypeScriptSupport()', () => {
  it('If types are already calculated - return early', async () => {
    const typesSupport = await api.getTypeScriptSupport({
      name: 'Has Types',
      types: { ts: 'included' },
      version: '1.0',
    });

    expect(typesSupport).toEqual({ types: { ts: 'included' } });
  });

  it('Handles not having any possible TS types', async () => {
    const typesSupport = await api.getTypeScriptSupport({
      name: 'my-lib',
      types: { ts: false },
      version: '1.0',
    });
    expect(typesSupport).toEqual({ types: { ts: false } });
  });

  describe('Definitely Typed', () => {
    it('Checks for @types/[name]', async () => {
      const atTypesSupport = await api.getTypeScriptSupport({
        name: 'lodash.valuesin',
        types: { ts: false },
        version: '1.0',
      });
      expect(atTypesSupport).toEqual({
        types: {
          ts: 'definitely-typed',
          definitelyTyped: '@types/lodash.valuesin',
        },
      });
    });

    it('Checks for @types/[scope__name]', async () => {
      const atTypesSupport = await api.getTypeScriptSupport({
        name: '@mapbox/geojson-area',
        types: { ts: false },
        version: '1.0',
      });
      expect(atTypesSupport).toEqual({
        types: {
          ts: 'definitely-typed',
          definitelyTyped: '@types/mapbox__geojson-area',
        },
      });

      const atTypesSupport2 = await api.getTypeScriptSupport({
        name: '@reach/router',
        types: { ts: false },
        version: '1.0',
      });
      expect(atTypesSupport2).toEqual({
        types: {
          ts: 'definitely-typed',
          definitelyTyped: '@types/reach__router',
        },
      });
    });
  });

  describe('unpkg', () => {
    it('Checks for a d.ts resolved version of main', async () => {
      // @ts-expect-error
      npm.validatePackageExists.mockResolvedValue(false);
      // @ts-expect-error
      fileExistsInUnpkg.mockResolvedValue(true);

      const typesSupport = await api.getTypeScriptSupport({
        name: 'my-lib',
        types: { ts: { possible: true, dtsMain: 'main.d.ts' } },
        version: '1.0.0',
      });
      expect(typesSupport).toEqual({ types: { ts: 'included' } });
    });
  });

  // TO DO : reup this
  // adescribe('FilesList', () => {
  //   ait('should match a correct filesList', async () => {
  //     const atTypesSupport = await api.getTypeScriptSupport(
  //       {
  //         name: 'doesnotexist',
  //         types: { ts: false },
  //     version: '1.0',

  //       },
  //       [{ name: 'index.js' }, { name: 'index.d.ts' }]
  //     );
  //     expect(atTypesSupport).toEqual({
  //       types: {
  //         _where: 'filesList',
  //         ts: 'included',
  //       },
  //     });
  //   });

  //   ait('should not match an incorrect filesList', async () => {
  //     const atTypesSupport = await api.getTypeScriptSupport(
  //       {
  //         name: 'doesnotexist',
  //         types: { ts: false },
  //     version: '1.0',

  //       },
  //       [{ name: 'index.js' }, { name: 'index.ts' }, { name: 'index.md' }]
  //     );
  //     expect(atTypesSupport).toEqual({
  //       types: {
  //         ts: false,
  //       },
  //     });
  //   });
  // });
});
