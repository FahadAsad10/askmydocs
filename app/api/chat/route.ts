import Anthropic from "@anthropic-ai/sdk";
import type { AnswerPart, ChatTurn, StreamEvent, UploadedDoc } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

const SYSTEM = `You answer questions using only the documents the user has provided.
Ground every factual claim in a cited passage. If the documents do not contain the answer, say so plainly and suggest what document would.
Be concise: lead with the answer, then the supporting detail. Use short paragraphs or bullet points.`;

const client = new Anthropic();

function toDocumentBlock(doc: UploadedDoc, isLast: boolean): Anthropic.DocumentBlockParam {
  return {
    type: "document",
    title: doc.name,
    citations: { enabled: true },
    source:
      doc.kind === "pdf"
        ? { type: "base64", media_type: "application/pdf", data: doc.data }
        : { type: "text", media_type: "text/plain", data: doc.data },
    // Cache the documents so follow-up questions don't pay to re-read them.
    ...(isLast ? { cache_control: { type: "ephemeral" as const } } : {}),
  };
}

function toParts(message: Anthropic.Message, docs: UploadedDoc[]): AnswerPart[] {
  const parts: AnswerPart[] = [];
  for (const block of message.content) {
    if (block.type !== "text") continue;
    parts.push({
      text: block.text,
      citations: (block.citations ?? []).flatMap((c) => {
        if (!("document_index" in c)) return [];
        const where =
          c.type === "page_location"
            ? c.start_page_number === c.end_page_number - 1
              ? `p. ${c.start_page_number}`
              : `pp. ${c.start_page_number}-${c.end_page_number - 1}`
            : "";
        return [
          {
            docIndex: c.document_index,
            docTitle: c.document_title ?? docs[c.document_index]?.name ?? "Document",
            quote: c.cited_text,
            where,
          },
        ];
      }),
    });
  }
  return parts;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key." },
      { status: 500 },
    );
  }

  const { docs, history } = (await req.json()) as { docs: UploadedDoc[]; history: ChatTurn[] };

  if (!docs?.length) return Response.json({ error: "Add at least one document first." }, { status: 400 });
  if (!history?.length || history.at(-1)?.role !== "user") {
    return Response.json({ error: "Ask a question." }, { status: 400 });
  }
  if (docs.reduce((n, d) => n + d.data.length, 0) > MAX_TOTAL_BYTES) {
    return Response.json({ error: "Documents are larger than 20 MB in total." }, { status: 413 });
  }

  // Documents go at the start of the first user turn, so the cached prefix
  // stays identical as the conversation grows.
  const messages: Anthropic.MessageParam[] = history.map((turn, i) =>
    i === 0
      ? {
          role: "user",
          content: [...docs.map((d, j) => toDocumentBlock(d, j === docs.length - 1)), { type: "text", text: turn.text }],
        }
      : { role: turn.role, content: turn.text },
  );

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (e: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const stream = client.messages.stream({
          model: "claude-opus-5-5",
          max_tokens: 16000,
          thinking: { type: "adaptive" },
          output_config: { effort: "low" },
          system: SYSTEM,
          messages,
        });
        stream.on("text", (text) => send({ type: "delta", text }));
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          send({ type: "error", message: "Claude declined to answer this question." });
        } else {
          send({ type: "final", parts: toParts(final, docs) });
        }
      } catch (err) {
        const message =
          err instanceof Anthropic.RateLimitError
            ? "Rate limited by the API. Wait a moment and retry."
            : err instanceof Anthropic.AuthenticationError
              ? "Your ANTHROPIC_API_KEY was rejected."
              : err instanceof Anthropic.APIError
                ? `API error: ${err.message}`
                : "Something went wrong.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
}
