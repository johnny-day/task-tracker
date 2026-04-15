import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, key: true, createdAt: true },
  });

  const masked = keys.map((k) => ({
    ...k,
    key: k.key.slice(0, 8) + "..." + k.key.slice(-4),
  }));

  return NextResponse.json(masked);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const label = body.label || "Default";
  const key = "ttk_" + crypto.randomBytes(24).toString("hex");

  const apiKey = await prisma.apiKey.create({
    data: { key, label },
  });

  return NextResponse.json({ ...apiKey, key }, { status: 201 });
}
