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

  const lastPublisher = cleaned.lastPublisher
    ? formatUser(cleaned.lastPublisher)
    : null;
  const author = getAuthor(cleaned);
  const license = getLicense(cleaned);

  const version = cleaned.version ? cleaned.version : '0.0.0';
  const versions = getVersions(cleaned);
  const githubRepo = cleaned.repository
    ? getGitHubRepoInfo({
        repository: cleaned.repository,
        gitHead: cleaned.gitHead,
      })
    : null;

  if (!githubRepo && !lastPublisher && !author) {
    return undefined; // ignore this package, we cannot link it to anyone
  }

  const owner = getOwner(githubRepo, lastPublisher, author); // always favor the GitHub owner
  const badPackage = isBadPackage(owner);
  const keywords = getKeywords(cleaned);

  const dependencies = cleaned.dependencies || {};
  const devDependencies = cleaned.devDependencies || {};
  const concatenatedName = cleaned.name.replace(/[-/@_.]+/g, '');

  const tags = pkg['dist-tags'];

  const rawPkg = {
    objectID: cleaned.name,
    name: cleaned.name,
    concatenatedName,
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
    originalAuthor: cleaned.author,
    githubRepo,
    gitHead: githubRepo && githubRepo.head, // remove this when we update to the new schema frontend
    readme: pkg.readme,
    owner,
    deprecated: cleaned.deprecated !== undefined ? cleaned.deprecated : false,
    badPackage,
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
    rawPkg.readme = `${truncate(
      rawPkg.readme,
      c.maxObjSize - sizeDiff
    )} **TRUNCATED**`;
  }

  return traverse(rawPkg).forEach(maybeEscape);
}

function isBadPackage(owner) {
  // the organisations `npmtest` and `npmdoc` are just republishing everything
  // this is a total mess, and shouldn't ever be used, because it makes results
  // messy. We're ignoring packages by those "authors"
  if (owner === 'npmdoc' || owner === 'npmtest') {
    return true;
  }
  return false;
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

function getAuthor(cleaned) {
  return cleaned.author && typeof cleaned.author === 'object'
    ? formatUser(cleaned.author)
    : null;
}

function getLicense(cleaned) {
  if (cleaned.license) {
    if (
      typeof cleaned.license === 'object' &&
      typeof cleaned.license.type === 'string'
    ) {
      return cleaned.license.type;
    }
    if (typeof cleaned.license === 'string') {
      return cleaned.license;
    }
  }
  return null;
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
    !obj.email ||
    typeof obj.email !== 'string' ||
    obj.email.indexOf('@') === -1
  ) {
    return defaultGravatar;
  }

  return gravatarUrl(obj.email);
}

function getVersions(cleaned) {
  if (cleaned.other && cleaned.other.time) {
    return Object.keys(cleaned.other.time)
      .filter(key => !['modified', 'created'].includes(key))
      .reduce(
        (obj, key) => ({
          ...obj,
          [key]: cleaned.other.time[key],
        }),
        {}
      );
  }
  return {};
}

function getKeywords(cleaned) {
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

function getGitHubRepoInfo({ repository, gitHead = 'master' }) {
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

  const head = gitHead;

  return {
    user: result[1],
    project: result[2],
    path: result[3] || '',
    head,
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
