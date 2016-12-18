import Package from 'nice-package';

export default function formatPackage(pkg) {
  const formatted = new Package(pkg);
  return {
    objectID: formatted.name,
    name: formatted.name,
    downloadsLast30Days: 0,
    downloadsRange: 0,
    popular: false,
    version: formatted.version,
    description: formatted.description,
    repository: formatted.repository,
    homepage: formatted.homepage,
    author: formatted.author,
    license: formatted.license,
    keywords: formatted.keywords,
    created: formatted.created,
    modified: formatted.modified,
    lastPublisher: formatted.lastPublisher,
    owners: formatted.owners,
  };
}
