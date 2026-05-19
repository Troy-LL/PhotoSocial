import jwt from "jsonwebtoken";
import { config } from "../config.js";

export interface WsTokenPayload {
  sessionId: string;
  participantId: string;
  deviceId: string;
  isHost: boolean;
}

export function signWsToken(payload: WsTokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "24h" });
}

export function verifyWsToken(token: string): WsTokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as WsTokenPayload;
  } catch {
    return null;
  }
}
