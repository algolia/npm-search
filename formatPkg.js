import NicePackage from 'nice-package';
import gravatarUrl from 'gravatar-url';
import numeral from 'numeral';
const defaultGravatar = 'https://www.gravatar.com/avatar/';
import escape from 'escape-html';

export default function formatPkg(pkg) {
  const cleaned = new NicePackage(pkg);

  if (!cleaned.name) {
    return undefined;
  }

  const githubRepo = cleaned.repository ? getGitHubRepoInfo(cleaned.repository) : null;
  const lastPublisher = cleaned.lastPublisher ? formatUser(cleaned.lastPublisher) : null;
  const author = cleaned.author && typeof cleaned.author === 'object' ? formatUser(cleaned.author) : null;
  let license = null;

  if (license) {
    if (typeof cleaned.license === 'object' && typeof cleaned.license.type === 'string') {
      license = escape(cleaned.license.type);
    }
    if (typeof cleaned.license === 'string') {
      license = escape(cleaned.license);
    }
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

  return {
    objectID: cleaned.name,
    name: escape(cleaned.name),
    downloadsLast30Days: 0,
    downloadsRatio: 0,
    humanDownloadsLast30Days: numeral(0).format('0.[0]a'),
    popular: false,
    version: cleaned.version ? escape(cleaned.version) : '0.0.0',
    description: cleaned.description ? escape(cleaned.description) : null,
    originalAuthor: cleaned.author,
    githubRepo,
    owner,
    homepage: getHomePage(cleaned.homepage, cleaned.repository),
    license,
    keywords: keywords.length > 0 ? keywords.map(keyword => escape(keyword)) : keywords,
    created: Date.parse(cleaned.created),
    modified: Date.parse(cleaned.modified),
    lastPublisher,
    owners: (cleaned.owners || []).map(formatUser),
    lastCrawl: (new Date()).toISOString(),
  };
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
  if (!obj.email || typeof obj.email !== 'string' || obj.email.indexOf('@') === -1) {
    return defaultGravatar;
  }

  return gravatarUrl(obj.email);
}

function getGitHubRepoInfo(repository) {
  if (!repository || typeof repository !== 'string') return null;

  const result = repository
    .match(/^https:\/\/(?:www\.)?github.com\/([^/]+)\/([^/]+)(\/.+)?$/);

  if (!result) {
    return null;
  }

  if (result.length < 3) {
    return null;
  }

  return {
    user: escape(result[1]),
    project: escape(result[2]),
    path: result[3] || '',
  };
}

function getHomePage(homepage, repository) {
  if (homepage && typeof homepage === 'string' && // if there's a homepage
    (!repository || // and there's no repo,
      typeof repository !== 'string' || // or repo is not a string
      repository !== homepage // or repo is different than homepage
    )) {
    return escape(homepage); // then we consider it a valuable homepage
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
