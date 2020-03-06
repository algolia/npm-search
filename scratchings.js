const got = require('got');

got('https://unpkg.com/@atlaskit/button@13.3.7/CHANGELOG.md', {
  method: 'HEAD',
}).then(console.log);
