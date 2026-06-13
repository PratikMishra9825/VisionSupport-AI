import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

// Get key of exact 32 bytes derived from config
const getEncryptionKey = (): Buffer => {
  const secret = process.env.AES_KEY || process.env.JWT_SECRET || 'visionsupport_super_aes_secret_key_32_bytes';
  return crypto.scryptSync(secret, 'visionsupport-salt-scrypt', 32);
};

// Encrypt text into hex string (format: iv_hex:auth_tag_hex:encrypted_content_hex)
export const encryptText = (text: string): string => {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
  } catch (error) {
    console.error('Text encryption failed:', error);
    throw new Error('Encryption failed');
  }
};

// Decrypt text hex string
export const decryptText = (encryptedData: string): string => {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Text decryption failed:', error);
    throw new Error('Decryption failed');
  }
};

// Encrypt buffer (returns concatenated Buffer: iv + auth_tag + encrypted_data)
export const encryptBuffer = (buffer: Buffer): Buffer => {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    // Structure: IV (12 bytes) + Tag (16 bytes) + Encrypted Data
    return Buffer.concat([iv, tag, encrypted]);
  } catch (error) {
    console.error('Buffer encryption failed:', error);
    throw new Error('Buffer encryption failed');
  }
};

// Decrypt buffer
export const decryptBuffer = (buffer: Buffer): Buffer => {
  try {
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = buffer.subarray(IV_LENGTH + 16);
    
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch (error) {
    console.error('Buffer decryption failed:', error);
    throw new Error('Buffer decryption failed');
  }
};

// 2FA - Generate Secret and QR Code for Agent configuration
export const generate2FASecret = async (email: string): Promise<{ secret: string; qrCodeUrl: string }> => {
  const secret = speakeasy.generateSecret({
    name: `VisionSupport AI (${email})`,
    issuer: 'VisionSupport AI',
  });

  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');
  return {
    secret: secret.base32,
    qrCodeUrl,
  };
};

// 2FA - Verify token code
export const verify2FACode = (secret: string, code: string): boolean => {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: 1, // Allowance window for drift
  });
};
