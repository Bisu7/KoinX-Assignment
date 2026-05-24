const fs = require('fs');
const csv = require('csv-parser');

/**
 * Parses a CSV file using streams and calls processBatchCallback
 * @param {string} filePath 
 * @param {number} batchSize 
 * @param {Function} processBatchCallback async (batch) => {}
 */
const parseCsvInBatches = (filePath, batchSize, processBatchCallback) => {
  return new Promise((resolve, reject) => {
    let batch = [];
    const stream = fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', async (row) => {
        batch.push(row);
        if (batch.length >= batchSize) {
          // Pause stream to process batch
          stream.pause();
          try {
            await processBatchCallback([...batch]);
            batch = [];
            stream.resume();
          } catch (error) {
            stream.destroy(error);
          }
        }
      })
      .on('end', async () => {
        // Process remaining rows
        if (batch.length > 0) {
          try {
            await processBatchCallback(batch);
          } catch (error) {
            return reject(error);
          }
        }
        resolve();
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

module.exports = {
  parseCsvInBatches,
};
