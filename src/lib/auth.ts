/**
 * Autenticación local: hash scrypt + sesiones en base de datos
 * con cookie httpOnly (sin dependencias externas).
 */
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "sices_session";
const SESSION_DAYS = 7;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

/** Crea una sesión en BD y devuelve el token para la cookie. */
export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}

/** Elimina la sesión (si existe) y limpia registros vencidos. */
export async function destroySession(token: string | undefined): Promise<void> {
  if (token) {
    await db.session.deleteMany({ where: { token } });
  }
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

/** Devuelve el usuario de la sesión activa leyendo la cookie entrante. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
  };
}

export const sessionCookieOptions = (expiresAt: Date) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  expires: expiresAt,
});
