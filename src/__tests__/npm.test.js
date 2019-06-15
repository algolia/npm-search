import { info, getDownloads, getDependents } from '../npm';

describe('info()', () => {
  let registryInfo;
  beforeAll(async () => {
    registryInfo = await info();
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
    dependents = await getDependents([
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
    const [jest, angular, holmes] = dependents.map(pkg => pkg.dependents);
    expect(jest).toBe(0);
    expect(angular).toBe(0);
    expect(holmes).toBe(0);
  });

  it.skip('has the right approximate value', () => {
    const [jest, angular, holmes] = dependents.map(pkg =>
      pkg.dependents.toString()
    );

    // eslint-disable-next-line no-console
    console.log('dependents', { jest, angular, holmes });

    // real should be 2100
    expect(jest).toHaveLength(4);

    // real should be 5200
    expect(angular).toHaveLength(4);

    // real should be 0
    expect(holmes).toHaveLength(1);
  });
});

describe('getDownloads()', () => {
  let downloads;
  beforeAll(async () => {
    downloads = await getDownloads([
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
    const [jest, angular, holmes] = downloads.map(pkg =>
      pkg.downloadsLast30Days.toString()
    );

    // eslint-disable-next-line no-console
    // console.log('downloads', { jest, angular, holmes });

    expect(jest.length).toBeGreaterThanOrEqual(6);
    expect(jest.length).toBeLessThanOrEqual(8);

    expect(angular.length).toBeGreaterThanOrEqual(6);
    expect(angular.length).toBeLessThanOrEqual(8);

    expect(holmes.length).toBeGreaterThanOrEqual(2);
    expect(holmes.length).toBeLessThanOrEqual(4);
  });

  it('has the right approximate value for downloadsMagnitude', () => {
    const [jest, angular, holmes] = downloads.map(
      pkg => pkg._searchInternal.downloadsMagnitude
    );

    expect(jest).toBeGreaterThanOrEqual(6);
    expect(jest).toBeLessThanOrEqual(8);

    expect(angular).toBeGreaterThanOrEqual(6);
    expect(angular).toBeLessThanOrEqual(8);

    expect(holmes).toBeGreaterThanOrEqual(2);
    expect(holmes).toBeLessThanOrEqual(4);
  });
});
