"use client";

import { useEffect, useRef, useState } from "react";
import type { AnswerPart, ChatTurn, Citation, StreamEvent, UploadedDoc } from "@/lib/types";
import { SAMPLE_CHAT, SAMPLE_DOCS } from "@/lib/sample";

const SUGGESTIONS = ["Summarise these documents in 5 bullet points", "What are the key dates or deadlines?", "What is missing or unclear?"];

async function readFile(file: File): Promise<UploadedDoc> {
  if (file.type === "application/pdf") {
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { name: file.name, kind: "pdf", data: btoa(bin), size: file.size };
  }
  return { name: file.name, kind: "text", data: await file.text(), size: file.size };
}

const kb = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

export default function Home() {
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Citation | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [chat]);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const read = await Promise.all([...files].map(readFile));
    setDocs((d) => [...d, ...read]);
  }

  function loadSample() {
    setDocs(SAMPLE_DOCS);
    setChat(SAMPLE_CHAT);
    setError(null);
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy || docs.length === 0) return;
    const history: ChatTurn[] = [...chat, { role: "user", text: q }];
    setChat([...history, { role: "assistant", text: "" }]);
    setInput("");
    setBusy(true);
    setError(null);

    const updateLast = (fn: (t: ChatTurn) => ChatTurn) =>
      setChat((c) => [...c.slice(0, -1), fn(c[c.length - 1])]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The model only needs plain text for earlier turns.
        body: JSON.stringify({ docs, history: history.map(({ role, text, parts }) => ({ role, text: parts ? parts.map((p) => p.text).join("") : text })) }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const e = JSON.parse(line) as StreamEvent;
          if (e.type === "delta") updateLast((t) => ({ ...t, text: t.text + e.text }));
          if (e.type === "final") updateLast((t) => ({ ...t, parts: e.parts }));
          if (e.type === "error") throw new Error(e.message);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setChat((c) => (c[c.length - 1]?.text ? c : c.slice(0, -1)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <span className="logo">◆</span> Ask<span className="grad">My</span>Docs
        </div>
        <p className="muted small">Upload PDFs or text files, then ask anything. Every answer links to the exact passage it came from.</p>

        <label className="drop">
          <input type="file" multiple accept="application/pdf,.txt,.md,.csv,text/plain" onChange={(e) => addFiles(e.target.files)} />
          <span>＋ Add PDFs or text files</span>
        </label>

        <ul className="docs">
          {docs.map((d, i) => (
            <li key={`${d.name}-${i}`}>
              <span className="doc-ico">{d.kind === "pdf" ? "PDF" : "TXT"}</span>
              <span className="doc-name" title={d.name}>{d.name}</span>
              <small className="muted">{kb(d.size)}</small>
              <button className="x" aria-label={`Remove ${d.name}`} onClick={() => setDocs((all) => all.filter((_, j) => j !== i))}>×</button>
            </li>
          ))}
        </ul>

        {docs.length === 0 && (
          <button className="ghost" onClick={loadSample}>Try the sample document</button>
        )}

        {active && (
          <div className="source">
            <div className="row">
              <b>Source</b>
              <button className="x" aria-label="Close source" onClick={() => setActive(null)}>×</button>
            </div>
            <small className="muted">{active.docTitle} {active.where}</small>
            <blockquote>{active.quote}</blockquote>
          </div>
        )}

        <footer className="muted small foot">Built by Fahad Shaikh with Next.js and the Claude API.</footer>
      </aside>

      <main className="main">
        <div className="thread">
          {chat.length === 0 && (
            <div className="empty">
              <h1>Ask your documents anything</h1>
              <p className="muted">Answers are grounded in your files, with citations you can click to check.</p>
              <div className="chips">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" disabled={!docs.length || busy} onClick={() => ask(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {chat.map((turn, i) => (
            <div key={i} className={`msg ${turn.role}`}>
              {turn.role === "assistant" ? (
                <Answer turn={turn} onCite={setActive} active={active} />
              ) : (
                <p>{turn.text}</p>
              )}
            </div>
          ))}
          {error && <div className="msg error">{error}</div>}
          <div ref={endRef} />
        </div>

        <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={docs.length ? "Ask a question about your documents..." : "Add a document to start"}
            disabled={!docs.length || busy}
            aria-label="Your question"
          />
          <button className="primary" disabled={!docs.length || busy || !input.trim()}>{busy ? "..." : "Ask"}</button>
        </form>
      </main>
    </div>
  );
}

function Answer({ turn, onCite, active }: { turn: ChatTurn; onCite: (c: Citation) => void; active: Citation | null }) {
  if (!turn.parts) {
    return <p className="streaming">{turn.text || <span className="typing">Reading your documents</span>}</p>;
  }
  // Number each distinct quote once, in order of first appearance.
  const index = new Map<string, number>();
  const n = (c: Citation) => {
    const key = `${c.docIndex}:${c.quote}`;
    if (!index.has(key)) index.set(key, index.size + 1);
    return index.get(key)!;
  };
  return (
    <p>
      {turn.parts.map((p: AnswerPart, i) => (
        <span key={i}>
          {p.text}
          {p.citations.map((c) => (
            <button
              key={c.quote}
              className={`cite ${active?.quote === c.quote ? "on" : ""}`}
              onClick={() => onCite(c)}
              title={c.quote}
            >
              {n(c)}
            </button>
          ))}
        </span>
      ))}
    </p>
  );
}
