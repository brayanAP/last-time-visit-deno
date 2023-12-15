import { Hono } from "https://deno.land/x/hono@v3.11.7/mod.ts";
import {
  cors,
  serveStatic,
} from "https://deno.land/x/hono@v3.11.7/middleware.ts";
import { streamSSE } from "https://deno.land/x/hono@v3.11.7/helper/streaming/index.ts";

const app = new Hono();
const db = await Deno.openKv();
let i = 0;

app.use(cors());

app.get("/", serveStatic({ path: "./index.html" }));

app.get("/visit", (c) => {
  return streamSSE(c, async (stream) => {
    const watcher = db.watch([["lastVisit"]]);
    for await (const entry of watcher) {
      const { value } = entry[0];

      if (value !== null) {
        await stream.writeSSE({
          data: JSON.stringify(value),
          event: "update",
          id: String(i++),
        });
      }
    }
  });
});

app.post("/visit", async (c) => {
  const { city, country, flag } = await c.req.json();
  await db
    .atomic()
    .set(["lastVisit"], {
      city,
      country,
      flag,
    })
    .sum(["visits"], 1n)
    .commit();
  c.json({ message: "ok" });
});

Deno.serve(app.fetch);
