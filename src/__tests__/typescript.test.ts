import * as npm from '../npm';
import { getTypeScriptSupport } from '../typescriptSupport';
import { fileExistsInUnpkg } from '../unpkg';

jest.mock('../npm');
jest.mock('../unpkg');

describe('getTypeScriptSupport()', () => {
  it('If types are already calculated - return early', async () => {
    const typesSupport = await getTypeScriptSupport({
      name: 'Has Types',
      types: { ts: 'included' },
      version: '1.0.0',
    });

    expect(typesSupport).toEqual({ types: { ts: 'included' } });
  });

  describe('without types/typings', () => {
    it('Checks for @types/[name]', async () => {
      // @ts-expect-error
      npm.validatePackageExists.mockResolvedValue(true);
      const atTypesSupport = await getTypeScriptSupport({
        name: 'my-lib',
        types: { ts: false },
        version: '1.0.0',
      });
      expect(atTypesSupport).toEqual({
        types: {
          ts: 'definitely-typed',
          definitelyTyped: '@types/my-lib',
        },
      });
    });

    it('Checks for @types/[scope__name]', async () => {
      // @ts-expect-error
      npm.validatePackageExists.mockResolvedValue(true);
      const atTypesSupport = await getTypeScriptSupport({
        name: '@my-scope/my-lib',
        types: { ts: false },
        version: '1.0.0',
      });
      expect(atTypesSupport).toEqual({
        types: {
          ts: 'definitely-typed',
          definitelyTyped: '@types/my-scope__my-lib',
        },
      });
    });

    it('Checks for a d.ts resolved version of main', async () => {
      // @ts-expect-error
      npm.validatePackageExists.mockResolvedValue(false);
      // @ts-expect-error
      fileExistsInUnpkg.mockResolvedValue(true);

      const typesSupport = await getTypeScriptSupport({
        name: 'my-lib',
        types: { ts: { possible: true, dtsMain: 'main.d.ts' } },
        version: '1.0.0',
      });
      expect(typesSupport).toEqual({ types: { ts: 'included' } });
    });

    it('Handles not having any possible TS types', async () => {
      // @ts-expect-error
      npm.validatePackageExists.mockResolvedValue(false);
      // @ts-expect-error
      fileExistsInUnpkg.mockResolvedValue(false);

      const typesSupport = await getTypeScriptSupport({
        name: 'my-lib',
        types: { ts: false },
        version: '1.0.0',
      });
      expect(typesSupport).toEqual({ types: { ts: false } });
    });
  });
});
