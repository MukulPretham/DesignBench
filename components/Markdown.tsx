import ReactMarkdown from "react-markdown";

// GitHub-README-style markdown for both the problem pane and chat bubbles.
// prose-invert handles dark mode; max-w-none lets it fill the column.
export default function Markdown({ text }: { text: string }) {
  return (
    <div className="prose prose-invert max-w-none prose-pre:overflow-x-auto prose-pre:rounded prose-pre:border prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
