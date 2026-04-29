function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error.code === 'SQLITE_BUSY' || error.code === 'SQLITE_LOCKED') {
    res.status(503).json({ error: '数据库繁忙，请稍后重试' });
    return;
  }
  if (error.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: '上传文件过大' });
    return;
  }
  res.status(error.status || 500).json({ error: error.message || '服务器错误' });
}

module.exports = errorHandler;
