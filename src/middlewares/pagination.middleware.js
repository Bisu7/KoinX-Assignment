const paginate = (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const sortBy = req.query.sortBy || 'createdAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

  // Prevent enormous payloads
  const sanitizedLimit = limit > 1000 ? 1000 : limit;

  req.pagination = {
    page,
    limit: sanitizedLimit,
    skip: (page - 1) * sanitizedLimit,
    sort: { [sortBy]: sortOrder },
  };

  next();
};

module.exports = {
  paginate,
};
