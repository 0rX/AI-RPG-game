import OpenAI from "openai";
import { NextResponse } from "next/server";
import { directorRequestSchema, fallbackDirectorNarration } from "@/lib/ai-director";

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = directorRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid director payload" }, { status: 400 });
  }

  const apiKey = parsed.data.apiKey || process.env.OPENAI_API_KEY;
  const model = parsed.data.model || "gpt-4.1-mini";
  const baseURL = parsed.data.baseUrl || undefined;

  if (!apiKey) {
    return NextResponse.json({
      narration: fallbackDirectorNarration(parsed.data),
      provider: "fallback"
    });
  }

  const client = new OpenAI({
    apiKey,
    baseURL
  });

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are the AI director for a deterministic text RPG engine. Rewrite the engine result as vivid narration without inventing new state, items, locations, or quest outcomes."
        },
        {
          role: "user",
          content: JSON.stringify({
            worldTitle: parsed.data.worldTitle,
            tone: parsed.data.tone,
            roomTitle: parsed.data.roomTitle,
            actionLabel: parsed.data.actionLabel,
            engineNarration: parsed.data.engineNarration
          })
        }
      ],
      temperature: 0.75
    });

    return NextResponse.json({
      narration: response.choices[0]?.message?.content || fallbackDirectorNarration(parsed.data),
      provider: baseURL ? "openai-compatible" : "openai",
      model
    });
  } catch {
    return NextResponse.json({
      narration: fallbackDirectorNarration(parsed.data),
      provider: "fallback",
      model
    });
  }
}
