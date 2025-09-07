const encoder = new TextEncoder();

function hmacSHA256(key: string, data: string) {
  const keyData = encoder.encode(key);
  const dataBytes = encoder.encode(data);

  const mac = new Bun.CryptoHasher("sha256", keyData);
  mac.update(dataBytes);
  return mac.digest("base64url");
}

export interface SessionData {
  userId: number;
  role: "kepsek" | "guru" | "siswa";
  issuedAt: number;
}

export function signSession(data: SessionData, secret: string) {
  const payload = btoa(JSON.stringify(data));
  const sig = hmacSHA256(secret, payload);
  return `${payload}.${sig}`;
}

export function verifySession(token: string, secret: string): SessionData | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = hmacSHA256(secret, payload);
  if (expected !== sig) return null;
  try {
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}