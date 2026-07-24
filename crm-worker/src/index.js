// Zero-touch CRM backend for the n8n-agentic-ops workflow.
// Auto-provisions its schema (and seeds sample contacts) on first request,
// so importing this repo into Cloudflare and deploying is the only step
// needed -- no manual `wrangler d1 execute` / migrations required.

let schemaReady = null;
function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS contacts (
          email TEXT PRIMARY KEY,
          name TEXT,
          plan TEXT,
          open_tickets INTEGER DEFAULT 0,
          notes TEXT
        )`
      ).run();

      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS tickets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL,
          subject TEXT,
          summary TEXT,
          priority TEXT,
          status TEXT DEFAULT 'open',
          created_at TEXT DEFAULT (datetime('now'))
        )`
      ).run();

      // Seed a couple of sample contacts so /contacts/lookup has something
      // real to return on a fresh deploy, without a separate seed step.
      const { count } = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM contacts"
      ).first();
      if (count === 0) {
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO contacts (email, name, plan, open_tickets, notes) VALUES (?, ?, ?, ?, ?)"
          ).bind("demo.customer@example.com", "Demo Customer", "pro", 0, "Sample seeded contact"),
          env.DB.prepare(
            "INSERT INTO contacts (email, name, plan, open_tickets, notes) VALUES (?, ?, ?, ?, ?)"
          ).bind("angry.customer@example.com", "Angry Customer", "starter", 1, "Has an existing open ticket"),
        ]);
      }
    })();
  }
  return schemaReady;
}

