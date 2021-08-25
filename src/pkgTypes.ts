import type { RawPkg, StyleType } from './@types/pkg';
import type { File } from './jsDelivr';
import { datadog } from './utils/datadog';

const styleFileExtensions: StyleType[] = ['css', 'less', 'scss'];
const jsFileExtensions = ['js', 'mjs', 'cjs'];

function createFilePattern(extensions: string[]): RegExp {
  const extPattern = extensions.join('|');
  return new RegExp(
    `^(?:(?!\\/(docs?|documentation|examples?|samples?|demos?|tests?)\\/)(?!\\/[._]).)+\\.(${extPattern})$`
  );
}

export function getStyleTypes(
  pkg: Pick<RawPkg, 'styleTypes'>,
  filelist: File[]
): Pick<RawPkg, 'styleTypes'> {
  const start = Date.now();

  try {
    const styleTypes = new Set(pkg.styleTypes);
    const filePattern = createFilePattern(styleFileExtensions);

    for (const file of filelist) {
      if (!filePattern.test(file.name)) {
        continue;
      }

      const type = file.name.split('.').pop();

      if (type) {
        styleTypes.add(type);
      }
    }

    if (styleTypes.size === 0) {
      styleTypes.add('none');
    }

    return { styleTypes: [...styleTypes] };
  } finally {
    datadog.timing('pkgTypes.getStyleTypes', Date.now() - start);
  }
}

export function getStyleTypesForAll(
  pkgs: Array<Pick<RawPkg, 'styleTypes'>>,
  filelists: File[][]
): Array<Pick<RawPkg, 'styleTypes'>> {
  const start = Date.now();

  const all = pkgs.map((pkg, index) => {
    return getStyleTypes(pkg, filelists[index] || []);
  });

  datadog.timing('pkgTypes.getStyleTypesForAll', Date.now() - start);
  return all;
}

export function getModuleTypes(
  pkg: Pick<RawPkg, 'moduleTypes'>,
  filelist: File[]
): Pick<RawPkg, 'moduleTypes'> {
  const start = Date.now();

  try {
    // Module type(s) already detected - it can't be none at that point
    if (!pkg.moduleTypes.includes('unknown')) {
      return { moduleTypes: pkg.moduleTypes };
    }

    const filePattern = createFilePattern(jsFileExtensions);

    for (const file of filelist) {
      // JS file found - it can't be non anymore
      if (filePattern.test(file.name)) {
        return { moduleTypes: pkg.moduleTypes };
      }
    }

    return { moduleTypes: ['none'] };
  } finally {
    datadog.timing('pkgTypes.getModuleTypes', Date.now() - start);
  }
}

export function getModuleTypesForAll(
  pkgs: Array<Pick<RawPkg, 'moduleTypes'>>,
  filelists: File[][]
): Array<Pick<RawPkg, 'moduleTypes'>> {
  const start = Date.now();

  const all = pkgs.map((pkg, index) => {
    return getModuleTypes(pkg, filelists[index] || []);
  });

  datadog.timing('pkgTypes.getModuleTypesForAll', Date.now() - start);
  return all;
}
