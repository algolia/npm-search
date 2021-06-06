import { config } from '../config';
import { request } from '../utils/request';

// make a head request to a route like:
// https://unpkg.com/lodash@4.17.11/_LazyWrapper.js
// to validate the existence of a particular file
export async function fileExistsInUnpkg(
  pkg: string,
  version: string,
  path: string
): Promise<boolean> {
  const uri = `${config.unpkgRoot}/${pkg}@${version}/${path}`;
  try {
    const response = await request(uri, {
      method: 'HEAD',
    });
    return response.statusCode === 200;
  } catch (e) {
    return false;
  }
}
