import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export function isSyncAuthorized(request: Request): boolean {
  const expected = process.env.SYNC_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return false;
  const given = Buffer.from(match[1]);
  const want = Buffer.from(expected);
  return given.length === want.length && timingSafeEqual(given, want);
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}
