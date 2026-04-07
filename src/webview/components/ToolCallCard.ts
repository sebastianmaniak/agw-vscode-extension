import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import type { ToolCall } from '../../types';

const html = htm.bind(h);

interface ToolCallCardProps {
  type: 'call' | 'result';
  toolCall?: ToolCall;
  content?: string;
}

export function ToolCallCard({ type, toolCall, content }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (type === 'call' && toolCall) {
    let args = '';
    try {
      args = JSON.stringify(JSON.parse(toolCall.function.arguments), null, 2);
    } catch {
      args = toolCall.function.arguments;
    }

    return html`
      <div class="tool-card tool-call" onClick=${() => setExpanded(!expanded)}>
        <div class="tool-card-header">
          <span class="tool-icon">fn</span>
          <span class="tool-name">${toolCall.function.name}</span>
          <span class="tool-expand">${expanded ? 'v' : '>'}</span>
        </div>
        ${expanded && html`
          <pre class="tool-args">${args}</pre>
        `}
      </div>
    `;
  }

  if (type === 'result') {
    return html`
      <div class="tool-card tool-result" onClick=${() => setExpanded(!expanded)}>
        <div class="tool-card-header">
          <span class="tool-icon">ok</span>
          <span class="tool-label">Tool Result</span>
          <span class="tool-expand">${expanded ? 'v' : '>'}</span>
        </div>
        ${expanded && html`
          <pre class="tool-result-content">${content}</pre>
        `}
      </div>
    `;
  }

  return null;
}
