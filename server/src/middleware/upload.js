/**
 * Multer uploaders with file-type and size validation.
 * Keeps raw uploads landing in env.uploadDir (multer temp), separate from the
 * served storage dir. Size limits are overridable via env for different deploys.
 */
const multer = require('multer');
const env = require('../config/env');

const MAX_AUDIO_BYTES = Number(process.env.MAX_AUDIO_BYTES || 25 * 1024 * 1024); // 25MB
const MAX_IMAGE_BYTES = Number(process.env.MAX_IMAGE_BYTES || 10 * 1024 * 1024); // 10MB

function buildUploader({ maxBytes, allowedMimePrefix, allowedExt }) {
  return multer({
    dest: env.uploadDir,
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter(req, file, cb) {
      const mime = file.mimetype || '';
      const ext = (file.originalname.split('.').pop() || '').toLowerCase();
      const mimeOk = allowedMimePrefix.some((prefix) => mime.startsWith(prefix));
      const extOk = allowedExt.includes(ext);
      if (mimeOk || extOk) {
        cb(null, true);
        return;
      }
      const error = new Error('不支持的文件类型');
      error.statusCode = 400;
      cb(error);
    }
  });
}

const audioUpload = buildUploader({
  maxBytes: MAX_AUDIO_BYTES,
  allowedMimePrefix: ['audio/'],
  allowedExt: ['mp3', 'm4a', 'aac', 'wav', 'amr', 'silk', 'pcm', 'ogg', 'webm']
});

const photoUpload = buildUploader({
  maxBytes: MAX_IMAGE_BYTES,
  allowedMimePrefix: ['image/'],
  allowedExt: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp']
});

module.exports = {
  audioUpload,
  photoUpload
};
