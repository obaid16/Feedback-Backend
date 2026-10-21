import crypto from 'node:crypto';

let argon2Module = null;
try {
  argon2Module = await import('argon2');
} catch (err) {
  // Argon2 will be dynamically loaded if available
}

/**
 * Hash a password using Argon2id with recommended OWASP parameters,
 * with a scrypt fallback if native binaries are restricted.
 */
export async function hashPassword(plainTextPassword) {
  if (argon2Module && argon2Module.default) {
    return argon2Module.default.hash(plainTextPassword, {
      type: argon2Module.default.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4
    });
  }

  // Cryptographically secure scrypt fallback
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(plainTextPassword, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt:${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verify a password against its stored hash
 */
export async function verifyPassword(plainTextPassword, storedHash) {
  if (!storedHash || !plainTextPassword) return false;

  if (storedHash.startsWith('$argon2') && argon2Module && argon2Module.default) {
    return argon2Module.default.verify(storedHash, plainTextPassword);
  }

  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const key = parts[2];

    return new Promise((resolve) => {
      crypto.scrypt(plainTextPassword, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
        if (err) return resolve(false);
        const keyBuffer = Buffer.from(key, 'hex');
        try {
          resolve(crypto.timingSafeEqual(keyBuffer, derivedKey));
        } catch {
          resolve(false);
        }
      });
    });
  }

  // Fallback for argon2 hash when module failed to load initially
  if (storedHash.startsWith('$argon2')) {
    try {
      const dynamicArgon = await import('argon2');
      return dynamicArgon.default.verify(storedHash, plainTextPassword);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Generate a cryptographically secure random token (hex or base64url)
 */
export function generateRandomToken(bytes = 32, encoding = 'hex') {
  return crypto.randomBytes(bytes).toString(encoding);
}

/**
 * Create a SHA-256 hash of a token (e.g. For DB indexing/storage of reset tokens)
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate PKCE code_verifier and code_challenge
 */
export function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return { verifier, challenge };
}

/**
 * Timing-safe string equality comparison
 */
export function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
