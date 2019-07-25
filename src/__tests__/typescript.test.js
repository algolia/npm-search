import { getTypeScriptSupport } from '../typescriptSupport';
jest.mock('../npm');
jest.mock('../unpkg');
import { validatePackageExists } from '../npm';
import { fileExistsInUnpkg } from '../unpkg.js';

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
      validatePackageExists.mockResolvedValue(true);
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
      validatePackageExists.mockResolvedValue(true);
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

    it('Checks for a d.ts resolved version of main ', async () => {
      validatePackageExists.mockResolvedValue(false);
      fileExistsInUnpkg.mockResolvedValue(true);

      const typesSupport = await getTypeScriptSupport({
        name: 'my-lib',
        types: { ts: { possible: true, dtsMain: 'main.d.ts' } },
      });
      expect(typesSupport).toEqual({ types: { ts: 'included' } });
    });

    it('Handles not having any possible TS types', async () => {
      validatePackageExists.mockResolvedValue(false);
      fileExistsInUnpkg.mockResolvedValue(false);

      const typesSupport = await getTypeScriptSupport({
        name: 'my-lib',
        types: { ts: false },
      });
      expect(typesSupport).toEqual({ types: { ts: false } });
    });
  });
});
