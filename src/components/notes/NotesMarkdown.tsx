import type { ReactNode } from "react";

type NotesMarkdownProps = {
  text: string;
  className?: string;
};

const parseInline = (text: string, keyPrefix: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;
  let partIndex = 0;
  let match = pattern.exec(text);
  while (match) {
    const token = match[0] ?? "";
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${partIndex}`}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("__") && token.endsWith("__")) {
      nodes.push(
        <u key={`${keyPrefix}-u-${partIndex}`}>{token.slice(2, -2)}</u>
      );
    } else if (
      (token.startsWith("*") && token.endsWith("*")) ||
      (token.startsWith("_") && token.endsWith("_"))
    ) {
      nodes.push(
        <em key={`${keyPrefix}-i-${partIndex}`}>{token.slice(1, -1)}</em>
      );
    } else {
      nodes.push(token);
    }
    lastIndex = index + token.length;
    partIndex += 1;
    match = pattern.exec(text);
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
};

export default function NotesMarkdown({ text, className }: NotesMarkdownProps) {
  const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraphLines: string[] = [];
  let paragraphIndex = 0;
  let spacerIndex = 0;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }
    const content = paragraphLines.join(" ");
    blocks.push(
      <p key={`p-${paragraphIndex}`} className="mb-2">
        {parseInline(content, `p-${paragraphIndex}`)}
      </p>
    );
    paragraphLines = [];
    paragraphIndex += 1;
  };

  lines.forEach((rawLine) => {
    const line = rawLine ?? "";
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      blocks.push(<div key={`sp-${spacerIndex}`} className="h-3" />);
      spacerIndex += 1;
      return;
    }
    if (trimmed === "---" || trimmed === "***") {
      flushParagraph();
      blocks.push(<hr key={`hr-${spacerIndex}`} className="my-2 border-[var(--line)]" />);
      spacerIndex += 1;
      return;
    }
    if (trimmed.startsWith("## ")) {
      flushParagraph();
      blocks.push(
        <h2 key={`h2-${spacerIndex}`} className="mb-2 text-base font-semibold">
          {parseInline(trimmed.slice(3), `h2-${spacerIndex}`)}
        </h2>
      );
      spacerIndex += 1;
      return;
    }
    if (trimmed.startsWith("# ")) {
      flushParagraph();
      blocks.push(
        <h1 key={`h1-${spacerIndex}`} className="mb-2 text-lg font-semibold">
          {parseInline(trimmed.slice(2), `h1-${spacerIndex}`)}
        </h1>
      );
      spacerIndex += 1;
      return;
    }
    paragraphLines.push(line);
  });
  flushParagraph();

  return <div className={className}>{blocks}</div>;
}

