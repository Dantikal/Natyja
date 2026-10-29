const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {randomUUID}=require('crypto');

// Создаём папку uploads если её нет
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка хранения
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Уникальное имя: задача-ID_время_оригинальное-имя
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    cb(null, `task-${req.params.id}_${timestamp}-${randomUUID()}${ext}`);
  },
});

// Разрешённые типы файлов
const allowedTypes = [
  'application/msword',                                                     // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel',                                                // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
  'application/pdf',                                                         // .pdf
  'image/jpeg',
  'image/png',
];

const fileFilter = (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error('Разрешены только Word, Excel, PDF, JPG и PNG'), { status: 400 }), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 МБ
  },
});

module.exports = upload;
