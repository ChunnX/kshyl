/**
 * Storage abstraction. Mock/local writes to container disk and exposes files via the
 * `/files` static route; `cos` (Tencent COS) is the production target.
 *
 * All persisted artifacts (book exports, synthesized speech, later audio/photos) should
 * go through here so swapping to object storage is a one-file change.
 */
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const storageRoot = path.resolve(process.cwd(), env.storageDir);

/**
 * Persist a buffer under `key` (e.g. "exports/book_xxx.docx" or "speech/abc.mp3").
 * Returns a relative, client-resolvable URL like "/files/exports/book_xxx.docx".
 */
async function save({ buffer, key }) {
  if (!key) {
    throw new Error('storage.save requires a key');
  }

  if (env.storageProvider === 'cos') {
    return saveToCos({ buffer, key });
  }

  return saveToLocal({ buffer, key });
}

async function saveToLocal({ buffer, key }) {
  const safeKey = key.replace(/^\/+/, '');
  const filePath = path.join(storageRoot, safeKey);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, buffer);
  return {
    key: safeKey,
    url: `${env.storagePublicPath}/${safeKey}`,
    localPath: filePath,
    provider: 'local'
  };
}

async function saveToCos() {
  // Implemented in Phase C: upload to COS and return a (temporary signed) URL.
  const error = new Error('COS storage provider is not implemented yet. Set STORAGE_PROVIDER=local for now.');
  error.statusCode = 501;
  throw error;
}

module.exports = {
  save,
  storageRoot
};
