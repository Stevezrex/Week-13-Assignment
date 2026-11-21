import { json, fail, readJson, onlyPost } from '../lib/http.mjs';
import { getLearnerStore, updateLearner, parseToken, mergeAnswers, attemptForToken, MAX_ATTEMPTS } from '../lib/attempts.mjs';
import { markAttempt } from '../lib/marking.mjs';

export default async (req, context) => {
  const bad = onlyPost(req); if (bad) return bad;
  const parsed = await readJson(req); if (parsed.response) return parsed.response;
  const { token, answers } = parsed.body;
  const id = parseToken(token);
  if (!id) return fail(401, 'Log in again.', 'token');
  const store = getLearnerStore(context);
  const r = await updateLearner(store, id, rec => {
    const t = attemptForToken(rec, token);
    if (!t.a) return { skip: true, reason: t.reason };
    const a = t.a;
    if (a.state === 'submitted') return { skip: true, done: true }; // second submit: first result, no write
    a.answers = mergeAnswers(a.answers, answers, a.locked);
    const m = markAttempt(a.answers);
    a.state = 'submitted';
    a.submittedAt = new Date().toISOString();
    a.score = m.total;
    a.stages = m.stages;
    a.items = m.items;
    a.rev += 1;
    rec.best = Math.max(rec.best || 0, m.total);
    return { a };
  });
  if (r.missing) return fail(401, 'Log in again.', 'token');
  if (r.conflict) return fail(409, 'Try again.', 'conflict');
  if (r.result.reason) return fail(409, r.result.reason === 'device'
    ? 'This attempt is open on another device. Log in again to continue here.' : 'This attempt has ended.', r.result.reason);
  const used = r.rec.attempts.length;
  return json(200, { attemptsUsed: used, attemptsLeft: MAX_ATTEMPTS - used });
};

export const config = { path: '/api/submit' };
