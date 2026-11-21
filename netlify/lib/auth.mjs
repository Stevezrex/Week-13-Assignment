// Assessor password check, lock counter, signed token.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const sha = s => createHash('sha256').update(String(s)).digest();
const WINDOW_MS = 15 * 60 * 1000;
const TOKEN_SECONDS = 2 * 60 * 60;

export function passwordMatches(typed, actual) {
  return timingSafeEqual(sha(typed), sha(actual));
}

export function signToken(password, now = Date.now()) {
  const exp = Math.floor(now / 1000) + TOKEN_SECONDS;
  const sig = createHmac('sha256', sha(password)).update(String(exp)).digest('base64url');
  return { token: exp + '.' + sig, expires: exp };
}

export function checkToken(token, password, now = Date.now()) {
  if (typeof token !== 'string' || !password) return false;
  const m = /^(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!m) return false;
  if (Number(m[1]) <= Math.floor(now / 1000)) return false;
  const want = createHmac('sha256', sha(password)).update(m[1]).digest('base64url');
  const a = Buffer.from(m[2]); const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Lock counter record { count, first }. A window older than 15 minutes starts again.
export function lockState(rec, now = Date.now()) {
  if (!rec || now - rec.first > WINDOW_MS) return { count: 0, first: now };
  return rec;
}
export const isLocked = rec => rec.count >= 5;
