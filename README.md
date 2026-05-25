# KoinX Crypto Transaction Reconciliation Engine

A high-performance, production-grade engine built to reconcile millions of cryptocurrency transactions across internal databases and external exchange ledgers using sliding-window fuzzy matching.

## Getting Started

1. **Prerequisites**: Ensure you have Node.js (v18+) and MongoDB running locally (or provide an Atlas URI in the `.env` file).
2. **Install**: 
   ```bash
   npm install
   ```
3. **Start the Engine**: 
   ```bash
   npm run dev
   ```
   *The server will boot up on `http://localhost:5000`*

---

## How to Use the Engine (Step-by-Step API Guide)

You can interact with the engine using any API client like **Postman**, **Insomnia**, or **cURL**. The project root contains two sample files: `user_transactions.csv` and `exchange_transactions.csv`.

### Step 1: Ingest Data
First, upload the CSV files into the system. The engine will parse the CSV streams, automatically normalize variations (like mapping "bitcoin" to "BTC" and "deposit" to "TRANSFER_IN"), and filter out bad rows.

**Endpoint**: `POST /api/v1/upload`
**Content-Type**: `multipart/form-data`
**Body**:
- `userFile`: Select the `user_transactions.csv` file from the root folder.
- `exchangeFile`: Select the `exchange_transactions.csv` file from the root folder.

*Both files must be uploaded in the same request!*

### Step 2: Run the Reconciliation Engine
Once data is loaded as "pending", trigger the matching algorithm. This uses a sub-O(N²) indexed scoring system to find perfect and fuzzy matches based on your tolerances.

**Endpoint**: `POST /api/v1/reconcile`
**Content-Type**: `application/json`
**Body** (Optional Overrides):
```json
{
  "runName": "May 2026 Audit",
  "timestampToleranceSeconds": 300,
  "quantityTolerancePct": 0.01
}
```
*The response will return a summary containing a unique `runId` (e.g. `REC-1779626000160`) which you will use for reporting.*

### Step 3: View the Dashboard Summaries
Get a high-level statistical breakdown of the matching success rate.

**Endpoint**: `GET /api/v1/report/:runId/summary`
*(Replace `:runId` with the ID returned in Step 2)*

### Step 4: Export the Data
You can fetch the detailed, paginated ledger. To download the report as a CSV file instantly, simply append `?format=csv`.

**Endpoints**:
- **Full Ledger**: `GET /api/v1/report/:runId`
- **Only Unmatched**: `GET /api/v1/report/:runId/unmatched`
- **Download as CSV**: `GET /api/v1/report/:runId?format=csv`

### Step 5: Audit Bad Data
Did the ingestion step say it found invalid rows (e.g. negative quantities or malformed dates)? You can audit exactly what failed ingestion without looking at server logs.

**Endpoints**: 
- **Summary**: `GET /api/v1/data-quality/summary`
- **Raw Rows**: `GET /api/v1/data-quality/issues`
