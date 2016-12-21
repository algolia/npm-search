import NicePackage from 'nice-package';
import gravatarUrl from 'gravatar-url';
import numeral from 'numeral';
const defaultGravatar = 'https://www.gravatar.com/avatar/?size=180';
import escape from 'escape-html';

export default function formatPkg(pkg) {
  const cleaned = new NicePackage(pkg);

  if (cleaned.valid === false || cleaned.lastPublisher === undefined) {
    return undefined;
  }

  const githubRepo = getGitHubRepoInfo(cleaned.repository);
  const lastPublisher = formatUser(cleaned.lastPublisher);
  const owner = getOwner(githubRepo, lastPublisher);
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
    description: cleaned.description ? escape(cleaned.description) : 'No description found in package.json.',
    originalAuthor: cleaned.author,
    githubRepo,
    owner,
    homepage: getHomePage(cleaned.homepage, cleaned.repository),
    license: cleaned.license ? escape(cleaned.license) : null,
    keywords: keywords.length > 0 ? keywords.map(keyword => escape(keyword)) : keywords,
    created: Date.parse(cleaned.created),
    modified: Date.parse(cleaned.modified),
    lastPublisher,
    owners: (cleaned.owners || []).map(formatUser),
  };
}

function getOwner(githubRepo, lastPublisher) {
  if (githubRepo) {
    return {
      name: githubRepo.user,
      avatar: `http://github.com/${githubRepo.user}.png`,
      link: `http://github.com/${githubRepo.user}`,
    };
  }

  return lastPublisher;
}

function getGravatar(obj) {
  if (!obj.email || typeof obj.email !== 'string' || obj.email.indexOf('@') === -1) {
    return defaultGravatar;
  }

  return gravatarUrl(obj.email, {size: 180});
}

function getGitHubRepoInfo(repository) {
  if (!repository || typeof repository !== 'string') return null;

  const result = repository
    .match(/^https:\/\/(?:www\.)?github.com\/(.*)?\/(.*)?$/);

  if (!result) {
    return null;
  }

  if (result.length !== 3) {
    return null;
  }

  return {
    user: escape(result[1]),
    project: escape(result[2]),
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
