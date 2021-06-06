/* eslint-disable complexity */
import escape from 'escape-html';
import gravatarUrl from 'gravatar-url';
import hostedGitInfo from 'hosted-git-info';
import NicePackage from 'nice-package';
import numeral from 'numeral';
import sizeof from 'object-sizeof';
import traverse from 'traverse';
import truncate from 'truncate-utf8-bytes';

import type { NicePackageType } from './@types/nice-package';
import type {
  ComputedMeta,
  GithubRepo,
  ModuleType,
  Owner,
  RawPkg,
  Repo,
} from './@types/pkg';
import { config } from './config';
import type { GetPackage, GetUser, PackageRepo } from './npm/types';

const defaultGravatar = 'https://www.gravatar.com/avatar/';

type Subset = {
  name: string;
  include: boolean;
  metadata?: { schematics: string };
};

const registrySubsetRules: Array<(pkg: NicePackageType) => Subset> = [
  ({ name }): Subset => ({
    name: 'babel-plugin',
    include:
      name.startsWith('@babel/plugin') || name.startsWith('babel-plugin-'),
  }),

  ({ name }): Subset => ({
    name: 'vue-cli-plugin',
    include: /^(@vue\/|vue-|@[\w-]+\/vue-)cli-plugin-/.test(name),
  }),

  ({ name, keywords = [] }): Subset => ({
    name: 'yeoman-generator',
    include:
      name.startsWith('generator-') && keywords.includes('yeoman-generator'),
  }),

  ({ schematics = '' }): Subset => ({
    name: 'angular-cli-schematic',
    include: schematics.length > 0,
    metadata: { schematics },
  }),

  ({ name }): Subset => ({
    name: 'webpack-scaffold',
    include: name.startsWith('webpack-scaffold-'),
  }),
];

export default function formatPkg(pkg: GetPackage): RawPkg | undefined {
  const cleaned: NicePackageType | undefined = new NicePackage(pkg);
  if (!cleaned || !cleaned.name) {
    return undefined;
  }
  if (Array.isArray(cleaned.main)) {
    // https://github.com/angular-ui/bootstrap-bower/issues/52
    cleaned.main = cleaned.main[0];
  }

  const lastPublisher = cleaned.lastPublisher
    ? formatUser(cleaned.lastPublisher)
    : null;
  const author = getAuthor(cleaned);
  const license = getLicense(cleaned);

  const version = cleaned.version ? cleaned.version : '0.0.0';
  const versions = getVersions(cleaned, pkg);
  const defaultRepository =
    typeof cleaned.repository === 'string'
      ? { type: 'git', url: cleaned.repository }
      : cleaned.repository;
  const githubRepo = cleaned.repository
    ? getGitHubRepoInfo({
        repository: defaultRepository,
        gitHead: cleaned.gitHead,
      })
    : null;

  if (!githubRepo && !lastPublisher && !author) {
    return undefined; // ignore this package, we cannot link it to anyone
  }

  const repoInfo = getRepositoryInfo(defaultRepository);
  // If defaultRepository is undefined or it does not have an URL
  // we don't include it.
  const repository: Repo | null =
    defaultRepository?.url && repoInfo
      ? {
          ...defaultRepository, // Default info: type, url
          ...repoInfo, // Extra info: host, project, user...
          head: cleaned.gitHead,
          branch: cleaned.gitHead || 'master',
        }
      : null;

  const types = getTypes(cleaned);

  const owner = getOwner({ repository, lastPublisher, author }); // always favor the repository owner
  const { computedKeywords, computedMetadata } = getComputedData(cleaned);
  const keywords = getKeywords(cleaned);

  const dependencies = cleaned.dependencies || {};
  const devDependencies = cleaned.devDependencies || {};
  const alternativeNames = getAlternativeNames(cleaned.name);
  const moduleTypes = getModuleTypes(cleaned);

  const tags = pkg['dist-tags'];

  const rawPkg: RawPkg = {
    objectID: cleaned.name,
    name: cleaned.name,
    downloadsLast30Days: 0,
    downloadsRatio: 0,
    humanDownloadsLast30Days: numeral(0).format('0.[0]a'),
    popular: false,
    version,
    versions,
    tags,
    description: cleaned.description ? cleaned.description : null,
    dependencies,
    devDependencies,
    originalAuthor: cleaned.other.author,
    repository,
    githubRepo,
    gitHead: githubRepo ? githubRepo.head : null, // remove this when we update to the new schema frontend
    readme: pkg.readme,
    owner,
    deprecated: cleaned.deprecated !== undefined ? cleaned.deprecated : false,
    homepage: getHomePage(cleaned),
    license,
    keywords,
    computedKeywords,
    computedMetadata,
    created: Date.parse(cleaned.created),
    modified: Date.parse(cleaned.modified),
    lastPublisher,
    owners: (cleaned.owners || []).map(formatUser),
    bin: cleaned.bin || {},
    types,
    moduleTypes,
    lastCrawl: new Date().toISOString(),
    _searchInternal: {
      alternativeNames,
    },
  };

  const truncated = truncatePackage(rawPkg);

  return traverse(truncated).forEach(maybeEscape);
}

