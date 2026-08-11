import { NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// The provider SDKs require the Node.js runtime (not edge).
export const runtime = "nodejs";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT =
  "You are Dzinly, a friendly, helpful and concise AI assistant. " +
  "Answer the user clearly and warmly. Keep replies reasonably short unless the " +
  "user asks for detail.";

/** Wraps an async iterable of text chunks in a web ReadableStream. */
function toReadableStream(chunks: AsyncIterable<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        console.error("[api/chat] streaming error:", err);
        controller.enqueue(
          encoder.encode("\n\n[Sorry — I hit an error while streaming the reply.]")
        );
      }
      controller.close();
    },
  });
}

function streamResponse(stream: AsyncIterable<string>): Response {
  return new Response(toReadableStream(stream), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

async function* streamOpenAI(messages: ChatMessage[]): AsyncGenerator<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const stream = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

async function* streamAnthropic(messages: ChatMessage[]): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const stream = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

export async function POST(request: Request) {
  let messages: ChatMessage[];
  try {
    const body = (await request.json()) as { messages?: ChatMessage[] };
    messages = (body.messages ?? []).filter(
      (m): m is ChatMessage => m.role === "user" || m.role === "assistant"
    );
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const provider = (process.env.AI_PROVIDER ?? "openai").toLowerCase();

  if (provider === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error:
            "⚠ No Anthropic API key found. Add ANTHROPIC_API_KEY to chat-app/.env.local (and set AI_PROVIDER=anthropic), then restart the dev server.",
        },
        { status: 500 }
      );
    }
    return streamResponse(streamAnthropic(messages));
  }

  // Default provider: openai
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          "⚠ No OpenAI API key found. Add OPENAI_API_KEY to chat-app/.env.local, then restart the dev server.",
      },
      { status: 500 }
    );
  }
  return streamResponse(streamOpenAI(messages));
}
