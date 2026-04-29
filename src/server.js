const { db } = require('./db');
const { waitForDbWrites } = require('./db/writeQueue');
const { createApp } = require('./app');

const port = Number(process.env.PORT || 9093);
const app = createApp();

const server = app.listen(port, () => {
  console.log(`Image annotation server running at http://0.0.0.0:${port}`);
});

function shutdown() {
  server.close(() => {
    waitForDbWrites()
      .finally(() => {
        try {
          db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
          db.close();
        } finally {
          process.exit(0);
        }
      });
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
