const fs = require('fs');
const csv = require('csv-parser');

const parseCsvInBatches = (filePath, batchSize, processBatchCallback, bufferSizeKb = 64) => {
  return new Promise((resolve, reject) => {
    let batch = [];
    const stream = fs.createReadStream(filePath, { highWaterMark: bufferSizeKb * 1024 })
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
