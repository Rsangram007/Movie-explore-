 

const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// Database configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'grok', // Changed to movie_explorer
  password: '1234', // Your provided password
  port: 5432,
});

// TMDB API configuration
const TMDB_API_KEY = 'eec8ca18da6c9523e3f50a8c6f69c633';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const fallbackData = {
  discover: require('./fallback/discover.json'),
  movieDetails: require('./fallback/movie_details.json'),
  credits: require('./fallback/credits.json'),
};

// JWT Secret
const JWT_SECRET = 'your_jwt_secret';

// Middleware for JWT authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Database initialization
async function initializeDatabase() {
  try {
    console.log('Starting database initialization...');
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
    console.log('Database tables created successfully');
  } catch (error) {
    console.error('Detailed error initializing database:', error);
    throw error; // Propagate error to stop execution
  }
}

// Fetch and store movies
async function fetchAndStoreMovies() {
  try {
    let movies = [];
    let page = 1;
    let totalPages = 1;

    // Fetch movies from TMDB
    while (movies.length < 500 && page <= totalPages) {
      try {
        const response = await axios.get(`${TMDB_BASE_URL}/discover/movie`, {
          params: {
            api_key: TMDB_API_KEY,
            page,
          },
        });
        movies = [...movies, ...response.data.results];
        totalPages = response.data.total_pages;
        page++;
      } catch (error) {
        console.error('TMDB discover API failed, using fallback');
        movies = [...movies, ...fallbackData.discover.results];
        totalPages = fallbackData.discover.total_pages;
        break;
      }
    }

    // Process first 500 movies
    for (const movie of movies.slice(0, 500)) {
      await storeMovieDetails(movie);
    }
  } catch (error) {
    console.error('Error fetching/storing movies:', error);
  }
}

async function storeMovieDetails(movie) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Store movie details
    let movieDetails;
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/movie/${movie.id}`, {
        params: { api_key: TMDB_API_KEY },
      });
      movieDetails = response.data;
    } catch (error) {
      console.error(`TMDB movie details API failed for movie ${movie.id}, using fallback`);
      movieDetails = fallbackData.movieDetails.find(m => m.id === movie.id) || {};
    }

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
    const genres = movieDetails.genres || fallbackData.movieDetails.find(m => m.id === movie.id)?.genres || [];
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

    // Store cast
    let credits;
    try {
      const response = await axios.get(`${TMDB_BASE_URL}/movie/${movie.id}/credits`, {
        params: { api_key: TMDB_API_KEY },
      });
      credits = response.data;
    } catch (error) {
      console.error(`TMDB credits API failed for movie ${movie.id}, using fallback`);
      credits = fallbackData.credits.find(c => c.id === movie.id) || { cast: [] };
    }

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
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Error storing movie ${movie.id}:`, error);
  } finally {
    client.release();
  }
}

// Paginated movies API
app.get('/api/movies', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      perPage = 20,
      year,
      genres,
      without_genres,
      sort_by = 'popularity',
      sort_order = 'desc',
      search,
    } = req.query;

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
    const sortOrder = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
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

    res.json({
      results: result.rows,
      page: parseInt(page),
      total_pages: Math.ceil(countResult.rows[0].total / perPage),
      total_results: parseInt(countResult.rows[0].total),
    });
  } catch (error) {
    console.error('Error fetching movies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint for JWT
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  // Simple authentication (replace with real auth in production)
  if (username === 'admin' && password === 'password') {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Start server and initialize
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await initializeDatabase();
    console.log('Proceeding to fetch and store movies...');
    await fetchAndStoreMovies();
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
});