import { json, fail, readJson, onlyPost } from '../lib/http.mjs';
import { getLearnerStore, findOrCreate, updateLearner, validName, validEmail, newToken, publicAttempt,
  openAttempt, MAX_ATTEMPTS, ALL_USED, NAME_MSG, EMAIL_MSG } from '../lib/attempts.mjs';

export default async (req, context) => {
  const bad = onlyPost(req); if (bad) return bad;
  const parsed = await readJson(req); if (parsed.response) return parsed.response;
  const name = validName(parsed.body.name);
  if (!name) return fail(400, NAME_MSG, 'name');
  const email = validEmail(parsed.body.email);
  if (!email) return fail(400, EMAIL_MSG, 'email');
  const begin = parsed.body.begin === true;

  const store = getLearnerStore(context);
  const found = await findOrCreate(store, name, email);
  if (found.message) return fail(409, found.message, 'other');

  const apply = rec => {
    let a = openAttempt(rec);
    if (!a && begin) {
      if (rec.attempts.length >= MAX_ATTEMPTS) return { skip: true, used: true };
      a = { n: rec.attempts.length + 1, startedAt: new Date().toISOString(), state: 'open', token: '', rev: 0, stage: 1,
        locked: [], answers: {}, resetUsed: false, submittedAt: null, score: null };
      rec.attempts.push(a);
    }
    if (a) a.token = newToken(rec.id); // the newest login holds the attempt
    return { a, used: false };
  };

  let rec, result;
  if (found.record) {
    rec = found.record;
    result = apply(rec);
    await store.setJSON('learner/' + rec.id, rec, { onlyIfNew: true });
  } else {
    const r = await updateLearner(store, found.id, apply);
    if (r.missing) return fail(404, 'Learner not found.');
    if (r.conflict) return fail(409, 'Try again.', 'conflict');
    rec = r.rec; result = r.result;
  }
  const used = rec.attempts.length;
  if (result.used) return json(403, { error: ALL_USED, reason: 'attempts', attemptsUsed: used });
  return json(200, { name: rec.name, attemptsUsed: used, open: result.a ? publicAttempt(result.a) : null });
};

export const config = { path: '/api/start' };
