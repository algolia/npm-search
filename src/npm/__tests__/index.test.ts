import * as api from '../index';

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

    expect(all.rows[0].doc).toEqual(
      expect.objectContaining({
        _id: '0',
        _rev: '1-5fbff37e48e1dd03ce6e7ffd17b98998',
        name: '0',
        license: 'BSD-2-Clause',
      })
    );
  });
});

describe('getChanges()', () => {
  it('contains the correct keys', async () => {
    const changes = await api.getChanges({ limit: 1, startkey: '0' });

    expect(changes).toEqual({
      last_seq: 3299,
      results: expect.any(Array),
    });
  });
});

describe('getDocs()', () => {
  it('contains the correct keys', async () => {
    const docs = await api.getDocs({ keys: ['0'] });

    expect(docs.rows).toHaveLength(1);

    // @ts-expect-error
    expect(docs.rows[0].doc).toEqual(
      expect.objectContaining({
        _id: '0',
        _rev: '1-5fbff37e48e1dd03ce6e7ffd17b98998',
        name: '0',
        license: 'BSD-2-Clause',
      })
    );
  });
});

describe('getInfo()', () => {
  let registryInfo;
  beforeAll(async () => {
    registryInfo = await api.getInfo();
  });

  test('contains the correct keys', () => {
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
    expect(dl.body).toHaveProperty('jest');
    expect(dl.body.jest).toEqual({
      downloads: expect.any(Number),
      start: expect.any(String),
      end: expect.any(String),
      package: 'jest',
    });
  });

  it('should download one scoped package and return correct response', async () => {
    const dl = await api.fetchDownload('@angular/core');
    expect(dl.body).toHaveProperty('@angular/core');
    expect(dl.body['@angular/core']).toEqual({
      downloads: expect.any(Number),
      start: expect.any(String),
      end: expect.any(String),
      package: '@angular/core',
    });
  });

  it('should download 2 packages and return correct response', async () => {
    const dl = await api.fetchDownload('jest,holmes.js');
    expect(dl.body).toHaveProperty('jest');
    expect(dl.body).toHaveProperty(['holmes.js']);
  });
});

describe('getDownloads()', () => {
  let downloads;
  beforeAll(async () => {
    downloads = await api.getDownloads([
      { name: 'jest' },
      { name: '@angular/core' },
      { name: 'holmes.js' },
    ]);
  });

  it('contains the correct keys', () => {
    expect(downloads).toEqual([
      expect.objectContaining({
        downloadsLast30Days: expect.any(Number),
        downloadsRatio: expect.any(Number),
        humanDownloadsLast30Days: expect.any(String),
        popular: true,
        _searchInternal: {
          popularName: 'jest',
          downloadsMagnitude: expect.any(Number),
          expiresAt: expect.any(String),
        },
      }),
      expect.objectContaining({
        downloadsLast30Days: expect.any(Number),
        downloadsRatio: expect.any(Number),
        humanDownloadsLast30Days: expect.any(String),
        popular: true,
        _searchInternal: {
          popularName: '@angular/core',
          downloadsMagnitude: expect.any(Number),
          expiresAt: expect.any(String),
        },
      }),
      expect.objectContaining({
        downloadsLast30Days: expect.any(Number),
        downloadsRatio: expect.any(Number),
        humanDownloadsLast30Days: expect.any(String),
        popular: false,
        _searchInternal: {
          downloadsMagnitude: expect.any(Number),
        },
      }),
    ]);
  });

  it('has the right approximate value for downloadsLast30Days', () => {
    const [jest, angular, holmes] = downloads.map((pkg) =>
      pkg.downloadsLast30Days.toString()
    );

    expect(jest.length).toBeGreaterThanOrEqual(6);
    expect(jest.length).toBeLessThanOrEqual(8);

    expect(angular.length).toBeGreaterThanOrEqual(6);
    expect(angular.length).toBeLessThanOrEqual(8);

    expect(holmes.length).toBeGreaterThanOrEqual(2);
    expect(holmes.length).toBeLessThanOrEqual(4);
  });

  it('has the right approximate value for downloadsMagnitude', () => {
    const [jest, angular, holmes] = downloads.map(
      (pkg) => pkg._searchInternal.downloadsMagnitude
    );

    expect(jest).toBeGreaterThanOrEqual(6);
    expect(jest).toBeLessThanOrEqual(8);

    expect(angular).toBeGreaterThanOrEqual(6);
    expect(angular).toBeLessThanOrEqual(8);

    expect(holmes).toBeGreaterThanOrEqual(2);
    expect(holmes).toBeLessThanOrEqual(4);
  });
});
