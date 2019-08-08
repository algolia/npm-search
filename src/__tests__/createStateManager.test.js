import createStateManager from '../createStateManager.js';

describe('stateManager', () => {
  describe('get()', () => {
    it('should get userData from algolia', async () => {
      const mock = {
        getSettings: jest.fn(() => {
          return {
            userData: 'foobar',
          };
        }),
      };
      const stateManager = createStateManager(mock);
      const userData = await stateManager.get();

      expect(mock.getSettings).toHaveBeenCalled();
      expect(userData).toBe('foobar');
    });
  });

  describe('set()', () => {
    it('should set userData to algolia', async () => {
      const mock = {
        setSettings: jest.fn(),
      };
      const stateManager = createStateManager(mock);
      await stateManager.set('state');

      expect(mock.setSettings).toHaveBeenCalledWith({
        userData: 'state',
      });
    });
  });

  describe('reset()', () => {
    it('should reset userData', async () => {
      const mock = {
        setSettings: jest.fn(),
      };
      const stateManager = createStateManager(mock);
      await stateManager.reset();

      expect(mock.setSettings).toHaveBeenCalled();
    });
  });

  describe('save()', () => {
    it('should save userData to algolia', async () => {
      const mock = {
        getSettings: jest.fn(() => {
          return {
            userData: { bar: 'foo' },
          };
        }),
        setSettings: jest.fn(),
      };
      const stateManager = createStateManager(mock);
      await stateManager.save({ foo: 'bar' });

      expect(mock.getSettings).toHaveBeenCalled();
      expect(mock.setSettings).toHaveBeenCalledWith({
        userData: {
          bar: 'foo',
          foo: 'bar',
        },
      });
    });
  });
});
