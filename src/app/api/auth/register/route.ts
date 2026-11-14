import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, createSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(100),
  password: z.string().min(8).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos: nombre (mín. 2), email válido y contraseña de al menos 8 caracteres." },
        { status: 400 }
      );
    }
    const { name, email, password } = parsed.data;
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Ya existe una cuenta con ese email." }, { status: 409 });
    }
    const user = await db.user.create({
      data: { name, email, passwordHash: hashPassword(password), role: "USER" },
    });
    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return res;
  } catch {
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
