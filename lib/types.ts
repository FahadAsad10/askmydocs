// Shapes shared by the API route and the UI.

export interface UploadedDoc {
  name: string;
  kind: "pdf" | "text";
  /** base64 for PDFs, raw text for text files */
  data: string;
  size: number;
}

export interface Citation {
  docIndex: number;
  docTitle: string;
  quote: string;
  /** "p. 3" for PDFs, "" for text */
  where: string;
}

export interface AnswerPart {
  text: string;
  citations: Citation[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  parts?: AnswerPart[];
}

/** One line of the NDJSON stream sent by /api/chat */
export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "final"; parts: AnswerPart[] }
  | { type: "error"; message: string };
