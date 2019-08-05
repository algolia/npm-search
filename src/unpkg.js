import config from './config.js';
import got from 'got';

// make a head request to a route like:
// https://unpkg.com/lodash@4.17.11/_LazyWrapper.js
// to validate the existence of a particular file
export async function fileExistsInUnpkg(pkg, version, path) {
  const uri = `${config.unpkgRoot}/${pkg}@${version}/${path}`;
  try {
    const response = await got(uri, {
      json: true,
      method: 'HEAD',
    });
    return response.statusCode === 200;
  } catch (e) {
    return false;
  }
}
