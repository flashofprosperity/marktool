const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const rootDir = path.resolve(__dirname, '..', '..');
const dataDir = path.join(rootDir, 'data');
const dbPath = path.join(dataDir, 'projects.db');
const credentialsPath = path.join(dataDir, 'user-credentials.txt');
const tempUploadsDir = path.join(dataDir, 'temp-uploads');

fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath);

module.exports = {
  db,
  rootDir,
  dataDir,
  dbPath,
  credentialsPath,
  tempUploadsDir
};
