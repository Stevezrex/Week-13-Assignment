// Identity, attempts, tokens, Blob reads and writes, store name.
import { getStore } from '@netlify/blobs';
import { createHash, randomBytes } from 'node:crypto';
import { acceptValue, stageOfItem } from './marking.mjs';

let factory = null;
// Tests supply an in memory store through this hook. Production never calls it.
export function setStoreFactory(fn) { factory = fn; }

function storeName(context) {
  return 'sim-w13-' + (context && context.deploy && context.deploy.context ? context.deploy.context : 'dev');
}

export function getLearnerStore(context) {
  const name = storeName(context);
  if (factory) return factory(name);
  return getStore({ name, consistency: 'strong' });
}

export const MAX_ATTEMPTS = 3;
export const ALL_USED = 'You have used all 3 attempts. Your highest score counts.';
export const NAME_MSG = 'Enter your name using letters.';
export const EMAIL_MSG = 'Enter a valid email address.';
const OTHER_EMAIL_MSG = 'This email is registered to another learner. Use the name and email you first registered.';

export function normName(s) {
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/).filter(Boolean).sort().join(' ');
}
export function normEmail(s) { return String(s).trim().toLowerCase(); }
function hash(s) { return createHash('sha256').update(s).digest('hex').slice(0, 32); }
function newId() { return randomBytes(6).toString('hex'); }
export function newToken(id) { return id + '.' + randomBytes(16).toString('hex'); }

export function validName(raw) {
  const s = String(raw == null ? '' : raw).trim().replace(/\s+/g, ' ');
  if (s.length < 2 || s.length > 80) return null;
  if (!/^[\p{L}\p{M}\s'’.,-]+$/u.test(s)) return null;
  if (!/\p{L}/u.test(s)) return null;
  return s;
}
export function validEmail(raw) {
  const s = normEmail(raw == null ? '' : raw);
  if (s.length > 120 || s.length < 6) return null;
  if (!/^[^\s@<>()\[\]\\,;:"]+@[^\s@<>()\[\]\\,;:"]+\.[^\s@<>()\[\]\\,;:"]{2,}$/.test(s)) return null;
  return s;
}

async function readLearner(store, id) {
  const r = await store.getWithMetadata('learner/' + id, { type: 'json' });
  if (!r) return null;
  return { rec: r.data, etag: r.etag };
}

// Read, change, write with onlyIfMatch. One retry on a changed etag.
export async function updateLearner(store, id, mutate) {
  for (let i = 0; i < 2; i++) {
    const cur = await readLearner(store, id);
    if (!cur) return { missing: true };
    const result = await mutate(cur.rec);
    if (result && result.skip) return { rec: cur.rec, result };
    const w = await store.setJSON('learner/' + id, cur.rec, { onlyIfMatch: cur.etag });
    if (w.modified) return { rec: cur.rec, result };
  }
  return { conflict: true };
}

// Login table from section 3. Returns { id } for a known learner, { id, record } for a
// new learner whose record the caller writes, or { message }.
export async function findOrCreate(store, name, email) {
  const nh = hash(normName(name));
  const eh = hash(email);
  const [nameId, emailId] = await Promise.all([store.get('name/' + nh), store.get('email/' + eh)]);
  if (emailId && nameId && emailId !== nameId) return { message: OTHER_EMAIL_MSG };
  if (emailId) return { id: emailId };
  if (nameId) {
    // Name matches, email is new: link the email to the learner.
    const w = await store.set('email/' + eh, nameId, { onlyIfNew: true });
    if (!w.modified) {
      const owner = await store.get('email/' + eh);
      if (owner !== nameId) return { message: OTHER_EMAIL_MSG };
    }
    return { id: nameId };
  }
  const id = newId();
  const a = await store.set('name/' + nh, id, { onlyIfNew: true });
  const b = await store.set('email/' + eh, id, { onlyIfNew: true });
  if (!a.modified || !b.modified) {
    // A parallel login won an index. Use the winner.
    const [wn, we] = await Promise.all([store.get('name/' + nh), store.get('email/' + eh)]);
    if (wn && we && wn !== we) return { message: OTHER_EMAIL_MSG };
    return { id: we || wn };
  }
  return { id, record: { id, name, email, test: email.endsWith('@test.example'), created: new Date().toISOString(), best: 0, attempts: [] } };
}

export function parseToken(token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{12}\.[0-9a-f]{32}$/.test(token)) return null;
  return token.slice(0, 12);
}

export function openAttempt(rec) {
  return rec.attempts.find(a => a.state === 'open') || null;
}

// What the browser receives about an attempt. Never marks or scores.
export function publicAttempt(a) {
  return { n: a.n, token: a.token, rev: a.rev, stage: a.stage, locked: a.locked, answers: a.answers, resetUsed: a.resetUsed };
}

// Replaces answers of unlocked stages with the incoming ones. Locked stages keep stored values.
export function mergeAnswers(stored, incoming, locked) {
  const out = {};
  for (const [id, v] of Object.entries(stored)) if (locked.includes(stageOfItem(id))) out[id] = v;
  if (incoming && typeof incoming === 'object') {
    for (const [id, v] of Object.entries(incoming)) {
      if (!acceptValue(id, v)) continue;
      if (locked.includes(stageOfItem(id))) continue;
      out[id] = v;
    }
  }
  return out;
}

// Finds the open attempt for a token, or the reason it cannot be used.
export function attemptForToken(rec, token) {
  const mine = rec.attempts.find(a => a.token === token);
  if (mine) return { a: mine };
  if (rec.attempts.some(a => a.state === 'open')) return { reason: 'device' };
  return { reason: 'closed' };
}

