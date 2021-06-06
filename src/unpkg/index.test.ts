import { fileExistsInUnpkg } from './index';

describe('unpkg', () => {
  it('should do a successful HEAD request', async () => {
    const exists = await fileExistsInUnpkg('jest', '24.8.0', 'bin/jest.js');
    expect(exists).toBe(true);
  });

  it('should do a failed HEAD request', async () => {
    const exists = await fileExistsInUnpkg(
      'jest',
      '24.8.0',
      'bin/notexists.js'
    );
    expect(exists).toBe(false);
  });
});
