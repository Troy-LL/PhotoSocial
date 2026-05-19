import * as jose from "jose";

export interface WsTokenPayload {
  sessionId: string;
  participantId: string;
  deviceId: string;
  isHost: boolean;
}

const alg = "HS256";

function secretKey(): Uint8Array {
  return new TextEncoder().encode(
    process.env.JWT_SECRET || "dev-secret-change-me"
  );
}

export async function signWsToken(payload: WsTokenPayload): Promise<string> {
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg })
    .setExpirationTime("24h")
    .sign(secretKey());
}

export async function verifyWsToken(
  token: string
): Promise<WsTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secretKey());
    const sessionId = payload.sessionId;
    const participantId = payload.participantId;
    const deviceId = payload.deviceId;
    const isHost = payload.isHost;
    if (
      typeof sessionId !== "string" ||
      typeof participantId !== "string" ||
      typeof deviceId !== "string" ||
      typeof isHost !== "boolean"
    ) {
      return null;
    }
    return { sessionId, participantId, deviceId, isHost };
  } catch {
    return null;
  }
}
