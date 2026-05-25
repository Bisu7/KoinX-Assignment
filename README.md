# KoinX Crypto Transaction Reconciliation Engine

A high-performance, production-grade engine built to reconcile massive sets of cryptocurrency transactions across internal databases (User Ledgers) and external exchange ledgers (Binance, Coinbase, etc.) using sliding-window fuzzy matching.

---

## Project Overview

Cryptocurrency reconciliation is notoriously difficult due to micro-second timestamp drifts, varying asset names (e.g., `BTC` vs `BITCOIN`), transaction type mismatches, and precision loss in decimals.

This backend engine provides a robust solution that:
- **Normalizes Data**: Standardizes asset names, directions (`TRANSFER_IN`), and parses ISO/UTC dates.
- **Fuzzy Matching**: Matches transactions using a configurable timestamp tolerance (e.g., ±300 seconds) and quantity drift (e.g., ±1%).
- **Conflict Resolution**: Identifies duplicate records and flags 1-to-many matches for manual auditing.
- **Data Quality Pipeline**: Safely catches corrupt or malformed rows and logs them into a dedicated Data Quality dashboard without crashing the ingestion stream.

---

## Architecture Decisions

This project follows a clean **Service-Oriented Architecture (MVC + Services)**.

1. **Streaming Ingestion**: The engine reads CSVs using Node.js Streams (`csv-parser`) and pipes them through transformation layers into MongoDB. This prevents V8 Out-Of-Memory (OOM) crashes regardless of CSV file size.
2. **Database-Bound Reconciliation**: Instead of pulling all pending transactions into local RAM, the engine uses **MongoDB Cursors** and **Compound B-Tree Indexes**. It scans `UserTransactions` iteratively and queries targeted `$gte`/`$lte` boundaries for `ExchangeTransactions`.
3. **Idempotency & Locks**: Transactions are locked using a `status: 'processing'` state to prevent race conditions during distributed multi-worker runs.
4. **Validation**: Built with `Joi` to enforce strong typing for configurations and API payloads.

---

## Folder Structure

```text
├── src/
│   ├── config/             # Joi Validation & Environment Configs
│   ├── controllers/        # Express Route Controllers
│   ├── middlewares/        # Global Error Handling, Multer, Pagination
│   ├── models/             # Mongoose Schemas (UserTx, ExchangeTx, Run, Result)
│   ├── routes/v1/          # API Route Definitions
│   ├── services/           # Core Business Logic (Ingestion, Matching, Reporting)
│   ├── utils/              # Helper utilities (CSV parsing, Aliasing, Match Scoring)
│   ├── docs/               # OpenAPI 3.0 Swagger Specifications
│   └── app.js              # Express Bootstrapper
├── tests/                  # Jest Unit, Integration, and API Supertests
├── coverage/               # Jest LCOV Code Coverage Reports
├── .env.example            # Environment variables template
└── README.md
```

---

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- MongoDB (Local instance or Atlas URI)

### Local Development Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Rename `.env.example` to `.env` and fill in your variables.
4. Start the server:
   ```bash
   npm run dev
   ```

---

## Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/koinx-reconciliation

# Default Tolerances (can be overridden in API)
TIMESTAMP_TOLERANCE_SECONDS=300
QUANTITY_TOLERANCE_PCT=0.01
MATCH_SCORE_THRESHOLD=80
MAX_BATCH_SIZE=500
CSV_STREAM_BUFFER_SIZE=64
```

---

## API Documentation (OpenAPI/Swagger)

This project features a fully interactive OpenAPI 3.0 Dashboard.
When the server is running, navigate to:
👉 **[http://localhost:5000/api/v1/docs](http://localhost:5000/api/v1/docs)**

From this UI, you can test the `multipart/form-data` uploads, trigger reconciliations, and view the API schemas.

---

## Reconciliation Logic Explanation

1. **Normalization**: `deposit` becomes `TRANSFER_IN`, `withdrawal` becomes `TRANSFER_OUT`. Assets like `bitcoin` become `BTC`.
2. **Matching Strategy**: When a user deposits 1.5 BTC, the engine looks for an Exchange transaction of type `TRANSFER_IN` for 1.5 BTC. 
   - However, if the user *withdraws* 1.5 BTC (`TRANSFER_OUT`), the engine correctly searches for a `TRANSFER_IN` on the exchange side.
3. **Scoring**: Candidates receive up to 100 points. Points are deducted based on timestamp drift and fractional quantity drift. If the score is above `MATCH_SCORE_THRESHOLD` (80), it's a match.
4. **Conflicts**: If two identical exchange transactions happen at the exact same time, the engine flags the transaction as `conflicting` requiring manual review.

### Assumptions Made
- The timezone for all CSV files is treated as UTC.
- Commas within CSV numbers are invalid; numbers should be standard floats.
- Transaction "hashes" are often absent across different exchanges, so matching relies purely on temporal and quantitative proximity.

### Edge Cases Handled
- **Division by Zero**: Quantities of `0.00` are handled cleanly by the tolerance calculator without throwing `NaN`.
- **Duplicate Tying**: Prevents random matching when multiple 100% duplicate Exchange transactions exist for a single User transaction.
- **Partial Batch Failures**: If the engine crashes halfway through a run, all locked records are reverted to `pending`.

---

## Scalability Considerations

- **Horizontal Scaling**: The engine processes records using atomic database locking (`$set: { status: 'processing' }`). This means you can run 10 instances of this Express server simultaneously without double-processing rows.
- **Memory Safety**: Uses Mongoose `.cursor()` to parse data 1-by-1, maintaining a flat ~100MB RAM footprint even when reconciling 10 million rows.
- **Queue Architecture (Future)**: The ingestion pipeline can be easily detached into a RabbitMQ / BullMQ worker queue for distributed processing in enterprise environments.

---

## Testing Instructions

The project uses `Jest`, `Supertest`, and an ephemeral `mongodb-memory-server` to mock the entire database.

```bash
# Run all Unit, Integration, and API tests
npm test

# Run tests with Coverage Report
npm test -- --coverage
```
*Current Suite: 23 Passing Tests across 5 Test Suites with robust logic coverage.*

---

## Sample API Requests

### 1. Ingest Data (cURL)
```bash
curl -X POST http://localhost:5000/api/v1/upload \
  -F "userFile=@user_transactions.csv" \
  -F "exchangeFile=@exchange_transactions.csv"
```

### 2. Trigger Reconciliation
```bash
curl -X POST http://localhost:5000/api/v1/reconcile \
  -H "Content-Type: application/json" \
  -d '{ "runName": "Q1 Audit", "timestampToleranceSeconds": 500 }'
```

---

## Sample Reconciliation Report

**`GET /api/v1/report/REC-12345/summary`**
```json
{
  "status": "success",
  "data": {
    "totalProcessed": 15000,
    "matched": 14850,
    "conflicting": 5,
    "unmatchedUser": 90,
    "unmatchedExchange": 55,
    "successRate": 99.0
  }
}
```

---
