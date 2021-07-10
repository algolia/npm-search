import http from 'http';

import { log } from './utils/log';

export function createAPI(): void {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        code: 200,
      })
    );
  });

  server.listen(8000, () => {
    log.info(`⛑   API started on port 8000`);
  });
}
