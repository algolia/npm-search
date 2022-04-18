import type { State } from '../StateManager';
import { StateManager } from '../StateManager';
import { Bootstrap } from '../bootstrap';

function getAlgoliaMock(): any {
  return {
    setSettings: (): Promise<void> => {
      return Promise.resolve();
    },
    saveSynonyms: (): Promise<void> => {
      return Promise.resolve();
    },
    saveRules: (): Promise<{ taskID: string }> => {
      return Promise.resolve({ taskID: 'A' });
    },
    waitTask: (): Promise<void> => {
      return Promise.resolve();
    },
  };
}

describe('isDone', () => {
  it('should return true', async () => {
    const mock = {
      ...getAlgoliaMock(),
      getSettings: jest.fn(() => {
        const state: State = {
          bootstrapDone: true,
          bootstrapLastDone: Date.now(),
          bootstrapLastId: '1',
          seq: 1,
          stage: 'watch',
        };
        return {
          userData: state,
        };
      }),
    } as any;
    const stateManager = new StateManager(mock);
    const bootstrap = new Bootstrap(stateManager, {} as any, mock, {} as any);

    expect(await bootstrap.isDone()).toBe(true);
  });

  it('should return false', async () => {
    const mock = {
      ...getAlgoliaMock(),
      getSettings: jest.fn(() => {
        const state: State = {
          bootstrapDone: false,
          bootstrapLastDone: Date.now(),
          bootstrapLastId: '1',
          seq: 1,
          stage: 'watch',
        };
        return {
          userData: state,
        };
      }),
    } as any;
    const stateManager = new StateManager(mock);
    const bootstrap = new Bootstrap(stateManager, {} as any, mock, {} as any);

    expect(await bootstrap.isDone()).toBe(false);
  });
});