function checkSize(pkg: RawPkg): {
  size: number;
  diff: number;
  isTooBig: boolean;
} {
  const size = sizeof(pkg);
  const diff = size - config.maxObjSize;

  return {
    size,
    diff,
    isTooBig: diff > 0,
  };
}

function truncatePackage(pkg: RawPkg): RawPkg | null {
  const smallerPkg = { ...pkg };

  {
    const { diff, isTooBig } = checkSize(smallerPkg);
    if (isTooBig && pkg.readme) {
      const postfix = ' **TRUNCATED**';
      // sizeof is * 2 what truncate expects
      const maxReadmeLength = (sizeof(pkg.readme) - diff - sizeof(postfix)) / 2;

      smallerPkg.readme = truncate(pkg.readme, maxReadmeLength) + postfix;
    }
  }

  {
    const { isTooBig } = checkSize(smallerPkg);
    if (isTooBig) {
      smallerPkg.readme =
        '** TRUNCATED ** this package was too big, so non-essential information was removed';
      smallerPkg.versions = pkg.versions[pkg.version]
        ? {
            [pkg.version]: pkg.versions[pkg.version],
          }
        : {};
      smallerPkg.tags = pkg?.tags?.latest
        ? {
            latest: pkg.tags.latest,
          }
        : {};
      smallerPkg.owners = smallerPkg.owner ? [smallerPkg.owner] : [];
    }
  }

  // This modify the type without warning,
  // {
  //   const { isTooBig } = checkSize(smallerPkg);
  //   if (isTooBig) {
  //     smallerPkg = {
  //       name: smallerPkg.name,
  //       readme: smallerPkg.readme,
  //     };
  //   }
  // }

  {
    const { isTooBig } = checkSize(smallerPkg);
    if (isTooBig) {
      return null;
    }
  }

  return smallerPkg;
}

function maybeEscape(this: any, node: any): void {
  if (this.isLeaf && typeof node === 'string') {
    if (this.key === 'readme') {
      this.update(node);
    } else {
      this.update(escape(node));
    }
  }
}

function getAuthor(cleaned: NicePackageType): Owner | null {
  if (cleaned.other.author && typeof cleaned.other.author === 'object') {
    return formatUser(cleaned.other.author);
  }
  if (Array.isArray(cleaned.owners) && typeof cleaned.owners[0] === 'object') {
    return formatUser(cleaned.owners[0]);
  }
  return null;
}

function getLicense(cleaned: NicePackageType): string | null {
  if (!cleaned.license) {
    return null;
  }
  if (
    typeof cleaned.license === 'object' &&
    typeof cleaned.license.type === 'string'
  ) {
    return cleaned.license.type;
  }

  if (typeof cleaned.license === 'string') {
    return cleaned.license;
  }
  return null;
}

