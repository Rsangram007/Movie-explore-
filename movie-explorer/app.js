const express = require("express");
const cors = require("cors");
const logger = require("./config/logger");
const {
  initializeDatabase,
  fetchAndStoreMovies,
} = require("./controllers/movieController");
const movieRoutes = require("./routes/movies");
const authRoutes = require("./routes/auth");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/movies", movieRoutes);
app.use("/api", authRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);
  try {
    await initializeDatabase();
    logger.info("Proceeding to fetch and store movies...");
    await fetchAndStoreMovies();
  } catch (error) {
    logger.error("Failed to initialize application:", error);
    process.exit(1);
  }
});
