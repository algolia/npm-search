import * as api from './index';

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
  it('If types are already calculated - return early', () => {
    const typesSupport = api.getTypeScriptSupport(
      {
        name: 'Has Types',
        types: { ts: 'included' },
        version: '1.0',
      },
      []
    );

    expect(typesSupport).toEqual({ types: { ts: 'included' } });
  });

  it('Handles not having any possible TS types', () => {
    const typesSupport = api.getTypeScriptSupport(
      {
        name: 'my-lib',
        types: { ts: false },
        version: '1.0',
      },
      []
    );
    expect(typesSupport).toEqual({ types: { ts: false } });
  });

  describe('Definitely Typed', () => {
    it('Checks for @types/[name]', () => {
      const atTypesSupport = api.getTypeScriptSupport(
        {
          name: 'lodash.valuesin',
          types: { ts: false },
          version: '1.0',
        },
        []
      );
      expect(atTypesSupport).toEqual({
        types: {
          ts: 'definitely-typed',
          definitelyTyped: '@types/lodash.valuesin',
        },
      });
    });

    it('Checks for @types/[scope__name]', () => {
      const atTypesSupport = api.getTypeScriptSupport(
        {
          name: '@mapbox/geojson-area',
          types: { ts: false },
          version: '1.0',
        },
        []
      );
      expect(atTypesSupport).toEqual({
        types: {
          ts: 'definitely-typed',
          definitelyTyped: '@types/mapbox__geojson-area',
        },
      });

      const atTypesSupport2 = api.getTypeScriptSupport(
        {
          name: '@reach/router',
          types: { ts: false },
          version: '1.0',
        },
        []
      );
      expect(atTypesSupport2).toEqual({
        types: {
          ts: 'definitely-typed',
          definitelyTyped: '@types/reach__router',
        },
      });
    });
  });

  describe('FilesList', () => {
    it('should match a correct filesList', () => {
      const atTypesSupport = api.getTypeScriptSupport(
        {
          name: 'doesnotexist',
          types: { ts: false },
          version: '1.0',
        },
        [
          { name: 'index.js', hash: '', time: '', size: 0 },
          { name: 'index.d.ts', hash: '', time: '', size: 0 },
        ]
      );
      expect(atTypesSupport).toEqual({
        types: {
          ts: 'included',
        },
      });
    });

    it('should not match an incorrect filesList', () => {
      const atTypesSupport = api.getTypeScriptSupport(
        {
          name: 'doesnotexist',
          types: { ts: false },
          version: '1.0',
        },
        [
          { name: 'index.js', hash: '', time: '', size: 0 },
          { name: 'index.ts', hash: '', time: '', size: 0 },
          { name: 'index.md', hash: '', time: '', size: 0 },
        ]
      );
      expect(atTypesSupport).toEqual({
        types: {
          ts: false,
        },
      });
    });
  });
});
