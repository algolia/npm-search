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
  author?: GetUser;
  description: string;
  dist: {
    shasum: string;
    tarball: string;
  };
  license?: string;
  main?: string;
  maintainers: GetUser[];
  name: string;
  scripts?: Record<string, string>;
  version: string;
}

export interface PackageRepo {
  type: string;
  url: string;
  directory?: string;
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
  schematics?: string;
}
