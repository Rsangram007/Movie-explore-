const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    //  winston.format.timestamp(),
    // winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({
          all: true,
          colors: {
            info: 'cyan',
            error: 'red',
            warn: 'yellow',
            success: 'green',
          },
        }),
        winston.format.simple()
      ),
    }),
  ],
});

// Add a custom success level for green-colored success messages
logger.add(
  new winston.transports.Console({
    level: 'success',
    format: winston.format.combine(
      winston.format.colorize({ level: true }),
      winston.format.simple()
    ),
  })
);

module.exports = logger;