import * as api from '../../npm/index';

jest.setTimeout(15000);

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

describe('getDoc()', () => {
  it('retrieves a single doc', async () => {
    const doc = await api.getDoc(
      'jsdelivr',
      '8-734f30eea3baad0a62452a3bff1dd116'
    );

    expect(doc.name).toBe('jsdelivr');
    expect(Object.keys(doc.versions)).toHaveLength(2);
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
