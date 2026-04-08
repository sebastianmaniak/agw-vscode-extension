import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';

const html = htm.bind(h);

interface A2aAgentCard {
  name: string;
  description?: string;
  url: string;
  skills?: Array<{ id: string; name: string; description?: string }>;
}

interface A2aPlaygroundProps {
  connected: boolean;
  agentCard: A2aAgentCard | null;
  onFetchCard: () => void;
  onSendTask: (message: string, skillId?: string) => void;
  taskResult: { result: string; error?: string } | null;
}

export function A2aPlayground(props: A2aPlaygroundProps) {
  const [message, setMessage] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (sending && props.taskResult) {
    setSending(false);
  }

  const handleSend = () => {
    if (!message.trim()) return;
    setSending(true);
    props.onSendTask(message.trim(), selectedSkill ?? undefined);
  };

  return html`
    <div class="playground">
      <div class="playground-header">
        <span class="playground-title">A2A Agents</span>
        <button class="icon-btn" onClick=${props.onFetchCard} title="Fetch Agent Card">
          Refresh
        </button>
      </div>

      ${!props.connected && html`
        <div class="playground-notice">Not connected to agentgateway.</div>
      `}

      ${props.connected && !props.agentCard && html`
        <div class="playground-notice">
          <p>Click Refresh to fetch the A2A agent card.</p>
        </div>
      `}

      ${props.agentCard && html`
        <div class="playground-body">
          <div class="playground-tools">
            <div class="a2a-card-info">
              <div class="tool-list-name">${props.agentCard.name}</div>
              <div class="tool-list-desc">${props.agentCard.description || 'No description'}</div>
            </div>
            <div class="tool-list">
              ${(props.agentCard.skills ?? []).length === 0 && html`
                <div class="tool-list-empty">No skills advertised</div>
              `}
              ${(props.agentCard.skills ?? []).map((s) => html`
                <div
                  key=${s.id}
                  class="tool-list-item ${selectedSkill === s.id ? 'selected' : ''}"
                  onClick=${() => setSelectedSkill(selectedSkill === s.id ? null : s.id)}
                >
                  <div class="tool-list-name">${s.name}</div>
                  <div class="tool-list-desc">${s.description || s.id}</div>
                </div>
              `)}
            </div>
          </div>

          <div class="playground-detail">
            <div class="playground-tool-detail">
              <div class="detail-section">
                <div class="detail-section-header">
                  <span>Send Task${selectedSkill ? ` (${selectedSkill})` : ''}</span>
                </div>
                <textarea
                  class="form-input"
                  style="resize: vertical; min-height: 80px;"
                  value=${message}
                  onInput=${(e: Event) => setMessage((e.target as HTMLTextAreaElement).value)}
                  placeholder="Type a message to send to the agent..."
                  rows="4"
                />
              </div>

              <div class="detail-actions">
                <button
                  class="send-btn"
                  onClick=${handleSend}
                  disabled=${sending || !message.trim() || !props.connected}
                >
                  ${sending ? 'Sending...' : 'Send Task'}
                </button>
              </div>

              ${props.taskResult && html`
                <div class="detail-section">
                  <div class="detail-section-header">
                    <span>${props.taskResult.error ? 'Error' : 'Response'}</span>
                  </div>
                  <pre class="detail-response ${props.taskResult.error ? 'error' : ''}">${
                    props.taskResult.error ?? props.taskResult.result
                  }</pre>
                </div>
              `}
            </div>
          </div>
        </div>
      `}
    </div>
  `;
}
