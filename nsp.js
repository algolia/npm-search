import nsp from 'nsp/lib/api';
import { chunk } from 'lodash';

// eslint-disable-next-line new-cap
const api = new nsp({
  baseUrl: 'https://api.nodesecurity.io',
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

  return packages.map(pkg => ({
    ...pkg,
    security: data[pkg],
  }));
}

export function getSecurity(packages) {
  const chunks = chunk(packages, 100);
  return Promise.all(chunks.map(getSecurityData));
}
