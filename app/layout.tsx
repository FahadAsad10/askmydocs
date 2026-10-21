import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AskMyDocs",
  description: "Chat with your PDFs and notes, with citations to the exact passage. Powered by Claude.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
