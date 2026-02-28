import React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import "highlight.js/styles/github-dark.css"

interface MarkdownBlockProps {
  content: string
  className?: string
}

export const MarkdownBlock: React.FC<MarkdownBlockProps> = ({ content, className = "" }) => {
  return (
    <div
      className={`prism-markdown ${className}`}
      style={{
        color: "var(--vscode-foreground)",
        fontSize: "var(--vscode-font-size, 13px)",
        lineHeight: 1.6,
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Code blocks
          pre({ children, ...props }) {
            return (
              <pre
                {...props}
                style={{
                  backgroundColor: "var(--vscode-textCodeBlock-background, #1e1e1e)",
                  borderRadius: "4px",
                  padding: "12px",
                  overflowX: "auto",
                  fontSize: "0.9em",
                  margin: "8px 0",
                  border: "1px solid var(--vscode-widget-border, #444)",
                }}
              >
                {children}
              </pre>
            )
          },
          // Code (inline vs block detected by className)
          code({ className, children, ...props }) {
            // Block code has a language-xxx className from rehype-highlight
            const isInline = !className
            if (isInline) {
              return (
                <code
                  className={className}
                  style={{
                    backgroundColor: "var(--vscode-textCodeBlock-background, #1e1e1e)",
                    borderRadius: "3px",
                    padding: "1px 4px",
                    fontSize: "0.9em",
                    fontFamily: "var(--vscode-editor-font-family, monospace)",
                  }}
                >
                  {children}
                </code>
              )
            }
            return (
              <code className={className} {...props} style={{ fontFamily: "var(--vscode-editor-font-family, monospace)" }}>
                {children}
              </code>
            )
          },
          // Links
          a({ href, children, ...props }) {
            return (
              <a
                {...props}
                href={href}
                style={{ color: "var(--vscode-textLink-foreground, #4fc3f7)" }}
                onClick={(e) => {
                  e.preventDefault()
                  // In webview, external links should be opened by the extension
                  window.parent.postMessage({ type: "openLink", url: href }, "*")
                }}
              >
                {children}
              </a>
            )
          },
          // Blockquotes
          blockquote({ children, ...props }) {
            return (
              <blockquote
                {...props}
                style={{
                  borderLeft: "3px solid var(--vscode-textBlockQuote-border, #4fc3f7)",
                  margin: "8px 0",
                  paddingLeft: "12px",
                  color: "var(--vscode-descriptionForeground)",
                }}
              >
                {children}
              </blockquote>
            )
          },
          // Tables
          table({ children, ...props }) {
            return (
              <div style={{ overflowX: "auto", margin: "8px 0" }}>
                <table
                  {...props}
                  style={{
                    borderCollapse: "collapse",
                    width: "100%",
                    fontSize: "0.9em",
                  }}
                >
                  {children}
                </table>
              </div>
            )
          },
          th({ children, ...props }) {
            return (
              <th
                {...props}
                style={{
                  borderBottom: "1px solid var(--vscode-widget-border, #444)",
                  padding: "6px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                }}
              >
                {children}
              </th>
            )
          },
          td({ children, ...props }) {
            return (
              <td
                {...props}
                style={{
                  borderBottom: "1px solid var(--vscode-widget-border, #333)",
                  padding: "6px 12px",
                }}
              >
                {children}
              </td>
            )
          },
          // Horizontal rule
          hr() {
            return (
              <hr
                style={{
                  border: "none",
                  borderTop: "1px solid var(--vscode-widget-border, #444)",
                  margin: "12px 0",
                }}
              />
            )
          },
          // Lists
          ul({ children, ...props }) {
            return (
              <ul
                {...props}
                style={{ paddingLeft: "20px", margin: "6px 0" }}
              >
                {children}
              </ul>
            )
          },
          ol({ children, ...props }) {
            return (
              <ol
                {...props}
                style={{ paddingLeft: "20px", margin: "6px 0" }}
              >
                {children}
              </ol>
            )
          },
          li({ children, ...props }) {
            return (
              <li {...props} style={{ margin: "2px 0" }}>
                {children}
              </li>
            )
          },
          // Headings
          h1({ children, ...props }) {
            return (
              <h1 {...props} style={{ fontSize: "1.4em", fontWeight: 700, margin: "12px 0 6px" }}>
                {children}
              </h1>
            )
          },
          h2({ children, ...props }) {
            return (
              <h2 {...props} style={{ fontSize: "1.2em", fontWeight: 700, margin: "10px 0 5px" }}>
                {children}
              </h2>
            )
          },
          h3({ children, ...props }) {
            return (
              <h3 {...props} style={{ fontSize: "1.1em", fontWeight: 600, margin: "8px 0 4px" }}>
                {children}
              </h3>
            )
          },
          p({ children, ...props }) {
            return (
              <p {...props} style={{ margin: "6px 0" }}>
                {children}
              </p>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
