import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 32-byte key from the TOKEN_ENCRYPTION_KEY env var.
 * Accepts any string — uses SHA-256 to normalise to 32 bytes.
 */
function getKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext string and returns a base64-encoded ciphertext
 * in the format: <iv_hex>:<authTag_hex>:<ciphertext_base64>
 */
export function encryptToken(plaintext: string, secret: string): string {
  const key = getKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypts a token previously encrypted with encryptToken.
 * Throws if the ciphertext has been tampered with (GCM authentication check).
 */
export function decryptToken(ciphertext: string, secret: string): string {
  const [ivHex, authTagHex, encryptedBase64] = ciphertext.split(':');
  if (!ivHex || !authTagHex || !encryptedBase64) {
    throw new Error('Invalid ciphertext format');
  }
  const key = getKey(secret);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedBuffer = Buffer.from(encryptedBase64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
