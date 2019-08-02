import got from 'got';
import log from './log.js';
import c from './config.js';
import datadog from './datadog.js';

const hits = new Map();

function formatHits(pkg) {
  if (pkg.type !== 'npm') {
    return;
  }

  hits.set(pkg.name, pkg.hits);
}

export async function loadHits() {
  const start = Date.now();
  log.info('📦  Loading hits from jsDelivr');

  const hitsJSONpromise = got(c.jsDelivrHitsEndpoint, { json: true });
  const hitsJSON = (await hitsJSONpromise).body;
  hits.clear();
  hitsJSON.forEach(formatHits);

  datadog.timing('jsdelivr.loadHits', Date.now() - start);
}

export function getHits(pkgs) {
  const start = Date.now();
  return pkgs.map(({ name }) => {
    const jsDelivrHits = hits.get(name) || 0;

    datadog.timing('jsdelivr.getHits', Date.now() - start);
    return {
      jsDelivrHits,
      _searchInternal: {
        // anything below 1000 hits/month is likely to mean that
        // someone just made a few random requests so we count that as 0
        jsDelivrPopularity: Math.max(jsDelivrHits.toString().length - 3, 0),
      },
    };
  });
}
