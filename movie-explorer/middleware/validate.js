const Joi = require('joi');
const logger = require('../config/logger');

const movieQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  perPage: Joi.number().integer().min(1).max(100).default(20),
  year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
  genres: Joi.string().pattern(/^\d+(,\d+)*$/).optional(),
  without_genres: Joi.string().pattern(/^\d+(,\d+)*$/).optional(),
  sort_by: Joi.string().valid('popularity', 'vote_average', 'vote_count', 'release_date', 'revenue', 'title').default('popularity'),
  sort_order: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().max(255).optional(),
});

const validateQuery = (req, res, next) => {
  const { error, value } = movieQuerySchema.validate(req.query);
  if (error) {
    logger.warn(`Invalid query parameters: ${error.details[0].message}`);
    return res.status(400).json({ error: error.details[0].message });
  }
  req.query = value;
  next();
};

module.exports = validateQuery;