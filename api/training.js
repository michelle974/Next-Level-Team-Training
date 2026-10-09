// Next Level BMX Training: the only server code. Asana is the database.
//
//   GET  /api/training                       -> riders, every rider's log lines, sessions
//   POST /api/training { action:'login' }    -> check a PIN, or set it the first time
//   POST /api/training { action:'log' }      -> add one line to a rider's session log
//   POST /api/training { action:'unlog' }    -> remove one line from it
//
// The Asana token lives in the ASANA_TOKEN environment variable and never reaches
// the browser. PINs are checked here and are never sent back to anyone.

const API = 'https://app.asana.com/api/1.0';

// Next Level BMX: Summer Training project (still the home of the training data)
const ACTIVE_SECTION = process.env.ACTIVE_SECTION || '1214644650535732';   // ACTIVE ROSTER
const SESSIONS_PARENT = process.env.SESSIONS_PARENT || '1219359737982976'; // STATE SEASON SESSIONS

const LOG_MARKER = '--- LOG STARTS BELOW ---';
const LINE_RE = /^\d{4}-\d{2}-\d{2} \| [A-Za-z]{3} \| [a-z]+ \| [^|\n]{1,12}$/;
const TYPES = ['track', 'sprint', 'strength', 'roller', 'rest'];

// ── Asana, with a short retry: its first request after a quiet spell sometimes fails ──
async function asana(path, opts = {}, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(API + path, {
        method: opts.method || 'GET',
        headers: {
          Authorization: 'Bearer ' + process.env.ASANA_TOKEN,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: opts.body ? JSON.stringify({ data: opts.body }) : undefined
      });
      if (r.ok) return (await r.json()).data;
      last = new Error('Asana ' + r.status);
      if (r.status < 500 && r.status !== 429) throw last;
    } catch (e) { last = e; }
    await new Promise(res => setTimeout(res, 400 * (i + 1)));
  }
  throw last;
}

// ── A rider's session log is the first subtask whose name starts "📋 Session Log" ──
async function logTaskFor(riderGid) {
  const subs = await asana('/tasks/' + riderGid + '/subtasks?opt_fields=name,notes');
  return (subs || []).find(s => /session log/i.test(s.name || '')) || null;
}

function pinOf(notes) {
  const m = String(notes || '').match(/^PIN:(\d{4})\s*$/m);
  return m ? m[1] : null;
}

// Only the lines after the marker are the log. Everything above it is header.
function linesOf(notes) {
  const s = String(notes || '');
  const i = s.indexOf(LOG_MARKER);
  if (i < 0) return [];
  return s.slice(i + LOG_MARKER.length).split('\n').map(l => l.trim()).filter(l => LINE_RE.test(l));
}

async function isActive(riderGid) {
  const t = await asana('/tasks/' + riderGid + '?opt_fields=memberships.section.gid');
  return (t.memberships || []).some(m => m.section && m.section.gid === ACTIVE_SECTION);
}

// Everything a rider has to prove before their log is touched.
async function authorised(riderGid, pin) {
  if (!/^\d+$/.test(String(riderGid || '')) || !/^\d{4}$/.test(String(pin || ''))) return null;
  const [active, log] = await Promise.all([isActive(riderGid), logTaskFor(riderGid)]);
  if (!active || !log) return null;
  const have = pinOf(log.notes);
  if (!have || have !== String(pin)) return null;
  return log;
}

// ── GET: everything the app needs on open, in one round trip ──
async function bootstrap() {
  const [riders, sessions] = await Promise.all([
    asana('/sections/' + ACTIVE_SECTION + '/tasks?opt_fields=name&limit=100'),
    asana('/tasks/' + SESSIONS_PARENT + '/subtasks?opt_fields=name,notes&limit=100')
  ]);
  const roster = (riders || []).filter(r => r.name && !/^how to use/i.test(r.name));
  const logs = await Promise.all(roster.map(r => logTaskFor(r.gid).catch(() => null)));
  return {
    riders: roster.map((r, i) => ({
      gid: r.gid,
      name: r.name.trim(),
      hasPin: !!(logs[i] && pinOf(logs[i].notes)),
      ready: !!logs[i],
      lines: logs[i] ? linesOf(logs[i].notes) : []
    })).sort((a, b) => a.name.localeCompare(b.name)),
    sessions: (sessions || []).map(s => ({ gid: s.gid, notes: s.notes || '' }))
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (!process.env.ASANA_TOKEN) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'ASANA_TOKEN is not set in Vercel' }));
  }
  try {
    if (req.method === 'GET') {
      // The CDN holds it for 15 seconds, so twenty riders opening the app at
      // practice is one trip to Asana, not twenty.
      res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
      return res.end(JSON.stringify(await bootstrap()));
    }
    if (req.method !== 'POST') { res.statusCode = 405; return res.end('{}'); }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { action, riderGid, pin } = body;

    if (action === 'login') {
      if (!/^\d{4}$/.test(String(pin || ''))) return res.end(JSON.stringify({ ok: false, error: 'PIN must be 4 numbers' }));
      if (!(await isActive(riderGid))) return res.end(JSON.stringify({ ok: false, error: 'Rider not on the roster' }));
      const log = await logTaskFor(riderGid);
      if (!log) return res.end(JSON.stringify({ ok: false, error: 'No session log for this rider yet' }));
      const have = pinOf(log.notes);
      if (have) return res.end(JSON.stringify({ ok: have === String(pin), error: have === String(pin) ? null : 'Wrong PIN' }));
      if (!body.create) return res.end(JSON.stringify({ ok: false, needsPin: true }));
      // First login: the PIN goes on the first line, the way the summer app kept it.
      await asana('/tasks/' + log.gid, { method: 'PUT', body: { notes: 'PIN:' + pin + '\n' + (log.notes || '') } });
      return res.end(JSON.stringify({ ok: true, created: true }));
    }

    if (action === 'log' || action === 'unlog') {
      const log = await authorised(riderGid, pin);
      if (!log) { res.statusCode = 403; return res.end(JSON.stringify({ ok: false, error: 'Sign in again' })); }
      const line = String(body.line || '').trim();
      if (!LINE_RE.test(line) || TYPES.indexOf(line.split(' | ')[2]) < 0) {
        res.statusCode = 400; return res.end(JSON.stringify({ ok: false, error: 'Bad log line' }));
      }
      let notes = log.notes || '';
      if (notes.indexOf(LOG_MARKER) < 0) notes = notes.replace(/\s*$/, '') + '\n\n' + LOG_MARKER + '\n';
      if (action === 'log') {
        notes = notes.replace(/\s*$/, '') + '\n' + line;
      } else {
        // One line comes out, the last copy of it, so a session done twice in a
        // day is undone once rather than wiped.
        const rows = notes.split('\n');
        let at = -1;
        for (let i = rows.length - 1; i >= 0; i--) if (rows[i].trim() === line) { at = i; break; }
        if (at < 0) return res.end(JSON.stringify({ ok: true, lines: linesOf(notes) }));
        rows.splice(at, 1);
        notes = rows.join('\n');
      }
      await asana('/tasks/' + log.gid, { method: 'PUT', body: { notes } });
      return res.end(JSON.stringify({ ok: true, lines: linesOf(notes) }));
    }

    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Unknown action' }));
  } catch (e) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ error: 'Asana did not answer. Try again in a moment.' }));
  }
};
