import type {
  GetPackage,
  GetUser,
  GetVersion,
  PackageRepo,
} from '../npm/types';

export interface NicePackageType {
  _hasShrinkwrap?: false;
  bin?: Record<string, string>;
  browser?: string;
  bundlesize?: Array<Record<string, unknown>>;
  created: string;
  dependencies?: Record<string, string>;
  deprecated?: boolean | string;
  description: string;
  devDependencies?: Record<string, string>;
  gitHead?: string;
  homepage?: string;
  keywords: string[];
  lastPublisher?: GetUser;
  license?: string | { type: string };
  licenseText?: string;
  main?: string | string[];
  modified: string;
  module?: string;
  exports?: GetVersion['exports'];
  name: string;
  other: {
    _id?: string;
    _rev: string;
    'dist-tags': Record<string, string>;
    author?: GetUser;
    time?: GetPackage['time'];
  };
  owners?: GetUser[];
  readme?: string;
  repository?: string | Partial<PackageRepo> | Array<Partial<PackageRepo>>;
  scripts: Record<string, string>;
  schematics?: string;
  starsCount?: number;
  style?: string;
  type?: 'module' | 'commonjs';
  types?: string;
  typings?: string;
  unpkg?: string;
  version?: string;
  versions?: Array<{
    date: string;
    number: string;
  }>;
}
