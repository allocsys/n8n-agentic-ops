import { describe, it, expect, beforeEach, vi } from "vitest";
import { env } from "cloudflare:test";

// index.js memoizes schema creation in a module-scope `schemaReady`
// promise. vitest-pool-workers gives each test isolated D1 storage, so a
// worker module that already resolved schemaReady against a *previous*
// test's storage would silently skip table creation against the new,
// empty D1 instance. Re-importing the module fresh in each test keeps
// schemaReady in sync with the storage instance it's paired with.
async function freshWorker() {
  vi.resetModules();
  const mod = await import("./index.js");
  return mod.default;
}

let worker;

beforeEach(async () => {
  worker = await freshWorker();
});

function req(path, init) {
  return new Request(`https://crm-worker.example${path}`, init);
}

describe("schema + seeding", () => {
  it("creates tables and seeds two sample contacts on first request", async () => {
    await worker.fetch(req("/v1/tickets"), env);

    const lookup = await worker.fetch(
      req("/v1/contacts/lookup?email=demo.customer@example.com"),
      env
    );
    const body = await lookup.json();
    expect(body.found).toBe(true);
    expect(body.plan).toBe("pro");
  });

  it("does not double-seed when concurrent requests race on ensureSchema()", async () => {
    // Fire several requests before any of them can have resolved
    // ensureSchema(), simulating concurrent cold-start traffic.
    await Promise.all([
      worker.fetch(req("/v1/tickets"), env),
      worker.fetch(req("/v1/tickets"), env),
      worker.fetch(req("/v1/tickets"), env),
      worker.fetch(req("/v1/tickets"), env),
    ]);

    const count = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM contacts"
    ).first();
    expect(count.count).toBe(2);
  });
});

describe("GET /v1/contacts/lookup", () => {
  it("returns 400 when email is missing", async () => {
    const res = await worker.fetch(req("/v1/contacts/lookup"), env);
    expect(res.status).toBe(400);
  });

  it("returns found:false for an unknown contact instead of 404/500", async () => {
    const res = await worker.fetch(
      req("/v1/contacts/lookup?email=nobody@example.com"),
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ found: false, email: "nobody@example.com" });
  });
});

describe("POST /v1/tickets", () => {
  it("returns 400 when email is missing", async () => {
    const res = await worker.fetch(
      req("/v1/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject: "no email here" }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("returns 400, not a crash, on malformed JSON body", async () => {
    const res = await worker.fetch(
      req("/v1/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not valid json",
      }),
      env
    );
    // body.json().catch(() => ({})) means a parse failure falls through
    // to the same missing-email 400 path rather than throwing 500.
    expect(res.status).toBe(400);
  });

  it("creates a ticket and increments the contact's open_tickets", async () => {
    await worker.fetch(
      req("/v1/contacts/lookup?email=demo.customer@example.com"),
      env
    ); // triggers seeding

    const create = await worker.fetch(
      req("/v1/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "demo.customer@example.com",
          subject: "Question",
          summary: "Test ticket",
          priority: "standard",
        }),
      }),
      env
    );
    expect(create.status).toBe(201);
    const created = await create.json();
    expect(created.created).toBe(true);
    expect(typeof created.ticket_id).toBe("number");

    const lookup = await worker.fetch(
      req("/v1/contacts/lookup?email=demo.customer@example.com"),
      env
    );
    const contact = await lookup.json();
    expect(contact.open_tickets).toBe(1);
  });
});

describe("auth (CRM_TOKEN)", () => {
  it("is open when CRM_TOKEN is not configured", async () => {
    const res = await worker.fetch(req("/v1/tickets"), env);
    expect(res.status).not.toBe(401);
  });

  it("returns 401 when CRM_TOKEN is set and the header is missing", async () => {
    const res = await worker.fetch(req("/v1/tickets"), {
      ...env,
      CRM_TOKEN: "secret-token",
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when CRM_TOKEN is set and the header is wrong", async () => {
    const res = await worker.fetch(
      req("/v1/tickets", { headers: { authorization: "Bearer wrong-token" } }),
      { ...env, CRM_TOKEN: "secret-token" }
    );
    expect(res.status).toBe(401);
  });

  it("succeeds when CRM_TOKEN is set and the header matches", async () => {
    const res = await worker.fetch(
      req("/v1/tickets", {
        headers: { authorization: "Bearer secret-token" },
      }),
      { ...env, CRM_TOKEN: "secret-token" }
    );
    expect(res.status).toBe(200);
  });
});
