// Parsing happens in an isolated process with a memory and time limit.
process.once('message', async ({ extension, data }) => {
  try {
    const buffer = Buffer.from(data, 'base64');
    let text;
    if (extension === '.txt') text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    else if (extension === '.docx') {
      if (buffer.subarray(0, 2).toString() !== 'PK') throw new Error('BAD_FILE');
      text = (await require('mammoth').extractRawText({ buffer })).value;
    } else if (extension === '.pdf') {
      if (!buffer.subarray(0, 5).toString().startsWith('%PDF-')) throw new Error('BAD_FILE');
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: new Uint8Array(buffer), isEvalSupported: false });
      try { text = (await parser.getText({ first: 40 })).text; }
      finally { await parser.destroy(); }
    }
    if (['.png', '.jpg', '.jpeg'].includes(extension)) {
      const sharp = require('sharp');
      const image = sharp(buffer, { limitInputPixels: 16000000, animated: false });
      const metadata = await image.metadata();
      if (!['png', 'jpeg'].includes(metadata.format)) throw new Error('BAD_FILE');
      const normalized = await image.rotate().resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).png().toBuffer();
      const { createWorker } = require('tesseract.js');
      const worker = await createWorker(['rus', 'eng'], 1, { langPath: require('node:path').resolve(__dirname, '../../ocr-data'), gzip: false, cacheMethod: 'none' });
      try { text = (await worker.recognize(normalized)).data.text; }
      finally { await worker.terminate(); }
    }
    text = String(text || '').replace(/\u0000/g, '').trim();
    if (text.length < 10) throw new Error('NO_TEXT');
    process.send({ text: text.slice(0, 80000), truncated: text.length > 80000 || extension === '.pdf' }, () => process.exit(0));
  } catch { process.send({ error: 'Не удалось прочитать текст. Используйте TXT, DOCX, PDF с текстом или чёткое фото текста JPG/PNG до 16 мегапикселей.' }, () => process.exit(0)); }
});
