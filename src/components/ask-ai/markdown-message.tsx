"use client";

import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function downloadCsv(filename: string, rows: string[][]) {
  const body = rows
    .map((row) =>
      row
        .map((cell) => {
          const v = cell.replace(/"/g, '""');
          return /[",\n]/.test(v) ? `"${v}"` : v;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseTable(block: string): string[][] | null {
  const lines = block
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2 || !lines.every((l) => l.includes("|"))) return null;
  const rows = lines
    .filter((l) => !/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(l))
    .map((l) =>
      l
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim()),
    );
  return rows.length ? rows : null;
}

function inline(text: string, keyPrefix: string) {
  const parts: (string | ReactNode)[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={`${keyPrefix}-${i++}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <code key={`${keyPrefix}-${i++}`} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function MarkdownMessage({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/);
  let tableN = 0;
  return (
    <div className={cn("space-y-3 text-sm leading-relaxed", className)}>
      {blocks.map((raw, bi) => {
        const block = raw.trim();
        if (!block) return null;
        const fence = block.match(/^```(?:\w+)?\n?([\s\S]*?)```$/);
        if (fence) {
          return (
            <pre key={bi} className="overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-xs">
              {fence[1].replace(/\n$/, "")}
            </pre>
          );
        }
        const table = parseTable(block);
        if (table) {
          const id = ++tableN;
          return (
            <div key={bi} className="space-y-1.5">
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60">
                    <tr>
                      {table[0].map((h, i) => (
                        <th key={i} className="px-2.5 py-1.5 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.slice(1).map((row, ri) => (
                      <tr key={ri} className="border-t border-border">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-2.5 py-1.5">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                onClick={() => downloadCsv(`kupe-export-${id}.csv`, table)}
              >
                <Download className="size-3.5" />
                Download CSV
              </Button>
            </div>
          );
        }
        if (/^#{1,3}\s/.test(block)) {
          const hashes = block.match(/^#+/)?.[0].length ?? 1;
          const title = block.replace(/^#{1,3}\s+/, "");
          const Tag = (hashes === 1 ? "h2" : hashes === 2 ? "h3" : "h4") as "h2" | "h3" | "h4";
          return (
            <Tag key={bi} className="font-semibold tracking-tight">
              {inline(title, `h-${bi}`)}
            </Tag>
          );
        }
        if (/^[-*]\s/m.test(block)) {
          const items = block.split("\n").filter((l) => /^[-*]\s/.test(l));
          return (
            <ul key={bi} className="list-disc space-y-1 pl-4">
              {items.map((item, i) => (
                <li key={i}>{inline(item.replace(/^[-*]\s+/, ""), `li-${bi}-${i}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="whitespace-pre-wrap">
            {inline(block, `p-${bi}`)}
          </p>
        );
      })}
    </div>
  );
}
