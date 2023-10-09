import { setTimeout } from 'node:timers/promises';

import { log } from './log';

export async function backoff(
  retry: number,
  pow: number,
  max: number
): Promise<void> {
  // retry backoff
  const bo = Math.min(Math.pow(retry + 1, pow) * 1000, max);
  log.info('Retrying (', retry, '), waiting for', bo);
  await setTimeout(bo);
}
