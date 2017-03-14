import got from 'got';
import c from './config.js';
import numeral from 'numeral';

export function getInfo(pkgs) {
  return Promise.all(
    pkgs.map(pkg =>
      got(`${c.npmsEndpoint}/${pkg.name}`, {json: true}).then(({
        body: {collected: {npm, github}},
      }) => ({
        dependents: npm.dependentsCount,
        humanDependents: numeral(npm.dependentsCount).format('0.[0]a'),
        stargazers: github ? github.starsCount : undefined,
        humanStargazers: github
          ? numeral(github.starsCount).format('0.[0]a')
          : undefined,
      }))),
  );
}
