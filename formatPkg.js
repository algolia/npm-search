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
    repository: formatted.repository,
    homepage: formatted.homepage,
    author: addGravatar(formatted.author),
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
  if (obj && obj.email) {
    return {
      ...obj,
      gravatar: gravatarUrl(obj.email),
    };
  }

  return obj;
}
