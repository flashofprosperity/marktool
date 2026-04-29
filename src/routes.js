const express = require('express');
const authRoutes = require('./modules/auth/routes');
const projectRoutes = require('./modules/projects/routes');
const importRoutes = require('./modules/imports/routes');

const router = express.Router();

router.use('/api', authRoutes);
router.use('/api/projects', projectRoutes);
router.use('/api/imports', importRoutes);

module.exports = router;
