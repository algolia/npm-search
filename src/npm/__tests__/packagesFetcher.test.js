import PackagesFetcher from '../packagesFetcher';
import wait from '../../utils/wait';

jest.setTimeout(20 * 1000);

describe('Prefetch: limit 1, max 1', () => {
  const packagesFetcher = new PackagesFetcher({
    limit: 1,
    max: 1,
  });

  it('should have not prefetched anything', () => {
    expect(packagesFetcher.storage).toHaveLength(0);
    expect(packagesFetcher.nextKey).toBe(null);
    expect(packagesFetcher.lastPrefetchOffset).toBe(0);
    expect(packagesFetcher.actualOffset).toBe(0);
    expect(packagesFetcher.nextOffset).toBe(0);
  });

  it('should have prefetched 1 package', async () => {
    await packagesFetcher.prefetch();
    await wait(1); // Force ourself into next call stack

    expect(packagesFetcher.storage).toHaveLength(1);
    expect(packagesFetcher.lastPrefetchOffset).toBe(0);
    expect(packagesFetcher.actualOffset).toBe(0);
  });

  it('should get and removed 1 package', () => {
    const packages = packagesFetcher.get();

    expect(packages).toHaveLength(1);
    expect(packagesFetcher.storage).toHaveLength(0);
  });

  it('should have prefetched 1 package again', async () => {
    await packagesFetcher.prefetch();

    expect(packagesFetcher.storage).toHaveLength(1);
    expect(packagesFetcher.lastPrefetchOffset).toBe(1);
    expect(packagesFetcher.actualOffset).toBe(0);
    expect(packagesFetcher.nextOffset).toBe(1);
  });
});

describe('Prefetch: limit 5, max 20', () => {
  const packagesFetcher = new PackagesFetcher({
    limit: 5,
    max: 20,
  });

  it('should have prefetched 5 packages', async () => {
    await packagesFetcher.prefetch();

    expect(packagesFetcher.storage).toHaveLength(5);
    expect(packagesFetcher.lastPrefetchOffset).toBe(0);
    expect(packagesFetcher.actualOffset).toBe(0);
    expect(packagesFetcher.nextOffset).toBe(0);
  });

  it('should get 5 packages', () => {
    const packages = packagesFetcher.get();

    expect(packages).toHaveLength(5);
    expect(packagesFetcher.actualOffset).toBe(0);
    expect(packagesFetcher.nextOffset).toBe(5);
  });

  it('should prefetch 50 packages', async () => {
    while (packagesFetcher.storage.length < 20) {
      await wait(3000);
    }

    expect(packagesFetcher.storage).toHaveLength(20);
    expect(packagesFetcher.lastPrefetchOffset).toBe(20);
    expect(packagesFetcher.actualOffset).toBe(0);
    expect(packagesFetcher.nextOffset).toBe(5);
  });
});
