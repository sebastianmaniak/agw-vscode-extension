import { h } from 'preact';
import { useMemo, useRef, useEffect } from 'preact/hooks';
import htm from 'htm';
import { marked } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import type { UIMessage } from '../index';
import { ToolCallCard } from './ToolCallCard';

const html = htm.bind(h);

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
};

marked.setOptions({
  highlight(code: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
});

interface MessageBubbleProps {
  message: UIMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === 'tool-call') {
    return html`<${ToolCallCard} toolCall=${message.toolCall} type="call" />`;
  }

  if (message.role === 'tool-result') {
    return html`<${ToolCallCard} content=${message.content} type="result" />`;
  }

  const isUser = message.role === 'user';
  const contentRef = useRef<HTMLDivElement>(null);

  const renderedContent = useMemo(() => {
    if (isUser) {
      return DOMPurify.sanitize(escapeHtml(message.content));
    }
    const rawHtml = marked.parse(message.content) as string;
    return DOMPurify.sanitize(rawHtml);
  }, [message.content, isUser]);

  // Add code block action buttons after render
  useEffect(() => {
    if (isUser || !contentRef.current) return;
    const preBlocks = contentRef.current.querySelectorAll('pre');
    preBlocks.forEach((pre) => {
      if (pre.querySelector('.code-actions')) return;
      const code = pre.querySelector('code');
      const rawCode = code?.textContent ?? pre.textContent ?? '';
      if (!rawCode.trim()) return;

      const actions = document.createElement('div');
      actions.className = 'code-actions';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-action-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.title = 'Copy code to clipboard';
      copyBtn.addEventListener('click', () => {
        const vscode = acquireVsCodeApi();
        vscode.postMessage({ type: 'copyCode', code: rawCode });
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      });

      const insertBtn = document.createElement('button');
      insertBtn.className = 'code-action-btn';
      insertBtn.textContent = 'Insert';
      insertBtn.title = 'Insert at cursor position in editor';
      insertBtn.addEventListener('click', () => {
        const vscode = acquireVsCodeApi();
        vscode.postMessage({ type: 'insertCodeAtCursor', code: rawCode });
      });

      actions.appendChild(copyBtn);
      actions.appendChild(insertBtn);
      pre.style.position = 'relative';
      pre.appendChild(actions);
    });
  }, [renderedContent, isUser]);

  return html`
    <div class="message ${isUser ? 'message-user' : 'message-assistant'}">
      <div class="message-label">
        ${isUser ? 'You' : 'Assistant'}
        ${!isUser && message.usage && html`
          <span class="message-tokens" title=${`Prompt: ${message.usage.prompt_tokens} | Completion: ${message.usage.completion_tokens}`}>
            ${message.usage.total_tokens.toLocaleString()} tok
          </span>
        `}
      </div>
      <div
        ref=${contentRef}
        class="message-content"
        dangerouslySetInnerHTML=${{ __html: renderedContent }}
      />
      ${message.streaming && html`<span class="cursor" />`}
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
