import { PackageNotFoundError } from '../../errors';
import type { DownloadsData } from '../index';
import * as api from '../index';
import { computeDownload } from '../index';

jest.setTimeout(15000);

describe('getDocFromRegistry()', () => {
  it('retrieves a single doc', async () => {
    const doc = await api.getDocFromRegistry('jsdelivr');

    expect(doc.name).toBe('jsdelivr');
    expect(Object.keys(doc.versions).length).toBeGreaterThanOrEqual(2);
  });

  it('throws PackageNotFoundError for non-existent packages', async () => {
    await expect(api.getDocFromRegistry('jsdelivrxxxx')).rejects.toBeInstanceOf(
      PackageNotFoundError
    );
  });

  it('throws PackageNotFoundError for packages without versions', async () => {
    await expect(
      api.getDocFromRegistry('ebay-app-meta')
    ).rejects.toBeInstanceOf(PackageNotFoundError);
  });
});

describe('getDependents()', () => {
  let dependents;
  beforeAll(async () => {
    dependents = await api.getDependents([
      { name: 'jest' },
      { name: '@angular/core' },
      { name: 'holmes.js' },
    ]);
  });

  it('contains the correct keys', () => {
    expect(dependents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependents: expect.any(Number),
          humanDependents: expect.any(String),
        }),
        expect.objectContaining({
          dependents: expect.any(Number),
          humanDependents: expect.any(String),
        }),
      ])
    );
  });

  it('has the right fake value', () => {
    const [jest, angular, holmes] = dependents.map((pkg) => pkg.dependents);
    expect(jest).toBe(0);
    expect(angular).toBe(0);
    expect(holmes).toBe(0);
  });
});

describe('fetchDownload()', () => {
  it('should download one package and return correct response', async () => {
    const dl = await api.fetchDownload('jest');
    expect(dl).toHaveProperty('jest');
    expect(dl.jest).toEqual({
      packageNpmDownloads: expect.any(Number),
    });
  });

  it('should download one scoped package and return correct response', async () => {
    const dl = await api.fetchDownload('@angular/core');
    expect(dl).toHaveProperty('@angular/core');
    expect(dl['@angular/core']).toEqual({
      packageNpmDownloads: expect.any(Number),
    });
  });

  it('should download 2 packages and return correct response', async () => {
    const dl = await api.fetchDownload('jest,holmes.js');
    expect(dl).toHaveProperty('jest');
    expect(dl).toHaveProperty(['holmes.js']);
  });
});

describe('getDownloads()', () => {
  let downloads: Awaited<ReturnType<typeof api.getDownloads>>;

  beforeAll(async () => {
    await api.loadTotalDownloads();

    downloads = await api.getDownloads([
      { name: 'jest' },
      { name: 'holmes.js' },
    ]);

    downloads = {
      ...downloads,
      ...(await api.getDownloads([{ name: '@angular/core' }])),
    };
  });

  it('contains the correct keys', () => {
    expect(downloads).toEqual({
      jest: expect.objectContaining({
        packageNpmDownloads: expect.any(Number),
        totalNpmDownloads: expect.any(Number),
      }),
      'holmes.js': expect.objectContaining({
        packageNpmDownloads: expect.any(Number),
        totalNpmDownloads: expect.any(Number),
      }),
      '@angular/core': expect.objectContaining({
        packageNpmDownloads: expect.any(Number),
        totalNpmDownloads: expect.any(Number),
      }),
    });
  });

  it('has the right approximate value for downloadsLast30Days', () => {
    const [jest, holmes, angular] = Object.values(downloads).map((pkg) =>
      pkg.packageNpmDownloads!.toString()
    );

    expect(jest!.length).toBeGreaterThanOrEqual(6);
    expect(jest!.length).toBeLessThanOrEqual(9);

    expect(angular!.length).toBeGreaterThanOrEqual(6);
    expect(angular!.length).toBeLessThanOrEqual(8);

    expect(holmes!.length).toBeGreaterThanOrEqual(2);
    expect(holmes!.length).toBeLessThanOrEqual(4);
  });

  it('has the right approximate value for downloadsMagnitude', () => {
    const [jest, holmes, angular] = Object.entries<DownloadsData>(
      downloads
    ).map(
      ([name, pkg]) =>
        computeDownload(
          { name },
          pkg.packageNpmDownloads,
          pkg.totalNpmDownloads
        )?._downloadsMagnitude
    );

    expect(jest).toBeGreaterThanOrEqual(6);
    expect(jest).toBeLessThanOrEqual(9);

    expect(angular).toBeGreaterThanOrEqual(6);
    expect(angular).toBeLessThanOrEqual(8);

    expect(holmes).toBeGreaterThanOrEqual(2);
    expect(holmes).toBeLessThanOrEqual(4);
  });

  it('validates package batching', async () => {
    await expect(
      api.getDownloads([{ name: '@scope/p-1' }, { name: '@scope/p-2' }])
    ).rejects.toThrow('one at a time');
  });

  it('returns undefined for non-existent packages without failing the valid ones', async () => {
    const result = await api.getDownloads([
      { name: 'jsdelivr' },
      { name: 'jsdelivrxxxx' },
    ]);

    expect(result.jsdelivr!.packageNpmDownloads).toBeGreaterThan(0);
    expect(result.jsdelivrxxxx!.packageNpmDownloads).toBeUndefined();
  });
});
