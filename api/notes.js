// ─────────────────────────────────────────────────────────────
//  /api/notes  — საერთო ჩანაწერების ბექენდი (Upstash Redis)
//
//  GET     /api/notes        → { notes: [...] }   ყველა ჩანაწერი
//  POST    /api/notes        → { note }           ახლის დამატება  (body: { text })
//  DELETE  /api/notes?id=..  → { ok: true }        წაშლა id-ით
//
//  საჭირო environment variables (Vercel → Storage → Upstash Redis ავტომატურად ამატებს):
//    UPSTASH_REDIS_REST_URL
//    UPSTASH_REDIS_REST_TOKEN
// ─────────────────────────────────────────────────────────────

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const KEY = "iumori:notes"; // Redis Hash: id -> note object

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const all = await redis.hgetall(KEY); // { id: {...} } | null
      const notes = all ? Object.values(all) : [];
      notes.sort((a, b) => (b.ts || 0) - (a.ts || 0)); // ახლები ზემოთ
      return res.status(200).json({ notes });
    }

    if (req.method === "POST") {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const text = String(body.text || "").trim();

      if (!text) return res.status(400).json({ error: "ცარიელი ჩანაწერი" });
      if (text.length > 280) return res.status(400).json({ error: "ძალიან გრძელია (max 280)" });

      const note = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        text,
        ts: Date.now(),
      };
      await redis.hset(KEY, { [note.id]: note });
      return res.status(200).json({ note });
    }

    if (req.method === "DELETE") {
      const id = String(req.query.id || "");
      if (!id) return res.status(400).json({ error: "id საჭიროა" });
      await redis.hdel(KEY, id);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("notes api error:", err);
    return res.status(500).json({ error: "server error" });
  }
}
