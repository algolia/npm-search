import got from 'got';
import c from './config.js';

export default {
  info() {
    return got(c.npmRegistryEndpoint, {json: true})
      .then(
        ({body: {doc_count: nbPkgs, update_seq: seq}}) => ({nbPkgs, seq})
      );
  },
  getDownloads(pkgs) {
    const pkgsNames = pkgs.map(pkg => encodeURIComponent(pkg.name)).join(',');
    return Promise
      .all([
        got(`${c.npmDownloadsEndpoint}/point/last-month/${pkgsNames}`, {json: true}),
        got(`${c.npmDownloadsEndpoint}/range/last-month`, {json: true}),
      ])
      .then(([downloadsPerPackageName, totalNpmDownloadsPerDay]) => {
        const totalNpmDownloads =
          totalNpmDownloadsPerDay
          .body.downloads
          .reduce((total, {downloads: dayDownloads}) => total + dayDownloads, 0);

        return pkgs.map(pkg => {
          if (downloadsPerPackageName.body[pkg.name] === undefined) return pkg;

          const downloadsLast30Days = downloadsPerPackageName.body[pkg.name].downloads;
          const downloadsRange = Math.round(downloadsLast30Days / totalNpmDownloads * 100);
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
