import express from "express";
import cors from "cors";
import "dotenv/config";
import testcasesRouter from "./routes/testcases.js";
import sectionsRouter from "./routes/sections.js";

const app = express();

app.use(express.json({ limit: "1mb" }));

// CORS: always allow localhost and "null" (file://) for dev,
// plus any origins listed in ALLOWED_ORIGIN (comma-separated).
const allowlist = (process.env.ALLOWED_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header (curl, server-to-server) — allow
      if (!origin) return callback(null, true);
      // file:// opens send Origin: "null"
      if (origin === "null") return callback(null, true);
      // local dev servers
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      // explicit allowlist
      if (allowlist.length === 0 || allowlist.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/testcases", testcasesRouter);
app.use("/api/sections", sectionsRouter);

app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error("[error]", err);
  res
    .status(err.status || 500)
    .json({ error: err.message || "Internal Server Error" });
});

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`QA docs backend listening on :${port}`);
});
