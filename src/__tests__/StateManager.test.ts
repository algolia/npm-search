import { StateManager } from '../StateManager';

describe('stateManager', () => {
  describe('get()', () => {
    it('should get userData from algolia', async () => {
      const mock = {
        getSettings: jest.fn(() => {
          return {
            userData: 'foobar',
          };
        }),
      } as any;
      const stateManager = new StateManager(mock);
      const userData = await stateManager.get();

      expect(mock.getSettings).toHaveBeenCalled();
      expect(userData).toBe('foobar');
    });
  });

  describe('set()', () => {
    it('should set userData to algolia', async () => {
      const mock = {
        setSettings: jest.fn(),
      } as any;
      const stateManager = new StateManager(mock);
      await stateManager.set({
        seq: 1,
        bootstrapDone: false,
        bootstrapLastDone: 1635196220508,
        bootstrapLastId: '',
        stage: 'bootstrap',
      });

      expect(mock.setSettings).toHaveBeenCalledWith({
        userData: {
          seq: 1,
          bootstrapDone: false,
          bootstrapLastDone: 1635196220508,
          bootstrapLastId: '',
          stage: 'bootstrap',
        },
      });
    });
  });

  describe('reset()', () => {
    it('should reset userData', async () => {
      const mock = {
        setSettings: jest.fn(),
      } as any;
      const stateManager = new StateManager(mock);
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
      } as any;
      const stateManager = new StateManager(mock);
      await stateManager.save({ foo: 'bar' } as any);

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
