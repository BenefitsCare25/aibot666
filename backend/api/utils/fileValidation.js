/**
 * File Validation Utilities
 * Validates file magic bytes to prevent malicious uploads
 */

import fs from 'fs/promises';

const MAGIC_BYTES = {
  'application/pdf': { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0 }, // %PDF
  'image/jpeg': { bytes: [0xFF, 0xD8, 0xFF], offset: 0 },
  'image/png': { bytes: [0x89, 0x50, 0x4E, 0x47], offset: 0 }, // .PNG
  'image/gif': { bytes: [0x47, 0x49, 0x46], offset: 0 }, // GIF
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { bytes: [0x50, 0x4B, 0x03, 0x04], offset: 0 }, // ZIP/XLSX
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { bytes: [0x50, 0x4B, 0x03, 0x04], offset: 0 }, // ZIP/DOCX
};

/**
 * Validate file magic bytes match the declared MIME type
 * @param {string} filePath - Path to uploaded file
 * @param {string} declaredMimeType - MIME type from multer
 * @returns {Promise<{valid: boolean, reason?: string}>}
 */
export async function validateFileMagicBytes(filePath, declaredMimeType) {
  try {
    const handle = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(8);
    await handle.read(buffer, 0, 8, 0);
    await handle.close();

    const expected = MAGIC_BYTES[declaredMimeType];
    if (!expected) {
      // No magic bytes check for this MIME type, allow
      return { valid: true };
    }

    const matches = expected.bytes.every(
      (byte, i) => buffer[expected.offset + i] === byte
    );

    if (!matches) {
      return {
        valid: false,
        reason: `File content does not match declared type: ${declaredMimeType}`
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('File validation error:', error);
    return { valid: false, reason: 'Failed to validate file' };
  }
}

export default { validateFileMagicBytes };
