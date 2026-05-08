'use strict';

const express = require('express');
const router = express.Router();

const { getDashboard } = require('../controllers/dashboardController');
const { protect } = require('../middlewares/auth');

router.get('/', protect, getDashboard);

module.exports = router;
