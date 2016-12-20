import NicePackage from 'nice-package';
import gravatarUrl from 'gravatar-url';

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
    popular: false,
    version: formatted.version,
    description: formatted.description,
    homepage: formatted.homepage,
    author: addGravatar(formatted.author),
    githubRepo: getGitHubRepoInfo(formatted.repository),
    license: formatted.license,
    keywords: formatted.keywords,
    created: formatted.created,
    modified: formatted.modified,
    lastPublisher: addGravatar(formatted.lastPublisher),
    owners: addGravatars(formatted.owners),
  };
}

function addGravatars(arrayObjs) {
  if (Array.isArray(arrayObjs) && arrayObjs.length > 0) {
    return arrayObjs.map(addGravatar);
  }

  return arrayObjs;
}

function addGravatar(obj) {
  if (obj) {
    let gravatar;
    if (obj.email && obj.email.indexOf('@') !== -1) {
      gravatar = gravatarUrl(obj.email, {size: 180});
    } else {
      gravatar = 'https://www.gravatar.com/avatar/?size=180';
    }

    return {
      ...obj,
      gravatar,
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
}
