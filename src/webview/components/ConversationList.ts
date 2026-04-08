import { h } from 'preact';
import htm from 'htm';
import type { ConversationSummary } from '../../types';

const html = htm.bind(h);

interface ConversationListProps {
  conversations: ConversationSummary[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function ConversationList(props: ConversationListProps) {
  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return html`
    <div class="conversation-list">
      <div class="conv-header">
        <span class="conv-title">History</span>
        <button class="icon-btn" onClick=${props.onClose}>Back</button>
      </div>
      <div class="conv-items">
        ${props.conversations.length === 0 && html`
          <div class="conv-empty">No saved conversations</div>
        `}
        ${props.conversations.map((c) => html`
          <div key=${c.id} class="conv-item" onClick=${() => props.onLoad(c.id)}>
            <div class="conv-item-top">
              <span class="conv-item-title">${c.title || 'Untitled'}</span>
              <span class="conv-item-date">${formatDate(c.updatedAt)}</span>
            </div>
            <div class="conv-item-bottom">
              <span class="conv-item-meta">${c.model || 'no model'} · ${c.messageCount} msgs</span>
              <button
                class="conv-delete-btn"
                onClick=${(e: Event) => { e.stopPropagation(); props.onDelete(c.id); }}
                title="Delete conversation"
              >x</button>
            </div>
          </div>
        `)}
      </div>
    </div>
  `;
}