function getOwner({
  repository,
  lastPublisher,
  author,
}: {
  repository: RawPkg['repository'] | null;
  lastPublisher: RawPkg['lastPublisher'] | null;
  author: NicePackageType['other']['author'] | null;
}): Owner | null {
  if (repository?.user) {
    const { user } = repository;

    if (repository.host === 'github.com') {
      return {
        name: user,
        avatar: `https://github.com/${user}.png`,
        link: `https://github.com/${user}`,
      };
    }

    if (repository.host === 'gitlab.com') {
      return {
        name: user,
        avatar: lastPublisher?.avatar,
        link: `https://gitlab.com/${user}`,
      };
    }

    if (repository.host === 'bitbucket.org') {
      return {
        name: user,
        avatar: `https://bitbucket.org/account/${user}/avatar`,
        link: `https://bitbucket.org/${user}`,
      };
    }
  }

  if (lastPublisher) {
    return lastPublisher;
  }

  return author || null;
}

function getGravatar(user: GetUser): string {
  if (
    !user.email ||
    typeof user.email !== 'string' ||
    user.email.indexOf('@') === -1
  ) {
    return defaultGravatar;
  }

  return gravatarUrl(user.email);
}

export function getVersions(
  cleaned: Pick<NicePackageType, 'other'>,
  rawPkg: Pick<GetPackage, 'versions'>
): Record<string, string> {
  if (cleaned?.other?.time) {
    const realVersions = Object.keys(rawPkg.versions);

    return Object.fromEntries(
      Object.entries(cleaned.other.time).filter(([key]) =>
        realVersions.includes(key)
      )
    );
  }
  return {};
}

function getComputedData(cleaned: NicePackageType): ComputedMeta {
  const res: ComputedMeta = { computedKeywords: [], computedMetadata: {} };
  registrySubsetRules.forEach((matcher) => {
    const { include, metadata, name } = matcher(cleaned);
    if (!include) {
      return;
    }
    res.computedKeywords.push(name);
    res.computedMetadata = {
      ...res.computedMetadata,
      ...metadata,
    };
  });
  return res;
}

function getKeywords(cleaned: NicePackageType): string[] {
  if (cleaned.keywords) {
    if (Array.isArray(cleaned.keywords)) {
      return [...cleaned.keywords];
    }
    if (typeof cleaned.keywords === 'string') {
      return [cleaned.keywords];
    }
  }
  return [];
}

function getGitHubRepoInfo({
  repository,
  gitHead = 'master',
}: {
  repository: PackageRepo;
  gitHead?: string;
}): GithubRepo | null {
  const result = repository.url.match(
    /^https:\/\/(?:www\.)?github.com\/([^/]+)\/([^/]+)(\/.+)?$/
  );

  if (!result) {
    return null;
  }

  if (result.length < 3) {
    return null;
  }

  const head = gitHead;
  const [, user, project, path = ''] = result;

  return {
    user,
    project,
    path,
    head,
  };
}

function getHomePage(pkg: NicePackageType): string | null {
  if (
    pkg.homepage &&
    typeof pkg.homepage === 'string' && // if there's a homepage
    (!pkg.repository || // and there's no repo,
      typeof pkg.repository !== 'string' || // or repo is not a string
      pkg.homepage.indexOf(pkg.repository) < 0) // or repo is different than homepage
  ) {
    return pkg.homepage; // then we consider it a valuable homepage
  }

  return null;
}

/**
 * Get info from urls like this: (has multiple packages in one repo, like babel does)
 *  https://github.com/babel/babel/tree/master/packages/babel
 *  https://gitlab.com/user/repo/tree/master/packages/project1
 *  https://bitbucket.org/user/repo/src/ae8df4cd0e809a789e3f96fd114075191c0d5c8b/packages/project1/.
 *
 * This function is like getGitHubRepoInfo (above), but support github, gitlab and bitbucket.
 */
function getRepositoryInfoFromHttpUrl(repository: string): Repo | null {
  const result = repository.match(
    /^https?:\/\/(?:www\.)?((?:github|gitlab|bitbucket)).((?:com|org))\/([^/]+)\/([^/]+)(\/.+)?$/
  );

  if (!result || result.length < 6) {
    return null;
  }

  const [, domain, domainTld, user, project, path = ''] = result;

  return {
    url: repository,
    host: `${domain}.${domainTld}`,
    user,
    project,
    path,
  };
}

