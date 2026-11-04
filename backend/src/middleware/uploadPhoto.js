const multer = require('multer');
const sharp = require('sharp');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 30, fieldSize: 16384, parts: 31 } });
async function normalizePhoto(buffer) {
 const image = sharp(buffer, { limitInputPixels: 20000000, animated: false });
 const metadata = await image.metadata();
 if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('Invalid image');
 return image.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
}
module.exports = {
 single(field) {
  return (req, res, next) => parser.single(field)(req, res, async error => {
   if (error) return next(error);
   if (!req.file) return next();
   try {
    const buffer = await normalizePhoto(req.file.buffer);
    const filename = 'photo-' + randomUUID() + '.jpg';
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer, { flag: 'wx' });
    req.file = { ...req.file, buffer: undefined, filename, path: filePath, mimetype: 'image/jpeg', size: buffer.length };
    next();
   } catch { next(Object.assign(new Error('Загрузите корректное фото JPG, PNG или WEBP'), { status: 400 })); }
  });
 }, normalizePhoto,
};
