import { getServerSession } from "next-auth";
import { authOptions, ExtendedSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = (await getServerSession(authOptions)) as ExtendedSession | null;

  if (!session) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: !!session.accessToken,
    email: session.user?.email ?? null,
    name: session.user?.name ?? null,
    error: session.error ?? null,
  });
}
