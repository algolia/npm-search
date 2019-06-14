// @ts-check
import c from './config.js';
import got from 'got';

// make a head request to a route like:
// https://unpkg.com/lodash@4.17.11/_LazyWrapper.js
// to validate the existence of a particular file
export function fileExistsInUnpkg(pkg, version, path) {
  const uri = `${c.unpkgRoot}/${pkg}@${version}/${path}`;
  return got(uri, {
    json: true,
    method: 'HEAD',
  }).then(response => response.statusCode === 200);
}
