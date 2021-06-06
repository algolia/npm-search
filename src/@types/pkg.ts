export interface Owner {
  name: string;
  email?: string;
  avatar?: string;
  link?: string;
}

export interface Repo {
  url: string;
  host: string;
  user: string;
  project: string;
  path: string;
  branch?: string;
}
export interface GithubRepo {
  user: string;
  project: string;
  path: string;
  head: string;
}

export type TsType =
  | {
      ts: 'included' | false | { possible: true; dtsMain: string };
    }
  | {
      ts: 'definitely-typed';
      definitelyTyped: string;
    };

export type ModuleType = 'esm' | 'cjs' | 'unknown';

export interface RawPkg {
  objectID: string;
  name: string;
  downloadsLast30Days: number;
  downloadsRatio: number;
  humanDownloadsLast30Days: string;
  popular: boolean;
  version: string;
  versions: Record<string, string>;
  tags: Record<string, string>;
  description: string | null;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  originalAuthor: string;
  repository: Repo | null;
  githubRepo: GithubRepo | null;
  gitHead: string | null;
  readme: string;
  owner: Owner;
  deprecated: string | false;
  homepage: string | null;
  license: string;
  keywords: string[];
  computedKeywords: string[];
  computedMetadata: string[];
  created: number;
  modified: number;
  lastPublisher: Owner;
  owners: Owner[];
  bin: string[];
  types: TsType;
  moduleTypes: ModuleType[];
  lastCrawl: string;
  _searchInternal: {
    alternativeNames: string[];
  };
}
