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

  it('has the right approximate value', () => {
    const [jest, angular, holmes] = dependents.map(pkg => pkg.dependents);

    // eslint-disable-next-line no-console
    console.log('dependents', { jest, angular, holmes });

    // real should be 2000
    expect(jest).toBeGreaterThan(1900);
    expect(jest).toBeLessThan(2100);

    // real should be 5200
    expect(angular).toBeGreaterThan(5000);
    expect(angular).toBeLessThan(5300);

    // real should be 0
    expect(holmes).toBe(0);
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
    const [jest, angular, holmes] = downloads.map(
      pkg => pkg.downloadsLast30Days
    );

    // eslint-disable-next-line no-console
    console.log('downloads', { jest, angular, holmes });

    expect(jest).toBeGreaterThan(4000000);
    expect(jest).toBeLessThan(6100000);

    expect(angular).toBeGreaterThan(1900000);
    expect(angular).toBeLessThan(3500000);

    expect(holmes).toBeGreaterThan(100);
    expect(holmes).toBeLessThan(550);
  });

  it('has the right approximate value for downloadsMagnitude', () => {
    const [jest, angular, holmes] = downloads.map(
      pkg => pkg._searchInternal.downloadsMagnitude
    );

    expect(jest).toBe(7);
    expect(angular).toBe(7);
    expect(holmes).toBe(3);
  });
});
