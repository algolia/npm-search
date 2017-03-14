import bunyan from 'bunyan';
import bunyanDebugStream from 'bunyan-debug-stream';

const stream = bunyanDebugStream({
  basepath: __dirname,
});

const logger = bunyan.createLogger({
  name: 'npm-search',
  streams: [
    {
      level: 'debug',
      type: 'raw',
      stream,
    },
  ],
  serializers: bunyanDebugStream.serializers,
});

export default logger;
