const pool = require('../config/database');
const logger = require('../config/logger');

class GenreModel {
  static async getAllGenres() {
    try {
      const result = await pool.query('SELECT id, name FROM genres ORDER BY name');
      logger.info('Fetched all genres');
      return result.rows;
    } catch (error) {
      logger.error('Error fetching genres:', error);
      throw error;
    }
  }
}

module.exports = GenreModel;