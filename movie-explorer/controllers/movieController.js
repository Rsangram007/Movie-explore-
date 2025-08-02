const axios = require("axios");
const MovieModel = require("../models/movieModel");
const { TMDB_API_KEY, TMDB_BASE_URL, fallbackData } = require("../config/tmdb");
const logger = require("../config/logger");
// console.log(fallbackData)
const TMDB_PROXY_URL =
  "https://thingproxy.freeboard.io/fetch/https://api.themoviedb.org/3";
const TMDB_BEARER_TOKEN = process.env.TMDB_TOKEN;

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

    // Fetch paginated movies
    while (movies.length < 500 && page <= totalPages) {
      try {
        const { data } = await axios.get(`${TMDB_PROXY_URL}/discover/movie`, {
          params: { page },
          headers: {
            Authorization: TMDB_BEARER_TOKEN,
            accept: "application/json",
          },
        });
        // console.log("data", data);
        movies.push(...data.results);
        totalPages = data.total_pages;
        page++;
      } catch (err) {
        console.log(err.message);
        logger.error("TMDB API failed, using fallback:", err.message);
        movies.push(...fallbackData.discover.results);
        totalPages = fallbackData.discover.total_pages;
        break;
      }
    }

    // Fetch details and credits in parallel
    const moviePromises = movies.slice(0, 500).map((movie) =>
      Promise.all([
        axios
          .get(`${TMDB_PROXY_URL}/movie/${movie.id}`, {
            headers: { Authorization: `Bearer ${TMDB_BEARER_TOKEN}` },
          })
          .catch(() => ({
            data:
              fallbackData.movieDetails.find((m) => m.id === movie.id) || {},
          })),
        axios
          .get(`${TMDB_PROXY_URL}/movie/${movie.id}/credits`, {
            headers: { Authorization: `Bearer ${TMDB_BEARER_TOKEN}` },
          })
          .catch(() => ({
            data: fallbackData.credits.find((c) => c.id === movie.id) || {
              cast: [],
            },
          })),
      ]).then(([details, credits]) => ({
        movie,
        details: details.data,
        credits: credits.data,
      }))
    );

    const results = await Promise.all(moviePromises);

    // Store in DB
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
