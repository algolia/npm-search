import got from 'got';
import c from './config.js';
import {chunk} from 'lodash';
import numeral from 'numeral';

export default {
  info() {
    return got(c.npmRegistryEndpoint, {json: true})
      .then(
        ({body: {doc_count: nbDocs, update_seq: seq}}) => ({nbDocs, seq})
      );
  },
  getDownloads(pkgs) {
    // npm has a weird API to get downloads via GET params, so we split pkgs into chunks
    // and do multiple requests to avoid weird cases when concurrency is high
    const encodedPackageNames = pkgs.map(pkg => encodeURIComponent(pkg.name));
    // why do we do this? see https://github.com/npm/registry/issues/104
    encodedPackageNames.unshift('');
    const pkgsNamesChunks = chunk(encodedPackageNames, 100).map(names => names.join(','));
    return Promise
      .all([
        got(`${c.npmDownloadsEndpoint}/range/last-month`, {json: true}),
        ...pkgsNamesChunks
          .map(pkgsNames => got(`${c.npmDownloadsEndpoint}/point/last-month/${pkgsNames}`, {json: true})),
      ])
      .then(([{body: {downloads: totalNpmDownloadsPerDay}}, ...downloadsPerPkgNameChunks]) => {
        const totalNpmDownloads = totalNpmDownloadsPerDay
          .reduce((total, {downloads: dayDownloads}) => total + dayDownloads, 0);

        const downloadsPerPkgName = downloadsPerPkgNameChunks
          .reduce((res, {body: downloadsPerPkgNameChunk}) => ({
            ...res,
            ...downloadsPerPkgNameChunk,
          }), {});

        return pkgs.map(pkg => {
          if (downloadsPerPkgName[pkg.name] === undefined) return pkg;

          const downloadsLast30Days = downloadsPerPkgName[pkg.name].downloads;
          const downloadsRatio = downloadsLast30Days / totalNpmDownloads * 100;
          const popular = downloadsRatio > c.popularDownloadsRatio;
          return {
            ...pkg,
            downloadsLast30Days,
            humanDownloadsLast30Days: numeral(downloadsLast30Days).format('0.[0]a'),
            downloadsRatio,
            popular,
          };
        });
      });
  },
};
