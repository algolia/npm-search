import { getTypeScriptSupport } from '../typescriptSupport';
jest.mock('../npm');
jest.mock('../unpkg');
import { validatePackageExists } from '../npm';
import { fileExistsInUnpkg } from '../unpkg.js';

describe('getTypeScriptSupport()', () => {
  it('If types or typings are present in pkg.json - return early', async () => {
    let typesSupport = await getTypeScriptSupport({
      name: 'Has Types',
      types: './types',
    });

    expect(typesSupport).toEqual({ types: { ts: 'included' } });

    typesSupport = await getTypeScriptSupport({
      name: 'Has Types',
      typings: './types',
    });

    expect(typesSupport).toEqual({ types: { ts: 'included' } });
  });

  describe('without types/typings', () => {
    it('Checks for @types/[name]', async () => {
      validatePackageExists.mockResolvedValue(true);
      const atTypesSupport = await getTypeScriptSupport({ name: 'my-lib' });
      expect(atTypesSupport).toEqual({ types: { ts: '@types/my-lib' } });
    });

    it('Checks for a d.ts resolved version of main ', async () => {
      validatePackageExists.mockResolvedValue(false);
      fileExistsInUnpkg.mockResolvedValue(true);

      const typesSupport = await getTypeScriptSupport({ name: 'my-lib' });
      expect(typesSupport).toEqual({ types: { ts: 'included' } });
    });

    it('Handles not having and TS types', async () => {
      validatePackageExists.mockResolvedValue(false);
      fileExistsInUnpkg.mockResolvedValue(false);

      const typesSupport = await getTypeScriptSupport({ name: 'my-lib' });
      expect(typesSupport).toEqual({ types: { ts: null } });
    });
  });
});
