import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [{ now }] = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS now`;

  return NextResponse.json({
    ok: true,
    database: "ai_text_rpg",
    now
  });
}
