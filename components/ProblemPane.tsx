import Markdown from "./Markdown";

export default function ProblemPane({ statementMd }: { statementMd: string }) {
  return <Markdown text={statementMd} />;
}
