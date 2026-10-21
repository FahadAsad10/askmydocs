import type { ChatTurn, UploadedDoc } from "./types";

const POLICY = `Northwind Labs - Remote Work Policy (v2.1, fictional sample)

1. Eligibility
All full-time employees who have completed their 90-day probation may work remotely up to four days a week. Interns may work remotely two days a week with their manager's approval.

2. Core hours
Everyone must be available between 11:00 and 15:00 in their local time zone for meetings and collaboration. Outside core hours, schedules are flexible.

3. Equipment
Northwind provides a laptop, a monitor and a one-time home-office allowance of USD 400. Receipts must be submitted within 30 days of purchase through the expenses portal.

4. Internet
Employees receive a monthly internet stipend of USD 40, paid with salary. A connection of at least 25 Mbps is required.

5. Security
Company data may only be accessed over the company VPN. Working from public Wi-Fi without the VPN is not permitted. Lost or stolen devices must be reported to IT within 24 hours.

6. Working abroad
Employees may work from another country for up to 30 days per calendar year. Longer stays need written approval from HR because of tax and visa rules.`;

export const SAMPLE_DOCS: UploadedDoc[] = [
  { name: "remote-work-policy.txt", kind: "text", data: POLICY, size: POLICY.length },
];

const cite = (quote: string) => ({ docIndex: 0, docTitle: "remote-work-policy.txt", quote, where: "" });

export const SAMPLE_CHAT: ChatTurn[] = [
  { role: "user", text: "How much money do I get for my home office setup?" },
  {
    role: "assistant",
    text: "",
    parts: [
      { text: "You get two kinds of support:\n\n• A one-time home-office allowance of USD 400, on top of a company laptop and monitor. ", citations: [cite("Northwind provides a laptop, a monitor and a one-time home-office allowance of USD 400.")] },
      { text: "Submit receipts through the expenses portal within 30 days of buying.", citations: [cite("Receipts must be submitted within 30 days of purchase through the expenses portal.")] },
      { text: "\n• A monthly internet stipend of USD 40, paid with your salary.", citations: [cite("Employees receive a monthly internet stipend of USD 40, paid with salary.")] },
    ],
  },
  { role: "user", text: "Can I work from Dubai for six weeks?" },
  {
    role: "assistant",
    text: "",
    parts: [
      { text: "Not without HR approval. Working abroad is capped at 30 days per calendar year, and six weeks is about 42 days, ", citations: [cite("Employees may work from another country for up to 30 days per calendar year.")] },
      { text: "so you would need written approval from HR because of tax and visa rules.", citations: [cite("Longer stays need written approval from HR because of tax and visa rules.")] },
      { text: " Remember to use the company VPN while you're there.", citations: [cite("Company data may only be accessed over the company VPN.")] },
    ],
  },
];
