import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import htm from 'htm';
import { marked } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import type { UIMessage } from '../index';
import { ToolCallCard } from './ToolCallCard';

const html = htm.bind(h);

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

  // DOMPurify sanitizes all HTML before rendering — XSS safe
  const renderedContent = useMemo(() => {
    if (isUser) {
      return DOMPurify.sanitize(escapeHtml(message.content));
    }
    const rawHtml = marked.parse(message.content) as string;
    return DOMPurify.sanitize(rawHtml);
  }, [message.content, isUser]);

  return html`
    <div class="message ${isUser ? 'message-user' : 'message-assistant'}">
      <div class="message-label">${isUser ? 'You' : 'Assistant'}</div>
      <div
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
