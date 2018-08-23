import got from 'got';
import c from './config.js';

const hits = new Map();

function formatHits(pkg) {
  if (pkg.type !== 'npm') {
    return;
  }

  hits.set(pkg.name, pkg.hits);
}

export async function loadHits() {
  const hitsJSONpromise = got(c.jsDelivrHitsEndpoint, { json: true });
  const hitsJSON = (await hitsJSONpromise).body;
  hits.clear();
  hitsJSON.forEach(formatHits);
}

export function getHits(pkgs) {
  return pkgs.map(({ name }) => ({ jsDelivrHits: hits.get(name) || 0 }));
}
