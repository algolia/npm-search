import { log } from './log';

// Coming in nodejs 16
export function wait(waitTime: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, waitTime);
  });
}

export async function backoff(retry: number, pow: number): Promise<void> {
  // retry backoff
  const bo = Math.pow(retry + 1, pow) * 1000;
  log.info('Retrying (', retry, '), waiting for', bo);
  await wait(bo);
}
