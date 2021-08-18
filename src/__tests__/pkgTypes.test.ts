import type { File } from '../jsDelivr';
import * as api from '../pkgTypes';

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
          [{ name: '/dist/style/style.min.css' }],
          [
            { name: '/src/style/style.less' },
            { name: '/dist/style/style.min.css' },
            { name: '/dist/js/lib.min.js' },
            { name: '/style.scss' },
          ],
          undefined,
          [{ name: '/src/style/style.less' }],
        ] as File[][]
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
        { name: '/dist/style/style.min.css' },
        { name: '/dist/style/_source.scss' },
        { name: '/docs/file.scss' },
        { name: '/test/file.scss' },
        { name: '/.hidden/file.scss' },
        { name: '/dist/.hidden.scss' },
        { name: '/dist/.hidden/style.scss' },
      ] as File[]);
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
          [{ name: '/dist/style/style.min.css' }],
          [{ name: '/dist/js/lib.min.js' }],
          [{ name: '/dist/js/lib.min.mjs' }],
          [{ name: '/dist/js/lib.min.cjs' }],
          [],
          undefined,
        ] as File[][]
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
        { name: '/dist/js/_hidden.mjs' },
        { name: '/dist/js/.hidden.mjs' },
        { name: '/docs/lib.js' },
        { name: '/test/lib.js' },
        { name: '/.hidden/lib.cjs' },
        { name: '/dist/.hidden/lib.js' },
      ] as File[]);
      expect(moduleTypes).toEqual({ moduleTypes: ['none'] });
    });
  });
});