export function getRepositoryInfo(
  repository: string | GetPackage['repository']
): Repo | null {
  if (!repository) {
    return null;
  }

  const url = typeof repository === 'string' ? repository : repository.url;
  const path = typeof repository === 'string' ? '' : repository.directory || '';

  if (!url) {
    return null;
  }

  /**
   * Get information using hosted-git-info.
   */
  const repositoryInfo = hostedGitInfo.fromUrl(url);

  if (repositoryInfo) {
    const { project, user, domain } = repositoryInfo;
    return {
      url,
      project,
      user,
      host: domain,
      path: path.replace(/^[./]+/, ''),
    };
  }

  /**
   * Unfortunately, hosted-git-info can't handle URL like this: (has path)
   *   https://github.com/babel/babel/tree/master/packages/babel-core
   * so we need to do it.
   */
  const repositoryInfoFromUrl = getRepositoryInfoFromHttpUrl(url);
  if (!repositoryInfoFromUrl) {
    return null;
  }
  return {
    ...repositoryInfoFromUrl,
    path: path.replace(/^[./]+/, '') || repositoryInfoFromUrl.path,
  };
}

function formatUser(user: GetUser): Owner {
  return {
    ...user,
    avatar: getGravatar(user),
    link: `https://www.npmjs.com/~${encodeURIComponent(user.name)}`,
  };
}

function getTypes(pkg: NicePackageType): RawPkg['types'] {
  // The cheap and simple (+ recommended by TS) way
  // of adding a types section to your package.json
  if (pkg.types) {
    return { ts: 'included' };
  }

  // Older, but still works way of defining your types
  if (pkg.typings) {
    return { ts: 'included' };
  }

  // we only look at the first entry in main here
  const main = getMains(pkg)[0];
  if (typeof main === 'string' && main.endsWith('.js')) {
    const dtsMain = main.replace(/js$/, 'd.ts');
    return {
      ts: {
        possible: true,
        dtsMain,
      },
    };
  }

  return {
    ts: false,
  };
}

/**
 * @param name
 */
function getAlternativeNames(name: string): string[] {
  const alternativeNames = new Set<string>();

  const concatenatedName = name.replace(/[-/@_.]+/g, '');
  alternativeNames.add(concatenatedName);

  const splitName = name.replace(/[-/@_.]+/g, ' ');
  alternativeNames.add(splitName);

  const isDotJs = name.endsWith('.js');
  const isJsSuffix = name.match(/\.?js$/);

  if (isDotJs) {
    alternativeNames.add(name.substring(0, name.length - 3));
  } else if (isJsSuffix) {
    alternativeNames.add(name.substring(0, name.length - 2));
  } else {
    alternativeNames.add(`${name}.js`);
    alternativeNames.add(`${name}js`);
  }

  alternativeNames.add(name);

  return Array.from(alternativeNames);
}

export function getMains(pkg: Pick<NicePackageType, 'main'>): string[] {
  if (Array.isArray(pkg.main)) {
    // we can not deal with non-string mains for now
    return pkg.main.filter((main) => typeof main === 'string');
  }
  if (typeof pkg.main === 'string') {
    return [pkg.main];
  }
  if (typeof pkg.main === 'undefined') {
    return ['index.js'];
  }
  // we can not deal with non-array ||non-string mains for now
  return [];
}

function getModuleTypes(pkg: NicePackageType): ModuleType[] {
  const mains = getMains(pkg);
  const moduleTypes: ModuleType[] = [];

  mains.forEach((main) => {
    if (
      typeof pkg.module === 'string' ||
      pkg.type === 'module' ||
      main.endsWith('.mjs')
    ) {
      moduleTypes.push('esm');
    }
    if (pkg.type === 'commonjs' || main.endsWith('.cjs')) {
      moduleTypes.push('cjs');
    }
  });

  if (moduleTypes.length === 0) {
    moduleTypes.push('unknown');
  }

  return moduleTypes;
}
