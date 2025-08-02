const pool = require('../config/database');
const logger = require('../config/logger');

class MovieModel {
  static async initializeDatabase() {
    try {
      logger.info('Initializing database tables...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS genres (
          id INTEGER PRIMARY KEY,
          name VARCHAR(100) NOT NULL
        );
        CREATE TABLE IF NOT EXISTS movies (
          id INTEGER PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          original_title VARCHAR(255),
          overview TEXT,
          release_date DATE,
          popularity FLOAT,
          vote_average FLOAT,
          vote_count INTEGER,
          revenue BIGINT,
          runtime INTEGER
        );
        CREATE TABLE IF NOT EXISTS movie_genres (
          movie_id INTEGER REFERENCES movies(id),
          genre_id INTEGER REFERENCES genres(id),
          PRIMARY KEY (movie_id, genre_id)
        );
        CREATE TABLE IF NOT EXISTS actors (
          id INTEGER PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          gender INTEGER,
          popularity FLOAT,
          profile_path VARCHAR(255)
        );
        CREATE TABLE IF NOT EXISTS movie_actors (
          movie_id INTEGER REFERENCES movies(id),
          cast_id INTEGER REFERENCES actors(id),
          character_name VARCHAR(255),
          order_num INTEGER,
          PRIMARY KEY (movie_id, cast_id)
        );
      `);
      logger.info('Database tables created successfully');
    } catch (error) {
      logger.error('Error initializing database:', error);
      throw error;
    }
  }

  static async storeMovieDetails(movie, movieDetails, credits) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Store movie
      await client.query(`
        INSERT INTO movies (id, title, original_title, overview, release_date, popularity, vote_average, vote_count, revenue, runtime)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING
      `, [
        movie.id,
        movieDetails.title || movie.title,
        movieDetails.original_title || movie.original_title,
        movieDetails.overview || movie.overview,
        movieDetails.release_date || movie.release_date,
        movieDetails.popularity || movie.popularity,
        movieDetails.vote_average || movie.vote_average,
        movieDetails.vote_count || movie.vote_count,
        movieDetails.revenue || 0,
        movieDetails.runtime || 0,
      ]);

      // Store genres
      const genres = movieDetails.genres || [];
      for (const genre of genres) {
        await client.query(`
          INSERT INTO genres (id, name)
          VALUES ($1, $2)
          ON CONFLICT (id) DO NOTHING
        `, [genre.id, genre.name]);
        await client.query(`
          INSERT INTO movie_genres (movie_id, genre_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [movie.id, genre.id]);
      }

      // Store actors
      for (const castMember of credits.cast) {
        await client.query(`
          INSERT INTO actors (id, name, gender, popularity, profile_path)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO NOTHING
        `, [
          castMember.id,
          castMember.name,
          castMember.gender,
          castMember.popularity,
          castMember.profile_path,
        ]);
        await client.query(`
          INSERT INTO movie_actors (movie_id, cast_id, character_name, order_num)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT DO NOTHING
        `, [movie.id, castMember.id, castMember.character, castMember.order]);
      }

      await client.query('COMMIT');
      logger.info(`Successfully stored movie ${movie.id}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error storing movie ${movie.id}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  // static async getMovies({ page, perPage, year, genres, without_genres, sort_by, sort_order, search }) {
  //   try {
  //     let query = `
  //       SELECT DISTINCT m.*, 
  //         array_agg(g.name) as genre_names,
  //         array_agg(c.name) as cast_names
  //       FROM movies m
  //       LEFT JOIN movie_genres mg ON m.id = mg.movie_id
  //       LEFT JOIN genres g ON mg.genre_id = g.id
  //       LEFT JOIN movie_actors mc ON m.id = mc.movie_id
  //       LEFT JOIN actors c ON mc.cast_id = c.id
  //     `;
  //     let whereClauses = [];
  //     let params = [];

  //     if (year) {
  //       whereClauses.push(`EXTRACT(YEAR FROM m.release_date) = $${params.length + 1}`);
  //       params.push(year);
  //     }

  //     if (genres) {
  //       const genreArray = genres.split(',');
  //       whereClauses.push(`g.id = ANY($${params.length + 1}::integer[])`);
  //       params.push(`{${genreArray.join(',')}}`);
  //     }

  //     if (without_genres) {
  //       const withoutGenreArray = without_genres.split(',');
  //       whereClauses.push(`m.id NOT IN (
  //         SELECT mg2.movie_id 
  //         FROM movie_genres mg2 
  //         WHERE mg2.genre_id = ANY($${params.length + 1}::integer[])
  //       )`);
  //       params.push(`{${withoutGenreArray.join(',')}}`);
  //     }

  //     if (search) {
  //       whereClauses.push(`
  //         (m.title ILIKE $${params.length + 1} OR c.name ILIKE $${params.length + 1})
  //       `);
  //       params.push(`%${search}%`);
  //     }

  //     if (whereClauses.length > 0) {
  //       query += ' WHERE ' + whereClauses.join(' AND ');
  //     }

  //     query += ' GROUP BY m.id';
  //     const validSortFields = ['popularity', 'vote_average', 'vote_count', 'release_date', 'revenue', 'title'];
  //     const sortField = validSortFields.includes(sort_by) ? sort_by : 'popularity';
  //     const sortOrder = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  //     query += ` ORDER BY m.${sortField} ${sortOrder}`;
  //     query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  //     params.push(perPage, (page - 1) * perPage);

  //     const result = await pool.query(query, params);
  //     const countQuery = `
  //       SELECT COUNT(DISTINCT m.id) as total
  //       FROM movies m
  //       LEFT JOIN movie_genres mg ON m.id = mg.movie_id
  //       LEFT JOIN genres g ON mg.genre_id = g.id
  //       LEFT JOIN movie_actors mc ON m.id = mc.movie_id
  //       LEFT JOIN actors c ON mc.cast_id = c.id
  //       ${whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''}
  //     `;
  //     const countResult = await pool.query(countQuery, params.slice(0, -2));

  //     return {
  //       results: result.rows,
  //       page: parseInt(page),
  //       total_pages: Math.ceil(countResult.rows[0].total / perPage),
  //       total_results: parseInt(countResult.rows[0].total),
  //     };
  //   } catch (error) {
  //     logger.error('Error fetching movies:', error);
  //     throw error;
  //   }
  // }



static async getMovies({ 
  page = 1, 
  perPage = 20, 
  year, 
  genres, 
  without_genres, 
  sort_by = 'popularity', 
  sort_order = 'desc', 
  search 
} = {}) {
  try {
    let query = `
      SELECT DISTINCT m.*, 
        array_agg(g.name) as genre_names,
        array_agg(c.name) as cast_names
      FROM movies m
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      LEFT JOIN movie_actors mc ON m.id = mc.movie_id
      LEFT JOIN actors c ON mc.cast_id = c.id
    `;
    let whereClauses = [];
    let params = [];

    if (year) {
      whereClauses.push(`EXTRACT(YEAR FROM m.release_date) = $${params.length + 1}`);
      params.push(year);
    }

    if (genres) {
      const genreArray = genres.split(',');
      whereClauses.push(`g.id = ANY($${params.length + 1}::integer[])`);
      params.push(`{${genreArray.join(',')}}`);
    }

    if (without_genres) {
      const withoutGenreArray = without_genres.split(',');
      whereClauses.push(`m.id NOT IN (
        SELECT mg2.movie_id 
        FROM movie_genres mg2 
        WHERE mg2.genre_id = ANY($${params.length + 1}::integer[])
      )`);
      params.push(`{${withoutGenreArray.join(',')}}`);
    }

    if (search) {
      whereClauses.push(`
        (m.title ILIKE $${params.length + 1} OR c.name ILIKE $${params.length + 1})
      `);
      params.push(`%${search}%`);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    query += ' GROUP BY m.id';
    const validSortFields = ['popularity', 'vote_average', 'vote_count', 'release_date', 'revenue', 'title'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'popularity';
    const sortOrder = (sort_order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY m.${sortField} ${sortOrder}`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(perPage, (page - 1) * perPage);

    const result = await pool.query(query, params);
    const countQuery = `
      SELECT COUNT(DISTINCT m.id) as total
      FROM movies m
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      LEFT JOIN movie_actors mc ON m.id = mc.movie_id
      LEFT JOIN actors c ON mc.cast_id = c.id
      ${whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''}
    `;
    const countResult = await pool.query(countQuery, params.slice(0, -2));

    return {
      results: result.rows,
      page: parseInt(page),
      total_pages: Math.ceil(countResult.rows[0].total / perPage),
      total_results: parseInt(countResult.rows[0].total),
    };
  } catch (error) {
    logger.error('Error fetching movies:', error);
    throw error;
  }
}

}

module.exports = MovieModel;