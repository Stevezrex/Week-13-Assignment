import { json, fail, readJson, onlyPost } from '../lib/http.mjs';
import { getLearnerStore, updateLearner, parseToken, mergeAnswers, attemptForToken } from '../lib/attempts.mjs';

export default async (req, context) => {
  const bad = onlyPost(req); if (bad) return bad;
  const parsed = await readJson(req); if (parsed.response) return parsed.response;
  const { token, answers, lock } = parsed.body;
  const id = parseToken(token);
  if (!id) return fail(401, 'Log in again.', 'token');
  const store = getLearnerStore(context);
  const r = await updateLearner(store, id, rec => {
    const t = attemptForToken(rec, token);
    if (!t.a) return { skip: true, reason: t.reason };
    const a = t.a;
    if (a.state !== 'open') return { skip: true, reason: 'closed' };
    a.answers = mergeAnswers(a.answers, answers, a.locked);
    if (Number.isInteger(lock) && lock >= 1 && lock <= 3 && lock === a.locked.length + 1) a.locked.push(lock);
    a.stage = Math.min(4, a.locked.length + 1);
    a.rev += 1;
    return { a };
  });
  if (r.missing) return fail(401, 'Log in again.', 'token');
  if (r.conflict) return fail(409, 'Try again.', 'conflict');
  if (r.result.reason) return fail(409, r.result.reason === 'device'
    ? 'This attempt is open on another device. Log in again to continue here.' : 'This attempt has ended.', r.result.reason);
  const a = r.result.a;
  return json(200, { rev: a.rev, stage: a.stage, locked: a.locked });
};

export const config = { path: '/api/save' };
