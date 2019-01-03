import got from 'got';
import c from './config.js';
import log from './log.js';

const hits = new Map();

function formatHits(pkg) {
  if (pkg.type !== 'npm') {
    return;
  }

  hits.set(pkg.name, pkg.hits);
}

export async function loadHits() {
  try {
    const hitsJSONpromise = got(c.jsDelivrHitsEndpoint, { json: true });
    const hitsJSON = (await hitsJSONpromise).body;
    hits.clear();
    hitsJSON.forEach(formatHits);
  } catch (e) {
    log.error('no jsDelivr hits found, skipping enrichment', e);
  }
}

export function getHits(pkgs) {
  return pkgs.map(({ name }) => {
    const jsDelivrHits = hits.get(name) || 0;

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
