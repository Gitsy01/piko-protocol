// ===========================================================
// @depokemongo/server - Incentive Protocol API entry point
// ===========================================================

import express from "express";
import cors from "cors";
import http from "http";
import { Server as SocketIO } from "socket.io";

import "./config/ai";
import { env } from "./config/env";
import { assertPikoMintDecimals } from "./config/pikoMint";
import { merchantRouter } from "./routes/merchants";
import { questRouter } from "./routes/quests";
import { paymentRouter } from "./routes/payments";
import { leaderboardRouter } from "./routes/leaderboard";
import { aiRouter } from "./routes/ai";
import { userRouter } from "./routes/user";
import { demoRouter } from "./routes/demo";
import { identityRouter } from "./routes/identity";
import { initWebSocket } from "./ws/realtime";

const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/merchants", merchantRouter);
app.use("/api/quests", questRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/ai", aiRouter);
app.use("/api/user", userRouter);
app.use("/api", identityRouter);
app.use("/api/demo", demoRouter);

initWebSocket(io);

const PORT = env.PORT;
server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the existing API server or set PORT to a different value in packages/server/.env.`,
    );
    process.exit(1);
  }

  throw error;
});

async function startServer() {
  await assertPikoMintDecimals();

  server.listen(PORT, () => {
    console.log(`PIKO Protocol API listening on http://localhost:${PORT}`);
  });
}

void startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

export { io };