function authOk(request, env) {
  if (!env.CRM_TOKEN) return true; // no token configured -> auth disabled (dev/demo mode)
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${env.CRM_TOKEN}`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

async function renderDashboard(env) {
  const { results: contacts } = await env.DB.prepare(
    "SELECT * FROM contacts ORDER BY open_tickets DESC, email ASC"
  ).all();
  const { results: tickets } = await env.DB.prepare(
    "SELECT * FROM tickets ORDER BY id DESC LIMIT 50"
  ).all();

  const openCount = tickets.filter((t) => t.status === "open").length;
  const byPriority = tickets.reduce((acc, t) => {
    const p = t.priority || "standard";
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  const priorityRow = Object.entries(byPriority)
    .map(([p, n]) => `<span class="pill">${escapeHtml(p)}: ${n}</span>`)
    .join(" ");

  const contactRows = contacts.map((c) => `
    <tr>
      <td>${escapeHtml(c.email)}</td>
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.plan)}</td>
      <td>${escapeHtml(c.open_tickets)}</td>
      <td>${escapeHtml(c.notes)}</td>
    </tr>`).join("");

  const ticketRows = tickets.map((t) => `
    <tr>
      <td>${t.id}</td>
      <td>${escapeHtml(t.email)}</td>
      <td>${escapeHtml(t.subject)}</td>
      <td>${escapeHtml(t.summary)}</td>
      <td><span class="badge badge-${escapeHtml(t.priority || "standard")}">${escapeHtml(t.priority || "standard")}</span></td>
      <td>${escapeHtml(t.status)}</td>
      <td>${escapeHtml(t.created_at)}</td>
    </tr>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>n8n-agentic-ops CRM Dashboard</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 24px; background: #0b0d12; color: #e6e8eb; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #8a8f98; font-size: 13px; margin-bottom: 24px; }
  .stats { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  .stat { background: #161a22; border: 1px solid #262b36; border-radius: 10px; padding: 12px 16px; min-width: 120px; }
  .stat .num { font-size: 22px; font-weight: 600; }
  .stat .label { font-size: 12px; color: #8a8f98; }
  .pill { display: inline-block; background: #1c2330; border-radius: 999px; padding: 3px 10px; font-size: 12px; margin-right: 6px; }
  section { margin-bottom: 32px; }
  h2 { font-size: 15px; color: #c7cbd1; border-bottom: 1px solid #262b36; padding-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: #8a8f98; font-weight: 500; padding: 8px; border-bottom: 1px solid #262b36; }
  td { padding: 8px; border-bottom: 1px solid #1a1e27; vertical-align: top; }
  .badge { padding: 2px 8px; border-radius: 6px; font-size: 11px; text-transform: uppercase; }
  .badge-urgent { background: #3a1620; color: #ff7a90; }
  .badge-high { background: #3a2a16; color: #ffb86b; }
  .badge-standard { background: #16233a; color: #7aa6ff; }
  .badge-low { background: #16261a; color: #7bd88f; }
  footer { color: #4d525c; font-size: 12px; margin-top: 40px; }
</style>
</head>
<body>
  <h1>CRM Worker Dashboard</h1>
  <div class="sub">allocsys/n8n-agentic-ops — live view of the D1-backed stand-in CRM</div>

  <div class="stats">
    <div class="stat"><div class="num">${contacts.length}</div><div class="label">Contacts</div></div>
    <div class="stat"><div class="num">${tickets.length}</div><div class="label">Tickets (last 50)</div></div>
    <div class="stat"><div class="num">${openCount}</div><div class="label">Open</div></div>
    <div class="stat"><div class="num" style="font-size:13px; padding-top:4px;">${priorityRow || "—"}</div><div class="label">By priority</div></div>
  </div>

  <section>
    <h2>Recent tickets</h2>
    <table>
      <thead><tr><th>ID</th><th>Email</th><th>Subject</th><th>Summary</th><th>Priority</th><th>Status</th><th>Created</th></tr></thead>
      <tbody>${ticketRows || '<tr><td colspan="7">No tickets yet</td></tr>'}</tbody>
    </table>
  </section>

  <section>
    <h2>Contacts</h2>
    <table>
      <thead><tr><th>Email</th><th>Name</th><th>Plan</th><th>Open tickets</th><th>Notes</th></tr></thead>
      <tbody>${contactRows || '<tr><td colspan="5">No contacts yet</td></tr>'}</tbody>
    </table>
  </section>

  <footer>Data via /v1/contacts/lookup and /v1/tickets — refresh to update.</footer>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    await ensureSchema(env);
    const url = new URL(request.url);

    if (!authOk(request, env)) {
      return new Response("Unauthorized", { status: 401 });
    }

    // GET /  -- human-readable dashboard over the same D1 data
    if (request.method === "GET" && url.pathname === "/") {
      const html = await renderDashboard(env);
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    // GET /v1/contacts/lookup?email=...
    if (request.method === "GET" && url.pathname === "/v1/contacts/lookup") {
      const email = url.searchParams.get("email");
      if (!email) return new Response("Missing email query param", { status: 400 });

      const contact = await env.DB.prepare(
        "SELECT * FROM contacts WHERE email = ?"
      ).bind(email).first();

      if (!contact) {
        return Response.json({ found: false, email });
      }
      return Response.json({ found: true, ...contact });
    }

    // POST /v1/tickets   body: { email, subject, summary, priority }
    if (request.method === "POST" && url.pathname === "/v1/tickets") {
      const body = await request.json().catch(() => ({}));
      const { email, subject, summary, priority } = body;
      if (!email) return new Response("Missing email", { status: 400 });

      const result = await env.DB.prepare(
        `INSERT INTO tickets (email, subject, summary, priority) VALUES (?, ?, ?, ?)`
      ).bind(email, subject || "", summary || "", priority || "standard").run();

      await env.DB.prepare(
        `UPDATE contacts SET open_tickets = open_tickets + 1 WHERE email = ?`
      ).bind(email).run();

      return Response.json({ created: true, ticket_id: result.meta.last_row_id }, { status: 201 });
    }

    // GET /v1/tickets?email=...  (for verifying test runs)
    if (request.method === "GET" && url.pathname === "/v1/tickets") {
      const email = url.searchParams.get("email");
      const stmt = email
        ? env.DB.prepare("SELECT * FROM tickets WHERE email = ? ORDER BY id DESC").bind(email)
        : env.DB.prepare("SELECT * FROM tickets ORDER BY id DESC LIMIT 50");
      const { results } = await stmt.all();
      return Response.json(results);
    }

    return new Response("Not found", { status: 404 });
  },
};
