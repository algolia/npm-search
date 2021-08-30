import type { GetUser } from '../npm/types';

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
  head?: string;
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
      ts: 'definitely-typed';
      definitelyTyped: string;
    }
  | {
      ts: 'included' | false | { possible: true };
    };

export type ModuleType = 'cjs' | 'esm' | 'unknown';

export type ComputedMeta = {
  computedKeywords: string[];
  computedMetadata: Record<string, unknown>;
};

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
  originalAuthor?: GetUser;
  repository: Repo | null;
  githubRepo: GithubRepo | null;
  gitHead: string | null;
  readme: string;
  owner: Owner | null;
  deprecated: boolean | string;
  isDeprecated: boolean;
  deprecatedReason: string | null;
  homepage: string | null;
  license: string | null;
  keywords: string[];
  computedKeywords: ComputedMeta['computedKeywords'];
  computedMetadata: ComputedMeta['computedMetadata'];
  created: number;
  modified: number;
  lastPublisher: Owner | null;
  owners: Owner[];
  bin: Record<string, string>;
  types: TsType;
  moduleTypes: ModuleType[];
  lastCrawl: string;
  _searchInternal: {
    expiresAt: number;
    alternativeNames: string[];
  };
}

export type FinalPkg = RawPkg & {
  _searchInternal: {
    downloadsMagnitude?: number;
    jsDelivrPopularity?: number;
    popularName?: string;
  };
};
