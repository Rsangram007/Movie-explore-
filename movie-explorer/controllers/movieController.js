const axios = require("axios");
const MovieModel = require("../models/movieModel");
const { TMDB_API_KEY, TMDB_BASE_URL, fallbackData } = require("../config/tmdb");
const logger = require("../config/logger");

async function initializeDatabase(req, res) {
  try {
    await MovieModel.initializeDatabase();
    if (res) res.json({ message: "Database initialized successfully" });
  } catch (error) {
    logger.error("Failed to initialize database:", error.message);
    if (res) res.status(500).json({ error: "Failed to initialize database" });
    throw error.message;
  }
}

async function fetchAndStoreMovies(req, res) {
  try {
    let movies = [];
    let page = 1;
    let totalPages = 1;

    while (movies.length < 500 && page <= totalPages) {
      try {
        const response = await axios.get(`${TMDB_BASE_URL}/discover/movie`, {
          params: { api_key: TMDB_API_KEY, page },
        });
        movies = [...movies, ...response.data.results];
        totalPages = response.data.total_pages;
        page++;
      } catch (error) {
        logger.error("TMDB discover API failed, using fallback", error.message);
        movies = [...movies, ...fallbackData.discover.results];
        totalPages = fallbackData.discover.total_pages;
        break;
      }
    }

    // Parallel fetching of movie details and credits
    const moviePromises = movies.slice(0, 500).map((movie) =>
      Promise.all([
        axios
          .get(`${TMDB_BASE_URL}/movie/${movie.id}`, {
            params: { api_key: TMDB_API_KEY },
          })
          .catch(() => ({
            data:
              fallbackData.movieDetails.find((m) => m.id === movie.id) || {},
          })),
        axios
          .get(`${TMDB_BASE_URL}/movie/${movie.id}/credits`, {
            params: { api_key: TMDB_API_KEY },
          })
          .catch(() => ({
            data: fallbackData.credits.find((c) => c.id === movie.id) || {
              cast: [],
            },
          })),
      ]).then(([detailsResponse, creditsResponse]) => ({
        movie,
        details: detailsResponse.data,
        credits: creditsResponse.data,
      }))
    );

    const results = await Promise.all(moviePromises);
    for (const { movie, details, credits } of results) {
      await MovieModel.storeMovieDetails(movie, details, credits);
    }

    if (res) res.json({ message: "Movies fetched and stored successfully" });
  } catch (error) {
    logger.error("Error fetching/storing movies:", error.message);
    if (res) res.status(500).json({ error: "Failed to fetch/store movies" });
    throw error;
  }
}

async function getMovies(req, res) {
  try {
    const movies = await MovieModel.getMovies(req.query);
    res.json(movies);
  } catch (error) {
    logger.error("Error in getMovies controller:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { initializeDatabase, fetchAndStoreMovies, getMovies };
