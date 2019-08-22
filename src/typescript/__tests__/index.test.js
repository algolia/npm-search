import * as api from '../index.js';

describe('loadTypesIndex()', () => {
  it('should download and cache all @types', async () => {
    expect(api.typesCache).not.toHaveProperty('algoliasearch');
    expect(api.isDefinitelyTyped({ name: 'algoliasearch' })).toBe(undefined);

    await api.loadTypesIndex();
    expect(api.typesCache).toHaveProperty('algoliasearch');
    expect(api.typesCache).toHaveProperty('algoliasearch/lite');

    expect(api.typesCache.algoliasearch).toBe('algoliasearch');
    expect(api.typesCache['algoliasearch/lite']).toBe('algoliasearch');
    expect(api.typesCache.doesnotexist).toBe(undefined);

    expect(api.isDefinitelyTyped({ name: 'algoliasearch' })).toBe(
      'algoliasearch'
    );
  });
});

describe('checkForSupport()', () => {
  it('If types are already calculated - return early', async () => {
    const typesSupport = await api.checkForSupport({
      name: 'Has Types',
      types: { ts: 'included' },
    });

    expect(typesSupport).toEqual({ types: { ts: 'included' } });
  });

  describe('Defintely Typed', () => {
    it('Checks for @types/[name]', async () => {
      const atTypesSupport = await api.checkForSupport({
        name: 'lodash.valuesin',
        types: { ts: false },
      });
      expect(atTypesSupport).toEqual({
        types: {
          _where: 'deftyped',
          ts: 'definitely-typed',
          definitelyTyped: '@types/lodash.valuesin',
        },
      });
    });

    it('Checks for @types/[scope__name]', async () => {
      const atTypesSupport = await api.checkForSupport({
        name: '@mapbox/geojson-area',
        types: { ts: false },
      });
      expect(atTypesSupport).toEqual({
        types: {
          _where: 'deftyped',
          ts: 'definitely-typed',
          definitelyTyped: '@types/mapbox__geojson-area',
        },
      });

      const atTypesSupport2 = await api.checkForSupport({
        name: '@reach/router',
        types: { ts: false },
      });
      expect(atTypesSupport2).toEqual({
        types: {
          _where: 'deftyped',
          ts: 'definitely-typed',
          definitelyTyped: '@types/reach__router',
        },
      });
    });
  });

  describe('FilesList', () => {
    it('should match a correct filesList', async () => {
      const atTypesSupport = await api.checkForSupport(
        {
          name: 'doesnotexist',
          types: { ts: false },
        },
        [{ name: 'index.js' }, { name: 'index.d.ts' }]
      );
      expect(atTypesSupport).toEqual({
        types: {
          _where: 'filesList',
          ts: 'included',
        },
      });
    });

    it('should not match an incorrect filesList', async () => {
      const atTypesSupport = await api.checkForSupport(
        {
          name: 'doesnotexist',
          types: { ts: false },
        },
        [{ name: 'index.js' }, { name: 'index.ts' }, { name: 'index.md' }]
      );
      expect(atTypesSupport).toEqual({
        types: {
          ts: false,
        },
      });
    });
  });

  it('Handles not having any possible TS types', async () => {
    const typesSupport = await api.checkForSupport({
      name: 'my-lib',
      types: { ts: false },
    });
    expect(typesSupport).toEqual({ types: { ts: false } });
  });
});
