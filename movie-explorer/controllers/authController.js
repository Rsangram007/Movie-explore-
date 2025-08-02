const jwt = require('jsonwebtoken');
require('dotenv').config();
const logger = require('../config/logger');

const login = (req, res) => {
  const { username, password } = req.body;
 
  if (username === 'admin' && password === 'password') {
    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    logger.info(`User ${username} logged in successfully`);
    res.json({ token });
  } else {
    logger.warn(`Failed login attempt for username: ${username}`);
    res.status(401).json({ error: 'Invalid credentials' });
  }
};

module.exports = { login };