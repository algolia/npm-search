import NicePackage from 'nice-package';
import gravatarUrl from 'gravatar-url';
import numeral from 'numeral';

export default function formatPkg(pkg) {
  const formatted = new NicePackage(pkg);

  if (formatted.valid === false) {
    return undefined;
  }

  return {
    objectID: formatted.name,
    name: formatted.name,
    downloadsLast30Days: 0,
    downloadsRatio: 0,
    humanDownloadsLast30Days: numeral(0).format('0.[0]a'),
    popular: false,
    version: formatted.version,
    description: formatted.description,
    author: addAvatar(formatted.author),
    githubRepo: getGitHubRepoInfo(formatted.repository),
    homepage: getHomePage(formatted.homepage, formatted.repository),
    license: formatted.license,
    keywords: formatted.keywords,
    created: formatted.created,
    modified: formatted.modified,
    lastPublisher: addAvatar(formatted.lastPublisher),
    owners: addAvatars(formatted.owners),
  };
}

function addAvatars(arrayObjs) {
  if (Array.isArray(arrayObjs) && arrayObjs.length > 0) {
    return arrayObjs.map(addAvatar);
  }

  return arrayObjs;
}

function addAvatar(obj) {
  if (obj) {
    let avatar;
    if (obj.email && obj.email.indexOf('@') !== -1) {
      avatar = gravatarUrl(obj.email, {size: 180});
    } else {
      avatar = 'https://www.gravatar.com/avatar/?size=180';
    }

    return {
      ...obj,
      avatar,
    };
  }

  return obj;
}

function getGitHubRepoInfo(repository) {
  if (!repository || typeof repository !== 'string') return null;

  const result = repository
    .replace(/^https:\/\/www.github.com/, 'https://github.com')
    .match(/^https:\/\/github.com\/(.*)?\/(.*)?$/);

  if (result.length !== 3) {
    return null;
  }

  return {
    user: result[1],
    project: result[2],
  };

function getHomePage(homepage, repository) {
  if (homepage && typeof homepage === 'string' && // if there's a homepage
    (!repository || // and there's no repo,
      typeof repository !== 'string' || // or repo is not a string
      repository !== homepage // or repo is different than homepage
    )) {
    return homepage; // then we consider it a valuable homepage
  }

  return null;
}
