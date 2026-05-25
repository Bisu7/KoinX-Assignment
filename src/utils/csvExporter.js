const { Parser } = require('json2csv');
const flatten = require('flat');

const exportToCsv = (data) => {
  if (!data || data.length === 0) {
    return '';
  }

  // Flatten nested objects (like discrepancyDetails or normalizedValues)
  const flattenedData = data.map(row => flatten(row));

  // Extract all unique headers across all documents (some might have different fields)
  const fieldsSet = new Set();
  flattenedData.forEach(row => {
    Object.keys(row).forEach(key => fieldsSet.add(key));
  });

  const fields = Array.from(fieldsSet);
  const json2csvParser = new Parser({ fields });

  return json2csvParser.parse(flattenedData);
};

module.exports = {
  exportToCsv,
};
