import React from "react";
import { renderMarkdownToHTML } from "@/lib/markdownHelper";

export const InsightsSection = ({ insightsText }) => {
  if (!insightsText) return null;

  const htmlContent = renderMarkdownToHTML(insightsText);

  return (
    <div
      style={{
        background: "#f7fafc",
        padding: "16px",
        borderRadius: "8px",
        overflow: "auto",
      }}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};
