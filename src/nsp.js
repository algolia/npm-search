import nsp from 'nsp/lib/api';
import { chunk, flatten } from 'lodash';

// eslint-disable-next-line new-cap
const api = new nsp({
  baseUrl: 'https://api.nodesecurity.io',
});

// eslint-disable-next-line no-unused-vars
const getPackage = ({ path: [_original, vulnerable] }) => {
  // split after @
  const parts = vulnerable.split('@');
  // last part has the version, which we don't want
  return parts.splice(0, parts.length - 1).join('@');
};

const getInfo = ({
  id: nspId,
  created_at: created,
  recommendation,
  cvss_score: cvssScore,
  module,
  version,
  vulnerable_versions: vulnerable,
  patched_versions: patched,
  title,
  // eslint-disable-next-line no-unused-vars
  path: [_original, ...dependencyPath],
}) => ({
  nspId,
  created,
  recommendation,
  cvssScore,
  module,
  version,
  vulnerable,
  patched,
  title,
  dependencyPath,
});

async function getSecurityData(packages) {
  const dependencies = packages.reduce(
    (acc, { name, version }) => ({
      ...acc,
      [name]: version,
    }),
    {}
  );

  const { data } = await api.check(
    {
      /* some options, not needed */
    },
    /* a fake package.json */
    {
      package: {
        name: 'npm-search',
        dependencies,
      },
    }
  );

  const security = data.reduce(
    (acc, recommendation) => ({
      ...acc,
      [getPackage(recommendation)]: getInfo(recommendation),
    }),
    {}
  );

  return packages.map(({ name }) => ({
    name,
    securityRecommendation: security[name] || false,
  }));
}

export function getSecurity(packages) {
  const chunks = chunk(packages, 10);
  return Promise.all(chunks.map(getSecurityData)).then(flatten);
}
