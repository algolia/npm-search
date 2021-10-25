import type { DocumentLookupFailure } from 'nano';

export interface PackageDownload {
  downloads: number;
  package: string;
  start: string;
  end: string;
}

export interface GetInfo {
  doc_count: number;
  update_seq: number;
}

export interface GetUser {
  name: string;
  email?: string;
}

export interface GetVersion {
  _from?: string;
  _id: string;
  _npmUser?: GetUser;
  _npmVersion?: string;
  _nodeVersion?: string;
  _npmOperationalInternal?: Record<string, string>;
  author?: GetUser;
  description: string;
  dist: {
    shasum: string;
    tarball: string;
  };
  license?: string;

  type?: 'commonjs' | 'module';
  module?: string;
  main?: string;
  exports?: PackageExports;

  maintainers: GetUser[];
  name: string;
  scripts?: Record<string, string>;
  version: string;
  deprecated?: boolean | string;
  schematics?: string;
  types?: string;
  typings?: string;
  style?: string;
}

export interface PackageRepo {
  type: string;
  url: string;
  directory?: string;
}

export interface PackageExports {
  [key: string]: PackageExports | string;
}

export interface GetPackage {
  _id: string;
  _rev: string;
  'dist-tags': Record<string, string>;
  license?: string;
  maintainers: GetUser[];
  name: string;
  readme: string;
  readmeFilename: string;
  time: {
    created: string;
    modified: string;
    [key: string]: string;
  };
  author?: GetUser;
  users?: Record<string, boolean>;
  versions: Record<string, GetVersion>;
  keywords?: string[] | string;
  contributors?: Array<{ name: string }>;
  repository?: PackageRepo;
}

export interface GetPackageLight {
  name: string;
  'dist-tags': Record<string, string>;
  versions: Record<string, Pick<GetVersion, 'dist' | 'name' | 'version'>>;
  modified: string;
}

export function isFailure(change: any): change is DocumentLookupFailure {
  return change.error && !change.id;
}
