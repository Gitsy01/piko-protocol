import { Server as SocketIO } from "socket.io";
import { WsEvent } from "@depokemongo/common";
import { log } from "../config/logger";

export function initWebSocket(io: SocketIO) {
  io.on("connection", (socket) => {
    log("debug", `Client connected: ${socket.id}`);

    socket.on(WsEvent.SUBSCRIBE_LOCATION, (data: { lat: number; lng: number; radius: number }) => {
      const room = `geo:${Math.round(data.lat * 10)}:${Math.round(data.lng * 10)}`;
      socket.join(room);
      log("debug", `${socket.id} joined room ${room}`);
    });

    socket.on(WsEvent.SUBSCRIBE_QUEST, (data: { questId: string }) => {
      socket.join(`quest:${data.questId}`);
    });

    socket.on("disconnect", () => {
      log("debug", `Client disconnected: ${socket.id}`);
    });
  });

  log("info", "WebSocket initialized");
}

export function emitRewardReceived(
  io: SocketIO,
  wallet: string,
  data: { amount: number; token: string; txSignature: string },
) {
  io.emit(WsEvent.REWARD_RECEIVED, { wallet, ...data });
}

export function emitLeaderboardUpdate(
  io: SocketIO,
  top10: Array<{ wallet: string; xp: number; rank: number }>,
) {
  io.emit(WsEvent.LEADERBOARD_UPDATE, { top10 });
}
