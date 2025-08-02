const express = require('express');
const router = express.Router();
const { getMovies } = require('../controllers/movieController');
const authenticateToken = require('../middleware/auth');
const validateQuery = require('../middleware/validate');

router.get('/', authenticateToken, validateQuery, getMovies);

module.exports = router;