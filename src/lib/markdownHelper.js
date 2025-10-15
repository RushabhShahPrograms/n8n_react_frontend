import { marked } from "marked";

export function renderMarkdownToHTML(markdownText) {
  if (!markdownText) return "";
  return marked.parse(markdownText);
}
