const { db } = require('./index');

let dbWriteQueue = Promise.resolve();

function enqueueDbWrite(operation) {
  const run = dbWriteQueue.then(operation, operation);
  dbWriteQueue = run.catch(() => {});
  return run;
}

function runWriteTransaction(operation) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }
    throw error;
  }
}

function waitForDbWrites() {
  return Promise.resolve(dbWriteQueue);
}

module.exports = {
  enqueueDbWrite,
  runWriteTransaction,
  waitForDbWrites
};
