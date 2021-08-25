import type { File } from '../index';
import * as api from '../pkgTypes';

const BASE_FILE: File = {
  name: '0',
  hash: 'sha256:',
  size: 0,
  time: '1985-10-26T08:15:00.000Z',
};

describe('package module/style types', () => {
  describe('package style types', () => {
    it('should return correct style types for multiple packages', () => {
      const styleTypes = api.getStyleTypesForAll(
        [
          { styleTypes: [] },
          { styleTypes: [] },
          { styleTypes: [] },
          { styleTypes: [] },
          { styleTypes: ['css'] },
        ],
        [
          [],
          [{ ...BASE_FILE, name: '/dist/style/style.min.css' }],
          [
            { ...BASE_FILE, name: '/src/style/style.less' },
            { ...BASE_FILE, name: '/dist/style/style.min.css' },
            { ...BASE_FILE, name: '/dist/js/lib.min.js' },
            { ...BASE_FILE, name: '/style.scss' },
          ],
          undefined as any,
          [{ ...BASE_FILE, name: '/src/style/style.less' }],
        ]
      );
      expect(styleTypes).toEqual([
        { styleTypes: ['none'] },
        { styleTypes: ['css'] },
        { styleTypes: ['less', 'css', 'scss'] },
        { styleTypes: ['none'] },
        { styleTypes: ['css', 'less'] },
      ]);
    });

    it('should ignore blacklisted paths', () => {
      const styleTypes = api.getStyleTypes({ styleTypes: [] }, [
        { ...BASE_FILE, name: '/dist/style/style.min.css' },
        { ...BASE_FILE, name: '/dist/style/_source.scss' },
        { ...BASE_FILE, name: '/docs/file.scss' },
        { ...BASE_FILE, name: '/test/file.scss' },
        { ...BASE_FILE, name: '/.hidden/file.scss' },
        { ...BASE_FILE, name: '/dist/.hidden.scss' },
        { ...BASE_FILE, name: '/dist/.hidden/style.scss' },
      ]);
      expect(styleTypes).toEqual({ styleTypes: ['css'] });
    });
  });

  describe('package module types', () => {
    it('should return correct module types for multiple packages', () => {
      const moduleTypes = api.getModuleTypesForAll(
        [
          { moduleTypes: ['unknown'] },
          { moduleTypes: ['unknown'] },
          { moduleTypes: ['unknown'] },
          { moduleTypes: ['unknown'] },
          { moduleTypes: ['unknown'] },
          { moduleTypes: ['esm'] },
          { moduleTypes: ['esm', 'cjs'] },
        ],
        [
          [],
          [{ ...BASE_FILE, name: '/dist/style/style.min.css' }],
          [{ ...BASE_FILE, name: '/dist/js/lib.min.js' }],
          [{ ...BASE_FILE, name: '/dist/js/lib.min.mjs' }],
          [{ ...BASE_FILE, name: '/dist/js/lib.min.cjs' }],
          [],
          undefined as any,
        ]
      );

      expect(moduleTypes).toEqual([
        { moduleTypes: ['none'] },
        { moduleTypes: ['none'] },
        { moduleTypes: ['unknown'] },
        { moduleTypes: ['unknown'] },
        { moduleTypes: ['unknown'] },
        { moduleTypes: ['esm'] },
        { moduleTypes: ['esm', 'cjs'] },
      ]);
    });

    it('should ignore blacklisted paths', () => {
      const moduleTypes = api.getModuleTypes({ moduleTypes: ['unknown'] }, [
        { ...BASE_FILE, name: '/dist/js/_hidden.mjs' },
        { ...BASE_FILE, name: '/dist/js/.hidden.mjs' },
        { ...BASE_FILE, name: '/docs/lib.js' },
        { ...BASE_FILE, name: '/test/lib.js' },
        { ...BASE_FILE, name: '/.hidden/lib.cjs' },
        { ...BASE_FILE, name: '/dist/.hidden/lib.js' },
      ]);
      expect(moduleTypes).toEqual({ moduleTypes: ['none'] });
    });
  });
});
