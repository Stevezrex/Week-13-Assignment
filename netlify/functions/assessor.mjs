import { json, fail, readJson } from '../lib/http.mjs';
import { getLearnerStore } from '../lib/attempts.mjs';
import { passwordMatches, signToken, checkToken, lockState, isLocked } from '../lib/auth.mjs';

const WAIT = 'Try again in 15 minutes.';

async function login(req, context) {
  if (req.method !== 'POST') return fail(405, 'Method not allowed.');
  const password = process.env.ASSESSOR_PASSWORD;
  if (!password) return fail(503, 'Set ASSESSOR_PASSWORD, then deploy again.');
  const parsed = await readJson(req); if (parsed.response) return parsed.response;
  const typed = typeof parsed.body.password === 'string' ? parsed.body.password : '';
  const store = getLearnerStore(context);
  const now = Date.now();
  const raw = await store.get('assessor/lock', { type: 'json' });
  const lock = lockState(raw, now);
  if (isLocked(lock)) return fail(429, WAIT);
  if (!passwordMatches(typed, password)) {
    await store.setJSON('assessor/lock', { count: lock.count + 1, first: lock.count ? lock.first : now });
    return fail(401, 'Check the password and try again.');
  }
  if (raw && raw.count) await store.setJSON('assessor/lock', { count: 0, first: now });
  return json(200, signToken(password, now));
}

async function list(req, context) {
  if (req.method !== 'GET') return fail(405, 'Method not allowed.');
  const password = process.env.ASSESSOR_PASSWORD;
  if (!password) return fail(503, 'Set ASSESSOR_PASSWORD, then deploy again.');
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!checkToken(token, password)) return fail(401, 'Log in again.');
  const store = getLearnerStore(context);
  const keys = [];
  for await (const page of store.list({ prefix: 'learner/', paginate: true })) {
    for (const b of page.blobs) keys.push(b.key);
  }
  const learners = [];
  for (let i = 0; i < keys.length; i += 25) {
    const batch = await Promise.all(keys.slice(i, i + 25).map(k => store.get(k, { type: 'json' })));
    for (const rec of batch) {
      if (!rec) continue;
      learners.push({
        id: rec.id, name: rec.name, email: rec.email,
        test: String(rec.email).endsWith('@test.example'),
        best: rec.best || 0,
        attempts: rec.attempts.map(a => ({ n: a.n, state: a.state, score: a.state === 'submitted' ? a.score : null }))
      });
    }
  }
  return json(200, { generated: new Date().toISOString(), learners });
}

export default async (req, context) => {
  const path = new URL(req.url).pathname;
  if (path.endsWith('/login')) return login(req, context);
  if (path.endsWith('/list')) return list(req, context);
  return fail(404, 'Not found.');
};

export const config = { path: ['/api/assessor/login', '/api/assessor/list'] };
