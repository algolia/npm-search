import bunyan from 'bunyan';
import PrettyStream from 'bunyan-prettystream';

const stream = new PrettyStream();
stream.pipe(process.stdout);

const logger = bunyan.createLogger({
  name: 'npm-search',
  streams: [{
    stream,
    type: raw,
  }],
});

export default logger;
