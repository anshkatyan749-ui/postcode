/**
 * Postcode site data store — Cloudflare Worker + D1.
 *
 * Receives sign-ups, questionnaire answers and demo bookings from the website and
 * stores them in D1. Deploy with:
 *   cd worker
 *   npx wrangler login
 *   npx wrangler d1 create postcode-leads      # copy the id below
 *   npx wrangler d1 execute postcode-leads --file=./schema.sql
 *   npx wrangler deploy
 * Then paste the worker URL into site/config.js as `endpoint`.
 */
const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(\.[A-Za-z0-9-]{1,63})*\.[A-Za-z]{2,24}$/;
const JUNK = ["'", '"', ";", "--", "/*", "*/", "\\", "\x00", " or ", " and ", "union ", "select ",
              "insert ", "update ", "delete ", "drop ", "alter ", "create ", "exec "];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

// Reuse the site's own rules so a direct POST cannot slip past the UI.
function clean(value, max = 200) {
  return String(value == null ? "" : value).trim().slice(0, max);
}
function validEmail(value) {
  const text = clean(value, 254).toLowerCase();
  if (!text || text.includes("..")) return null;
  const probe = " " + text + " ";
  if (JUNK.some((bad) => probe.includes(bad))) return null;
  if ([".sql", ".sqlite", ".db", ".exe", ".zip", ".csv"].some((ext) => probe.includes(ext))) return null;
  return EMAIL_RE.test(text) ? text : null;
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}

async function save(env, row) {
  await env.DB.prepare(
    `INSERT INTO leads (kind, email, provider, name, company, group_kind, field, source, when_date,
                         slot, notes, meta, ip, created)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    row.kind, row.email, row.provider, row.name, row.company, row.group_kind, row.field, row.source,
    row.when_date, row.slot, row.notes, row.meta, row.ip, Date.now()
  ).run();
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method !== "POST") return json({ error: "POST only" }, 405);

    const url = new URL(request.url);
    if (url.pathname === "/health") {
      const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM leads").first();
      return json({ ok: true, leads: row ? row.n : 0 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const email = validEmail(body.email);
    if (!email) return json({ error: "A valid email address is required" }, 400);

    const row = {
      kind: ["signup", "signin", "questionnaire", "booking"].includes(body.kind) ? body.kind : "unknown",
      email,
      provider: clean(body.provider, 20),
      name: clean(body.name, 120),
      company: clean(body.company, 120),
      group_kind: clean(body.group, 80),
      field: clean(body.field, 80),
      source: clean(body.source_kind || body.source, 120),
      when_date: clean(body.date, 20),
      slot: clean(body.slot, 20),
      notes: clean(body.notes, 600),
      meta: clean(JSON.stringify({
        at: clean(body.at, 40),
        password_hint: clean(body.password_hint, 40),
        password_hash: clean(body.password_hash, 24),
        site: clean(body.source_site, 200),
        ua: clean(body.ua, 120)
      }), 900),
      ip: request.headers.get("cf-connecting-ip") || ""
    };

    if (row.kind === "booking" && !row.name) return json({ error: "A name is required for a booking" }, 400);
    if (row.kind === "signup" && row.meta.includes("already registered")) {
      return json({ error: "email_taken" }, 409);
    }

    try {
      await save(env, row);
    } catch (error) {
      return json({ error: "Could not store that: " + String(error.message || error) }, 500);
    }
    return json({ ok: true, stored: true, kind: row.kind }, 201);
  }
};
