import c from './config.js';
import PouchDB from 'pouchdb';
const db = new PouchDB(c.npmRegistryEndpoint);

testAllDocs();
testChanges();

function testAllDocs() {
  console.time('allDocs');
  db.allDocs({
    limit: 500,
    startkey: 'lodash',
    include_docs: true, // eslint-disable-line camelcase
    conflicts: false,
    attachments: false,
  }).then(res => {
    db.allDocs({
      limit: 500,
      startkey: res.rows[res.rows.length - 1].id,
      skip: 1,
      include_docs: true, // eslint-disable-line camelcase
      conflicts: false,
      attachments: false,
    }).then(res => {
      db.allDocs({
        limit: 500,
        startkey: res.rows[res.rows.length - 1].id,
        skip: 1,
        include_docs: true, // eslint-disable-line camelcase
        conflicts: false,
        attachments: false,
      }).then(res => {
        console.timeEnd('allDocs');
      });
    });
  });
}

function testChanges() {
  console.time('changes');
  db.changes({
    limit: 500,
    since: 500000,
    include_docs: true, // eslint-disable-line camelcase
    conflicts: false,
    attachments: false,
  }).then(res => {
    db.changes({
      limit: 500,
      since: res.last_seq,
      include_docs: true, // eslint-disable-line camelcase
      conflicts: false,
      attachments: false,
    }).then(res => {
      db.changes({
        limit: 500,
        since: res.last_seq,
        include_docs: true, // eslint-disable-line camelcase
        conflicts: false,
        attachments: false,
      }).then(res => {
        console.timeEnd('changes');
      });
    });
  });
}
