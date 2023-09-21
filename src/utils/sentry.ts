import agent from 'elastic-apm-node';

import { log } from './log';

export function report(err: any, extra: any = {}): void {
  const logErr = [504].includes(err.statusCode)
    ? { statusCode: err.statusCode }
    : err;

  const logXtr = [504].includes(extra.err?.statusCode)
    ? { err: { statusCode: extra.err.statusCode } }
    : extra;

  log.error(logErr, logXtr);
  agent.captureError(err, { custom: extra });
}

export async function drain(): Promise<void> {
  return agent.flush();
}
