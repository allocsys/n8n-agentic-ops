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

export default {
  async fetch(request, env) {
    await ensureSchema(env);
    const url = new URL(request.url);

    if (!authOk(request, env)) {
      return new Response("Unauthorized", { status: 401 });
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
