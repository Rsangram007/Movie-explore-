# Movie Explorer API

A RESTful API built with Node.js, Express, and PostgreSQL that fetches and stores movie data from the TMDB (The Movie Database) API, allowing users to query movies with filters such as year, genres, and search terms. The API is secured with JWT authentication and includes fallback data for offline scenarios.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [Example Requests](#example-requests)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features
- Fetch and store movie data (up to 500 movies) from TMDB API.
- Store movie details, genres, and cast in a PostgreSQL database.
- Paginated movie search with filters for year, genres, search terms, and sorting.
- JWT-based authentication for secure access.
- Fallback data mechanism for handling TMDB API failures.
- CORS support for cross-origin requests.

## Prerequisites
- **Node.js**: Version 14 or higher.
- **PostgreSQL**: Version 12 or higher, with a database named `grok`.
- **TMDB API Key**: Obtain from [TMDB](https://www.themoviedb.org/settings/api).
- **Git**: For cloning the repository (optional).

## Installation
1. **Clone the Repository** (if applicable):
   ```bash
   git clone <https://github.com/Rsangram007/Movie-explore-.git>
   cd movie-explorer-api
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Install PostgreSQL**:
   - Ensure PostgreSQL is installed and running.
   - Create a database named `MovieExplorer`:
     ```bash
     createdb MovieExplorer
     ```

4. **Set Up TMDB API Key**:
   - Replace the `TMDB_API_KEY` in `server.js` with your TMDB API key:
     ```javascript
     const TMDB_API_KEY = 'your-tmdb-api-key';
     ```

5. **Set Up JWT Secret**:
   - Replace the `JWT_SECRET` in `server.js` with a secure secret:
     ```javascript
     const JWT_SECRET = 'your_jwt_secret';
     ```
   - For production, store this in an environment variable (e.g., using a `.env` file with `dotenv`).

## Configuration
Update the PostgreSQL configuration in `server.js` to match your setup:
```javascript
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'MovieExplorer',
  password: '1234', // Update with your PostgreSQL password
  port: 5432,
});
```

Optionally, create a `.env` file for environment variables:
```bash
touch .env
```
Add:
```
TMDB_API_KEY=your-tmdb-api-key
JWT_SECRET=your_jwt_secret
DB_USER=postgres
DB_HOST=localhost
DB_NAME=MovieExplorer
DB_PASSWORD=1234
DB_PORT=5432
```

Install `dotenv` and load it in `server.js`:
```bash
npm install dotenv
```
```javascript
require('dotenv').config();
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
```

## Running the Application
1. Start the server:
   ```bash
   node server.js
   ```
   The server will run on `http://localhost:3000` (or the port specified in `process.env.PORT`).

2. The application will:
   - Initialize the database tables (`genres`, `movies`, `movie_genres`, `actors`, `movie_actors`).
   - Fetch and store up to 500 movies from TMDB (or use fallback data if the API fails).

## API Endpoints

### POST `/api/login`
Authenticates a user and returns a JWT token.
- **Request Body**:
  ```json
  {
    "username": "admin",
    "password": "password"
  }
  ```
- **Response** (Success):
  ```json
  {
    "token": "<jwt-token>"
  }
  ```
- **Response** (Failure):
  ```json
  {
    "error": "Invalid credentials"
  }
  ```

### GET `/api/movies` (Protected)
Retrieves a paginated list of movies with optional filters.
- **Headers**:
  - `Authorization: Bearer <jwt-token>`
- **Query Parameters**:
  - `page` (default: 1): Page number.
  - `perPage` (default: 20): Movies per page.
  - `year`: Filter by release year (e.g., `2020`).
  - `genres`: Comma-separated genre IDs to include (e.g., `28,12` for Action and Adventure).
  - `without_genres`: Comma-separated genre IDs to exclude (e.g., `27` for Horror).
  - `sort_by`: Sort field (`popularity`, `vote_average`, `vote_count`, `release_date`, `revenue`, `title`; default: `popularity`).
  - `sort_order`: Sort order (`asc` or `desc`; default: `desc`).
  - `search`: Search by movie title or actor name (e.g., `Avengers`).
- **Response** (Success):
  ```json
  {
    "results": [
      {
        "id": 123,
        "title": "Avengers: Endgame",
        "original_title": "Avengers: Endgame",
        "overview": "After the devastating events...",
        "release_date": "2019-04-26",
        "popularity": 85.123,
        "vote_average": 8.3,
        "vote_count": 20000,
        "revenue": 2797800564,
        "runtime": 181,
        "genre_names": ["Action", "Adventure"],
        "cast_names": ["Robert Downey Jr.", "Chris Evans"]
      }
    ],
    "page": 1,
    "total_pages": 5,
    "total_results": 50
  }
  ```
- **Response** (Failure):
  ```json
  {
    "error": "Access token required" // or "Invalid token" or "Internal server error"
  }
  ```

## Example Requests

### Login
```bash
curl -X POST http://localhost:3000/api/login \
-H "Content-Type: application/json" \
-d '{"username":"admin","password":"password"}'
```

### Get Movies (Filtered)
```bash
curl -X GET "http://localhost:3000/api/movies?page=1&perPage=10&year=2020&genres=28,12&sort_by=vote_average&sort_order=desc&search=Avengers" \
-H "Authorization: Bearer <jwt-token>"
```

### JavaScript Example (with `fetch`)
```javascript
// Login
fetch('http://localhost:3000/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'password' }),
})
  .then(res => res.json())
  .then(data => {
    const token = data.token;
    // Fetch movies
    fetch('http://localhost:3000/api/movies?page=1&perPage=10', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => console.log(data.results))
      .catch(err => console.error('Error:', err));
  });
```

## Troubleshooting
- **Server Fails to Start**:
  - Check PostgreSQL is running and credentials in `server.js` or `.env` are correct.
  - Ensure all dependencies are installed (`npm install`).
- **No Movies Returned**:
  - Verify the database has been populated by checking the `movies` table.
  - Ensure the TMDB API key is valid or fallback JSON files exist in the `fallback/` directory.
- **Invalid Token**:
  - Obtain a fresh token from `/api/login`. Tokens expire after 1 hour.
- **CORS Issues**:
  - The API allows all origins by default. For production, restrict CORS to specific domains.
- **TMDB API Rate Limits**:
  - If TMDB API calls fail, the server uses fallback data. Ensure `fallback/discover.json`, `fallback/movie_details.json`, and `fallback/credits.json` exist.

## Contributing
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/your-feature`).
3. Commit changes (`git commit -m 'Add your feature'`).
4. Push to the branch (`git push origin feature/your-feature`).
5. Open a pull request.

## License
This project is licensed under the MIT License.