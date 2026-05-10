// ===========================================================
// @depokemongo/server - Incentive Protocol API entry point
// ===========================================================

import express from "express";
import cors from "cors";
import http from "http";
import { Server as SocketIO } from "socket.io";

// ─── Config & logger must be imported before routes ──────────────────────────
import { env } from "./config/env";
import { log } from "./config/logger";
import { prisma } from "./config/db";
import { assertPikoMintDecimals } from "./config/pikoMint";
import "./config/ai"; // wires Redis cache for AI agent — non-blocking on error

// ─── Route handlers ───────────────────────────────────────────────────────────
import { merchantRouter }    from "./routes/merchants";
import { questRouter }       from "./routes/quests";
import { paymentRouter }     from "./routes/payments";
import { leaderboardRouter } from "./routes/leaderboard";
import { aiRouter }          from "./routes/ai";
import { userRouter }        from "./routes/user";
import { demoRouter }        from "./routes/demo";
import { identityRouter }    from "./routes/identity";
import { initWebSocket }     from "./ws/realtime";

// ─── App setup ────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new SocketIO(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

// ─── Health routes — registered before ANYTHING ELSE ─────────────────────────
// Railway hits /api/health within ~5 s of container start.
// These must NEVER be behind middleware, DB calls, or lazy imports.
const healthResponse = { ok: true };
app.get("/health",     (_req, res) => res.json(healthResponse));
app.get("/api/health", (_req, res) => res.json(healthResponse));

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api/merchants",   merchantRouter);
app.use("/api/quests",      questRouter);
app.use("/api/payments",    paymentRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/ai",          aiRouter);
app.use("/api/user",        userRouter);
app.use("/api",             identityRouter);
app.use("/api/demo",        demoRouter);

initWebSocket(io);

// ─── Error guard ──────────────────────────────────────────────────────────────
const PORT = env.PORT;
server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the existing API server or set PORT to a different value.`,
    );
    process.exit(1);
  }
  throw error;
});

// ─── Start ────────────────────────────────────────────────────────────────────
function startServer() {
  // Bind to 0.0.0.0 — required for Railway / Docker healthchecks.
  const HOST = "0.0.0.0";

  server.listen(PORT, HOST, () => {
    log("info", `PIKO Protocol API listening on http://${HOST}:${PORT}`);

    // ── Prisma connects AFTER the server is already accepting requests ────────
    // Cold-starting Railway Postgres can take 10–30 s.  If we blocked on it,
    // the healthcheck would time out and kill the deployment.
    // Prisma will auto-reconnect on the first real query if this fails.
    const DB_TIMEOUT_MS = 25_000;
    const dbTimer = setTimeout(() => {
      log("warn", "Prisma $connect timed out (25 s) — DB may be cold-starting, queries will retry");
    }, DB_TIMEOUT_MS);

    prisma
      .$connect()
      .then(() => {
        clearTimeout(dbTimer);
        log("info", "Prisma connected to database");
      })
      .catch((err: unknown) => {
        clearTimeout(dbTimer);
        console.warn("Prisma $connect failed (non-fatal, queries will retry on demand):", err);
      });

    // ── Non-critical Solana mint sanity check ─────────────────────────────────
    void assertPikoMintDecimals().catch((error) => {
      console.warn("PIKO mint decimal check failed (non-fatal):", error);
    });
  });
}

startServer();

export { io };
