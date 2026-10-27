import { NextResponse } from "next/server";
import { recommendationOptions } from "@/lib/recommendations.mjs";

export async function GET() {
  return NextResponse.json(recommendationOptions(), { headers: { "Cache-Control": "no-store" } });
}
