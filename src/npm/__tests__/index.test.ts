import type { DownloadsData } from '../index';
import * as api from '../index';
import { cacheTotalDownloads, computeDownload } from '../index';

jest.setTimeout(10000);

describe('findAll()', () => {
  it('contains the correct keys', async () => {
    const all = await api.findAll({ limit: 2, startkey: '0' });

    expect(all).toEqual(
      expect.objectContaining({
        offset: expect.any(Number),
        total_rows: expect.any(Number),
      })
    );

    expect(all.rows).toHaveLength(2);

    expect(all.rows[0]).toEqual(
      expect.objectContaining({
        id: '0',
        key: '0',
        value: { rev: '11-61bb2c49ce3202a3e0ab9a65646b4b4d' },
      })
    );
  });
});

describe('getInfo()', () => {
  let registryInfo;
  beforeAll(async () => {
    registryInfo = await api.getInfo();
  });

  it('contains the correct keys', () => {
    expect(registryInfo).toEqual(
      expect.objectContaining({
        nbDocs: expect.any(Number),
        seq: expect.any(Number),
      })
    );
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
  let downloads;
  beforeAll(async () => {
    cacheTotalDownloads.total = 1e15;

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
      pkg.packageNpmDownloads.toString()
    );

    expect(jest.length).toBeGreaterThanOrEqual(6);
    expect(jest.length).toBeLessThanOrEqual(8);

    expect(angular.length).toBeGreaterThanOrEqual(6);
    expect(angular.length).toBeLessThanOrEqual(8);

    expect(holmes.length).toBeGreaterThanOrEqual(2);
    expect(holmes.length).toBeLessThanOrEqual(4);
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
    expect(jest).toBeLessThanOrEqual(8);

    expect(angular).toBeGreaterThanOrEqual(6);
    expect(angular).toBeLessThanOrEqual(8);

    expect(holmes).toBeGreaterThanOrEqual(2);
    expect(holmes).toBeLessThanOrEqual(4);
  });
});
