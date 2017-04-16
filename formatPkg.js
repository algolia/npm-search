import sizeof from 'object-sizeof';
import NicePackage from 'nice-package';
import gravatarUrl from 'gravatar-url';
import numeral from 'numeral';
const defaultGravatar = 'https://www.gravatar.com/avatar/';
import escape from 'escape-html';
import traverse from 'traverse';
import truncate from 'truncate-utf8-bytes';

import c from './config';

export default function formatPkg(pkg) {
  const cleaned = new NicePackage(pkg);

  if (!cleaned.name) {
    return undefined;
  }

  const githubRepo = cleaned.repository
    ? getGitHubRepoInfo(cleaned.repository)
    : null;
  const lastPublisher = cleaned.lastPublisher
    ? formatUser(cleaned.lastPublisher)
    : null;
  const author = cleaned.author && typeof cleaned.author === 'object'
    ? formatUser(cleaned.author)
    : null;
  let license = null;
  if (cleaned.license) {
    if (
      typeof cleaned.license === 'object' &&
      typeof cleaned.license.type === 'string'
    ) {
      license = cleaned.license.type;
    }
    if (typeof cleaned.license === 'string') {
      license = cleaned.license;
    }
  }

  const version = cleaned.version ? cleaned.version : '0.0.0';

  let gitHead = undefined;
  if (pkg.versions && pkg.versions[version] && pkg.versions[version].gitHead) {
    gitHead = pkg.versions[version].gitHead;
  }

  if (!githubRepo && !lastPublisher && !author) {
    return undefined; // ignore this package, we cannot link it to anyone
  }

  const owner = getOwner(githubRepo, lastPublisher, author); // always favor the GitHub owner
  let keywords = [];

  if (cleaned.keywords) {
    if (Array.isArray(cleaned.keywords)) keywords = [...cleaned.keywords];
    if (typeof cleaned.keywords === 'string') keywords = [cleaned.keywords];
  }

  const dependencies = cleaned.dependencies || {};
  const devDependencies = cleaned.devDependencies || {};
  const concatenatedName = cleaned.name.replace(/[-/@_.]+/g, '');

  const rawPkg = {
    objectID: cleaned.name,
    name: cleaned.name,
    concatenatedName,
    downloadsLast30Days: 0,
    downloadsRatio: 0,
    humanDownloadsLast30Days: numeral(0).format('0.[0]a'),
    popular: false,
    version,
    description: cleaned.description ? cleaned.description : null,
    dependencies,
    devDependencies,
    originalAuthor: cleaned.author,
    githubRepo,
    gitHead,
    readme: pkg.readme,
    owner,
    deprecated: cleaned.deprecated !== undefined ? cleaned.deprecated : false,
    homepage: getHomePage(cleaned.homepage, cleaned.repository),
    license,
    keywords,
    created: Date.parse(cleaned.created),
    modified: Date.parse(cleaned.modified),
    lastPublisher,
    owners: (cleaned.owners || []).map(formatUser),
    lastCrawl: new Date().toISOString(),
  };

  const totalSize = sizeof(rawPkg);
  if (totalSize > c.maxObjSize) {
    const sizeDiff = sizeof(rawPkg.readme) - totalSize;
    rawPkg.readme = `${truncate(rawPkg.readme, c.maxObjSize - sizeDiff)} **TRUNCATED**`;
  }

  return traverse(rawPkg).forEach(maybeEscape);
}

function maybeEscape(node) {
  if (this.isLeaf && typeof node === 'string') {
    if (this.key === 'readme') {
      this.update(node);
    } else {
      this.update(escape(node));
    }
  }
}

function getOwner(githubRepo, lastPublisher, author) {
  if (githubRepo) {
    return {
      name: githubRepo.user,
      avatar: `https://github.com/${githubRepo.user}.png`,
      link: `https://github.com/${githubRepo.user}`,
    };
  }

  if (lastPublisher) {
    return lastPublisher;
  }

  return author;
}

function getGravatar(obj) {
  if (
    !obj.email || typeof obj.email !== 'string' || obj.email.indexOf('@') === -1
  ) {
    return defaultGravatar;
  }

  return gravatarUrl(obj.email);
}

function getGitHubRepoInfo(repository) {
  if (!repository || typeof repository !== 'string') return null;

  const result = repository.match(
    /^https:\/\/(?:www\.)?github.com\/([^/]+)\/([^/]+)(\/.+)?$/
  );

  if (!result) {
    return null;
  }

  if (result.length < 3) {
    return null;
  }

  return {
    user: result[1],
    project: result[2],
    path: result[3] || '',
  };
}

function getHomePage(homepage, repository) {
  if (
    homepage &&
    typeof homepage === 'string' && // if there's a homepage
    (!repository || // and there's no repo,
    typeof repository !== 'string' || // or repo is not a string
      homepage.indexOf(repository) < 0) // or repo is different than homepage
  ) {
    return homepage; // then we consider it a valuable homepage
  }

  return null;
}

function formatUser(user) {
  return {
    ...user,
    avatar: getGravatar(user),
    link: `https://www.npmjs.com/~${encodeURIComponent(user.name)}`,
  };
}
