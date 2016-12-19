import got from 'got';
import c from './config.js';
import {chunk} from 'lodash';

export default {
  info() {
    return got(c.npmRegistryEndpoint, {json: true})
      .then(
        ({body: {doc_count: nbPkgs, update_seq: seq}}) => ({nbPkgs, seq})
      );
  },
  getDownloads(pkgs) {
    // npm has a weird API to get downloads via GET params, so we split pkgs into chunks
    // and do multiple requests to avoid weird cases when concurrency is high
    const encodedPackageNames = pkgs.map(pkg => encodeURIComponent(pkg.name));
    // when only one object was found with downloads by npm downloads api, it will send it as {downloads: ..}
    // when multiple objects are found with downloads, it will send it as {package: {downloads: ..}}
    // thus we just force to always have at least to downloads we know exists to ask
    encodedPackageNames.unshift('jquery');
    encodedPackageNames.unshift('lodash');
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
          const downloadsRange = downloadsLast30Days / totalNpmDownloads * 100;
          const popular = downloadsRange > c.popularDownloadRange;
          return {
            ...pkg,
            downloadsLast30Days,
            downloadsRange,
            popular,
          };
        });
      });
  },
};
