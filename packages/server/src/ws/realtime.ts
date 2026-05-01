// ═══════════════════════════════════════════════════════════
// WebSocket Real-Time Layer
// ═══════════════════════════════════════════════════════════

import { Server as SocketIO } from "socket.io";
import { WsEvent } from "@depokemongo/common";

export function initWebSocket(io: SocketIO) {
  io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // User subscribes to location-based updates
    socket.on(WsEvent.SUBSCRIBE_LOCATION, (data: { lat: number; lng: number; radius: number }) => {
      const room = `geo:${Math.round(data.lat * 10)}:${Math.round(data.lng * 10)}`;
      socket.join(room);
      console.log(`📍 ${socket.id} joined room ${room}`);
    });

    // User subscribes to quest updates
    socket.on(WsEvent.SUBSCRIBE_QUEST, (data: { questId: string }) => {
      socket.join(`quest:${data.questId}`);
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  console.log("🔌 WebSocket initialized");
}

/**
 * Emit a reward received event.
 */
export function emitRewardReceived(
  io: SocketIO,
  wallet: string,
  data: { amount: number; token: string; txSignature: string }
) {
  io.emit(WsEvent.REWARD_RECEIVED, { wallet, ...data });
}

/**
 * Emit a leaderboard update.
 */
export function emitLeaderboardUpdate(
  io: SocketIO,
  top10: Array<{ wallet: string; xp: number; rank: number }>
) {
  io.emit(WsEvent.LEADERBOARD_UPDATE, { top10 });
}
