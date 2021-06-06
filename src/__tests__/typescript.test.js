import * as npm from '../npm';
import { getTypeScriptSupport } from '../typescriptSupport.js';
import { fileExistsInUnpkg } from '../unpkg';

jest.mock('../npm');
jest.mock('../unpkg');

describe('getTypeScriptSupport()', () => {
  it('If types are already calculated - return early', async () => {
    const typesSupport = await getTypeScriptSupport({
      name: 'Has Types',
      types: { ts: 'included' },
    });

    expect(typesSupport).toEqual({ types: { ts: 'included' } });
  });

  describe('without types/typings', () => {
    it('Checks for @types/[name]', async () => {
      npm.validatePackageExists.mockResolvedValue(true);
      const atTypesSupport = await getTypeScriptSupport({
        name: 'my-lib',
        types: { ts: false },
      });
      expect(atTypesSupport).toEqual({
        types: {
          ts: 'definitely-typed',
          definitelyTyped: '@types/my-lib',
        },
      });
    });

    it('Checks for @types/[scope__name]', async () => {
      npm.validatePackageExists.mockResolvedValue(true);
      const atTypesSupport = await getTypeScriptSupport({
        name: '@my-scope/my-lib',
        types: { ts: false },
      });
      expect(atTypesSupport).toEqual({
        types: {
          ts: 'definitely-typed',
          definitelyTyped: '@types/my-scope__my-lib',
        },
      });
    });

    it('Checks for a d.ts resolved version of main', async () => {
      npm.validatePackageExists.mockResolvedValue(false);
      fileExistsInUnpkg.mockResolvedValue(true);

      const typesSupport = await getTypeScriptSupport({
        name: 'my-lib',
        types: { ts: { possible: true, dtsMain: 'main.d.ts' } },
      });
      expect(typesSupport).toEqual({ types: { ts: 'included' } });
    });

    it('Handles not having any possible TS types', async () => {
      npm.validatePackageExists.mockResolvedValue(false);
      fileExistsInUnpkg.mockResolvedValue(false);

      const typesSupport = await getTypeScriptSupport({
        name: 'my-lib',
        types: { ts: false },
      });
      expect(typesSupport).toEqual({ types: { ts: false } });
    });
  });
});
