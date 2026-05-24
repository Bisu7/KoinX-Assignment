# Crypto Transaction Reconciliation Engine Backend

This is a production-grade backend boilerplate using Node.js, Express, and MongoDB.

## Tech Stack
- **Node.js & Express**
- **MongoDB & Mongoose**
- **Winston & Morgan** (Logging)
- **Dotenv** (Environment variables)

## Architecture
It follows a clean, Service-Oriented Architecture (MVC + Services):
- `src/controllers`: Request/Response handling.
- `src/services`: Core business logic.
- `src/repositories`: Database access layer.
- `src/models`: Mongoose schemas.
- `src/routes`: Express routing.
- `src/middlewares`: Custom express middlewares.

## Getting Started

1. Ensure MongoDB is running locally or provide a connection URI in `.env`.
2. Run `npm install`.
3. Start the dev server: `npm run dev`.

The server will be available at `http://localhost:5000`.
Health check: `http://localhost:5000/api/v1/health`
