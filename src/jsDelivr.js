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
  const hitsJSONpromise = got(c.jsDelivrHitsEndpoint, { json: true }).catch(
    error => {
      log.warn(
        `Can't download hits data from ${
          c.jsDelivrHitsEndpoint
        }, error: ${error}`
      );
    }
  );

  const hitsJSON = (await hitsJSONpromise).body;
  hits.clear();
  hitsJSON.forEach(formatHits);
}

export function getHits(pkgs) {
  return pkgs.map(({ name }) => ({ jsDelivrHits: hits.get(name) || 0 }));
}

setInterval(loadHits, 24 * 60 * 60 * 1000);
