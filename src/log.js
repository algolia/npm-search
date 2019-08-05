import bunyan from 'bunyan';
import bunyanDebugStream from 'bunyan-debug-stream';

const stream = bunyanDebugStream({
  showDate: process.env.NODE_ENV !== 'production',
  showProcess: false,
  showLoggerName: false,
  showPid: process.env.NODE_ENV !== 'production',
});

const logger = bunyan.createLogger({
  name: 'npm-search',
  streams: [
    {
      level: 'info',
      type: 'raw',
      stream,
    },
  ],
  serializers: bunyanDebugStream.serializers,
});

export default logger;
