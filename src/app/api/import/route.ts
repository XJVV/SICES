import { NextResponse } from "next/server";
const gone = () => NextResponse.json({ error: "Carga web deshabilitada; la ingesta solo se ejecuta mediante CLI local." }, { status: 410, headers: { "Cache-Control": "no-store" } });
export const GET = gone;
export const POST = gone;
export const PUT = gone;
export const PATCH = gone;
export const DELETE = gone;
