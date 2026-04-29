const fs = require('fs');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`Failed to remove temporary file ${filePath}: ${error.message}`);
    }
  }
}

module.exports = {
  ensureDir,
  safeUnlink
};
