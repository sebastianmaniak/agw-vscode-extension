import { h } from 'preact';
import { useRef, useEffect, useState } from 'preact/hooks';
import htm from 'htm';
import type { UIMessage } from '../index';
import { MessageBubble } from './MessageBubble';
import { ModelSelector } from './ModelSelector';

const html = htm.bind(h);

interface ChatPanelProps {
  messages: UIMessage[];
  models: string[];
  currentModel: string;
  connected: boolean;
  streaming: boolean;
  systemPrompt: string;
  onSendMessage: (content: string) => void;
  onNewChat: () => void;
  onSelectModel: (model: string) => void;
  onReconnect: () => void;
  onShowHistory: () => void;
  onShowSystemPrompt: () => void;
  onShowTemplates: () => void;
  onExportChat: () => void;
}

export function ChatPanel(props: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [props.messages]);

  // Pick up pending input from template insertion
  useEffect(() => {
    const pending = (window as any).__pendingInput;
    if (pending) {
      setInput(pending);
      (window as any).__pendingInput = null;
      textareaRef.current?.focus();
    }
  });

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
          <button class="icon-btn connect-btn ${props.connected ? 'connected' : ''}" onClick=${props.onReconnect} title=${props.connected ? 'Reconnect' : 'Connect to agentgateway'}>
            <span class="connection-dot ${props.connected ? 'connected' : 'disconnected'}" />
            ${props.connected ? 'Connected' : 'Connect'}
          </button>
          <button class="icon-btn" onClick=${props.onNewChat} title="New Chat">New</button>
        </div>
      </div>

      <div class="chat-toolbar">
        <button class="toolbar-btn" onClick=${props.onShowHistory} title="Chat History">History</button>
        <button class="toolbar-btn ${props.systemPrompt ? 'active' : ''}" onClick=${props.onShowSystemPrompt} title="System Prompt">
          System${props.systemPrompt ? ' *' : ''}
        </button>
        <button class="toolbar-btn" onClick=${props.onShowTemplates} title="Prompt Templates">Templates</button>
        ${props.messages.length > 0 && html`
          <button class="toolbar-btn" onClick=${props.onExportChat} title="Export as Markdown">Export</button>
        `}
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
