import { json, fail, readJson, onlyPost } from '../lib/http.mjs';
import { getLearnerStore, updateLearner, parseToken, publicAttempt, attemptForToken } from '../lib/attempts.mjs';

export default async (req, context) => {
  const bad = onlyPost(req); if (bad) return bad;
  const parsed = await readJson(req); if (parsed.response) return parsed.response;
  const id = parseToken(parsed.body.token);
  if (!id) return fail(401, 'Log in again.', 'token');
  const store = getLearnerStore(context);
  const r = await updateLearner(store, id, rec => {
    const t = attemptForToken(rec, parsed.body.token);
    if (!t.a) return { skip: true, reason: t.reason };
    const a = t.a;
    if (a.state !== 'open') return { skip: true, reason: 'closed' };
    if (a.resetUsed) return { skip: true, a }; // a second call returns the attempt unchanged
    a.answers = {}; a.locked = []; a.stage = 1; a.resetUsed = true; a.rev += 1;
    return { a };
  });
  if (r.missing) return fail(401, 'Log in again.', 'token');
  if (r.conflict) return fail(409, 'Try again.', 'conflict');
  if (r.result.reason) return fail(409, r.result.reason === 'device'
    ? 'This attempt is open on another device. Log in again to continue here.' : 'This attempt has ended.', r.result.reason);
  return json(200, { open: publicAttempt(r.result.a) });
};

export const config = { path: '/api/reset' };
