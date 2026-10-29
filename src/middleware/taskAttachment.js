const multer = require('multer');

// Keep the file in memory until task validation succeeds, avoiding orphaned uploads.
module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const allowed = {
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    };
    const extension = require('path').extname(file.originalname).toLowerCase();
    if (!allowed[extension] || ![allowed[extension], 'application/octet-stream'].includes(file.mimetype)) {
      return callback(Object.assign(new Error('Разрешены только Word, Excel, PDF, JPG и PNG'), { status: 400 }));
    }
    callback(null, true);
  },
}).single('attachment');
