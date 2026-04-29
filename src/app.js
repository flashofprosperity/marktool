const path = require('path');
const express = require('express');
const { rootDir } = require('./db');
const { runMigrations } = require('./db/migrations');
const { attachUser } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');
const authService = require('./modules/auth/service');
const projectsRepository = require('./modules/projects/repository');
const importsService = require('./modules/imports/service');

function createApp() {
  runMigrations();
  authService.initializeUsers();
  authService.ensureCredentialReminder();
  projectsRepository.syncExistingProjectEventRecords();
  importsService.failInterruptedRunningJobs();

  const app = express();
  app.use(express.json({ limit: '100mb' }));
  app.use('/data', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(express.static(rootDir));
  app.use(attachUser);
  app.use(routes);
  app.get('/', (req, res) => {
    res.sendFile(path.join(rootDir, 'default.html'));
  });
  app.use(errorHandler);
  return app;
}

module.exports = {
  createApp
};
