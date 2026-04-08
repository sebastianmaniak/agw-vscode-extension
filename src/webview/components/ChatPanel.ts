import { h } from 'preact';
import { useRef, useEffect, useState } from 'preact/hooks';
import htm from 'htm';
import type { UIMessage } from '../index';
import type { Model } from '../../types';
import { MessageBubble } from './MessageBubble';
import { ModelSelector } from './ModelSelector';

const html = htm.bind(h);

interface ChatPanelProps {
  messages: UIMessage[];
  models: Model[];
  currentModel: string;
  connected: boolean;
  streaming: boolean;
  onSendMessage: (content: string) => void;
  onNewChat: () => void;
  onSelectModel: (model: string) => void;
}

export function ChatPanel(props: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [props.messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || props.streaming) return;
    props.onSendMessage(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    setInput(target.value);
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 150) + 'px';
  };

  return html`
    <div class="chat-panel">
      <div class="chat-header">
        <${ModelSelector}
          models=${props.models}
          current=${props.currentModel}
          onSelect=${props.onSelectModel}
        />
        <div class="header-right">
          <span class="connection-dot ${props.connected ? 'connected' : 'disconnected'}" />
          <button class="icon-btn" onClick=${props.onNewChat} title="New Chat">
            New
          </button>
        </div>
      </div>

      <div class="messages">
        ${props.messages.length === 0 && html`
          <div class="empty-state">
            <p>Send a message to start chatting through agentgateway.</p>
          </div>
        `}
        ${props.messages.map((msg) => html`
          <${MessageBubble} key=${msg.id} message=${msg} />
        `)}
        <div ref=${messagesEndRef} />
      </div>

      <div class="input-area">
        <textarea
          ref=${textareaRef}
          class="chat-input"
          placeholder=${props.connected ? 'Send a message...' : 'Not connected to agentgateway'}
          value=${input}
          onInput=${handleInput}
          onKeyDown=${handleKeyDown}
          disabled=${!props.connected}
          rows="1"
        />
        <button
          class="send-btn"
          onClick=${handleSend}
          disabled=${!props.connected || props.streaming || !input.trim()}
        >
          ${props.streaming ? '...' : 'Send'}
        </button>
      </div>
    </div>
  `;
}
