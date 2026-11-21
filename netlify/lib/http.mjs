// JSON responses, body size check, error shapes.
const MAX_BODY = 48 * 1024;

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export function fail(status, message, reason) {
  const body = { error: message };
  if (reason) body.reason = reason;
  return json(status, body);
}

// Reads and parses a JSON body. Returns { body } or { response }.
export async function readJson(req) {
  let text;
  try { text = await req.text(); } catch { return { response: fail(400, 'Bad request.') }; }
  if (new TextEncoder().encode(text).length > MAX_BODY) return { response: fail(413, 'Request too large.') };
  try {
    const body = JSON.parse(text || '{}');
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return { response: fail(400, 'Bad request.') };
    return { body };
  } catch {
    return { response: fail(400, 'Bad request.') };
  }
}

export function onlyPost(req) {
  return req.method === 'POST' ? null : fail(405, 'Method not allowed.');
}
