require('dotenv').config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const fallbackData = {
  discover: require('../fallback/discover.json'),
  movieDetails: require('../fallback/movie_details.json'),
  credits: require('../fallback/credits.json'),
};

module.exports = { TMDB_API_KEY, TMDB_BASE_URL, fallbackData };