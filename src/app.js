const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const { errorConverter, errorHandler } = require('./middlewares/error.middleware');
const morgan = require('./middlewares/logger.middleware');
const routes = require('./routes/v1');
const ApiError = require('./utils/apiError');

const app = express();

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// set security HTTP headers
app.use(helmet({
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false,
  hsts: false,
}));

// parse json request body
app.use(express.json());

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// gzip compression
app.use(compression());

// enable cors
app.use(cors());
// app.options('*', cors()); // Commented out to avoid Express 5 path-to-regexp wildcard error

// v1 api routes
app.use('/api/v1', routes);

// simple root route for browser testing
app.get('/', (req, res) => {
  res.send('Crypto Transaction Reconciliation Engine API is running. Check /api/v1/health for status.');
});

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(404, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

module.exports = app;
