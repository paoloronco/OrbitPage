import fs from 'fs';

const SIGNATURE_BYTES = 32;

function startsWith(buffer, values, offset = 0) {
  return values.every((value, index) => buffer[offset + index] === value);
}

export function detectUploadedMediaType(filePath) {
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(SIGNATURE_BYTES);
    const bytesRead = fs.readSync(descriptor, header, 0, header.length, 0);
    if (bytesRead < 4) return null;

    if (bytesRead >= 12 && header.toString('ascii', 4, 8) === 'ftyp') return 'video/mp4';
    if (startsWith(header, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
    if (header.toString('ascii', 0, 6) === 'GIF87a' || header.toString('ascii', 0, 6) === 'GIF89a') return 'image/gif';
    return null;
  } finally {
    fs.closeSync(descriptor);
  }
}

export function assertUploadedMediaSignature({ filePath, contentType }) {
  const detectedType = detectUploadedMediaType(filePath);
  if (!detectedType || detectedType !== contentType) {
    throw new Error('The uploaded file content does not match its declared media type.');
  }
  return detectedType;
}
