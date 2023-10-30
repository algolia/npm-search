import path from 'path';

import { HTTPError } from 'got';
import ms from 'ms';
import PQueue from 'p-queue';
import race from 'promise-rat-race';

import type { RawPkg, Repo } from './@types/pkg';
import * as jsDelivr from './jsDelivr/index';
import { datadog } from './utils/datadog';
import { request } from './utils/request';

type ChangelogResult = {
  changelogFilename: string | null;
};

type HostObject = {
  name: string;
  queue: PQueue;
  buildUrl: (
    opts: Pick<Repo, 'branch' | 'path' | 'project' | 'user'>
  ) => string;
};

export const baseUrlMap = new Map<string, HostObject>();

baseUrlMap.set('github.com', {
  name: 'github',
  queue: new PQueue({ intervalCap: 20, interval: 1000 }),
  buildUrl: ({ user, project, path: pathName, branch }): string => {
    return `https://raw.githubusercontent.com/${user}/${project}/${
      pathName ? '' : branch
    }${pathName.replace('/tree/', '')}`;
  },
});

baseUrlMap.set('gitlab.com', {
  name: 'gitlab',
  queue: new PQueue({ intervalCap: 10, interval: 1000 }),
  buildUrl: ({ user, project, path: pathName, branch }): string => {
    return `https://gitlab.com/${user}/${project}${
      pathName ? pathName.replace('tree', 'raw') : `/raw/${branch}`
    }`;
  },
});

baseUrlMap.set('bitbucket.org', {
  name: 'bitbucket',
  queue: new PQueue({ intervalCap: 10, interval: 1000 }),
  buildUrl: ({ user, project, path: pathName, branch }): string => {
    return `https://bitbucket.org/${user}/${project}${
      pathName ? pathName.replace('src', 'raw') : `/raw/${branch}`
    }`;
  },
});

const fileOptions = [
  'CHANGELOG.md',
  'ChangeLog.md',
  'changelog.md',
  'changelog.markdown',
  'CHANGELOG',
  'ChangeLog',
  'changelog',
  'CHANGES.md',
  'changes.md',
  'Changes.md',
  'CHANGES',
  'changes',
  'Changes',
  'HISTORY.md',
  'history.md',
  'HISTORY',
  'history',
  'RELEASES.md',
  'RELEASES',
];

// https://regex101.com/r/zU2gjr/1
const fileRegex =
  /^(((changelogs?)|changes|history|(releases?)))((.(md|markdown))?$)/i;

async function handledGot(file: string): Promise<string> {
  const result = await request(file, { method: 'HEAD' });

  if (
    // bitbucket returns 200 for private repos
    // github returns a 404
    // I am unsure what gitlab does
    result?.redirectUrls?.find((res) =>
      res.startsWith('https://bitbucket.org/account/signin')
    )
  ) {
    throw new Error('Redirect leads to login page');
  }
  if (result.statusCode !== 200) {
    throw new Error('not found');
  }

  return result.url;
}

async function raceFromPaths(
  host: HostObject,
  files: string[]
): Promise<ChangelogResult> {
  const start = Date.now();

  try {
    const url = await race(
      files.map((file) => {
        return host.queue.add(() => {
          datadog.increment(`changelogs.requests.${host.name}`);
          return handledGot(file);
        });
      })
    );

    datadog.increment(`changelogs.success`);
    return { changelogFilename: url };
  } catch (e) {
    if (
      e instanceof HTTPError &&
      (e.response.statusCode === 429 || e.response.statusCode >= 500)
    ) {
      datadog.increment(`changelogs.throttle.${host.name}`);

      if (!host.queue.isPaused) {
        host.queue.pause();
        setTimeout(() => host.queue.start(), ms('1 minute')).unref();
      }
    }

    datadog.increment(`changelogs.failure`);
    return { changelogFilename: null };
  } finally {
    datadog.timing('changelogs.getChangelog', Date.now() - start);
  }
}

export async function getChangelog(
  pkg: Pick<RawPkg, 'name' | 'repository' | 'version'>,
  filelist: jsDelivr.File[]
): Promise<{
  changelogFilename: string | null;
}> {
  for (const file of filelist) {
    const name = path.basename(file.name);
    if (!fileRegex.test(name)) {
      continue;
    }

    datadog.increment('jsdelivr.getChangelog.hit');

    return { changelogFilename: jsDelivr.getFullURL(pkg, file) };
  }

  datadog.increment('jsdelivr.getChangelog.miss');
  return { changelogFilename: null };
}

export async function getChangelogBackground(
  pkg: Pick<RawPkg, 'name' | 'repository' | 'version'>
): Promise<ChangelogResult> {
  const { repository } = pkg;

  if (!repository?.host) {
    return { changelogFilename: null };
  }

  const host = repository.host || '';
  const knownHost = baseUrlMap.get(host);

  // No known git hosts
  if (!knownHost) {
    return { changelogFilename: null };
  }

  const baseUrl = knownHost.buildUrl(repository);
  const files = fileOptions.map((file) =>
    [baseUrl.replace(/\/$/, ''), file].join('/')
  );

  // Brute-force from git host
  return raceFromPaths(knownHost, [...files]);
}
