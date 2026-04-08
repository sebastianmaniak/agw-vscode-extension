import { h } from 'preact';
import { useRef, useEffect, useState } from 'preact/hooks';
import htm from 'htm';
import type { UIMessage, CodeContext } from '../index';
import type { GatewayProfile } from '../../types';
import { MessageBubble } from './MessageBubble';

const html = htm.bind(h);

interface ChatPanelProps {
  messages: UIMessage[];
  models: string[];
  currentModel: string;
  connected: boolean;
  streaming: boolean;
  responseModel: string;
  systemPrompt: string;
  gateways: GatewayProfile[];
  activeGateway: string;
  codeContexts: CodeContext[];
  onSendMessage: (content: string) => void;
  onNewChat: () => void;
  onSelectModel: (model: string) => void;
  onReconnect: () => void;
  onSwitchGateway: (name: string) => void;
  onRemoveContext: (id: string) => void;
  onAddGateway: () => void;
  onShowHistory: () => void;
  onShowSystemPrompt: () => void;
  onShowTemplates: () => void;
  onExportChat: () => void;
}

export function ChatPanel(props: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [editingModel, setEditingModel] = useState(false);
  const [modelDraft, setModelDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

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

  const startModelEdit = () => {
    setModelDraft(props.currentModel);
    setEditingModel(true);
    setTimeout(() => modelInputRef.current?.focus(), 0);
  };

  const commitModel = () => {
    const val = modelDraft.trim();
    if (val && val !== props.currentModel) {
      props.onSelectModel(val);
    }
    setEditingModel(false);
  };

  const handleModelKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitModel(); }
    else if (e.key === 'Escape') { setEditingModel(false); }
  };

  const menuAction = (fn: () => void) => {
    setShowMenu(false);
    fn();
  };

  const hasMultipleGateways = props.gateways.length > 1;

  return html`
    <div class="chat-panel">
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

      <div class="input-area-wrapper">
        <div class="input-box">
          ${props.codeContexts.length > 0 && html`
            <div class="context-chips">
              ${props.codeContexts.map((ctx) => html`
                <span key=${ctx.id} class="context-chip" title=${`${ctx.fileName}\n${ctx.code.slice(0, 200)}`}>
                  <span class="chip-icon">↗</span>
                  <span class="chip-label">${ctx.fileName || 'selection'}</span>
                  <button class="chip-remove" onClick=${() => props.onRemoveContext(ctx.id)} title="Remove">×</button>
                </span>
              `)}
            </div>
          `}
          <textarea
            ref=${textareaRef}
            class="chat-input-new"
            placeholder=${props.connected ? 'Describe what to do...' : 'Not connected to agentgateway'}
            value=${input}
            onInput=${handleInput}
            onKeyDown=${handleKeyDown}
            disabled=${!props.connected}
            rows="1"
          />
          <div class="input-toolbar">
            <div class="input-toolbar-left">
              <div class="menu-wrapper" ref=${menuRef}>
                <button class="input-tool-btn plus-btn" onClick=${() => setShowMenu(!showMenu)} title="Actions">+</button>
                ${showMenu && html`
                  <div class="action-menu">
                    <button class="menu-item" onClick=${() => menuAction(props.onNewChat)}>
                      <span class="menu-icon">💬</span> New Chat
                    </button>
                    <button class="menu-item" onClick=${() => menuAction(props.onShowHistory)}>
                      <span class="menu-icon">📋</span> History
                    </button>
                    <button class="menu-item" onClick=${() => menuAction(props.onShowSystemPrompt)}>
                      <span class="menu-icon">⚙</span> System Prompt${props.systemPrompt ? ' •' : ''}
                    </button>
                    <button class="menu-item" onClick=${() => menuAction(props.onShowTemplates)}>
                      <span class="menu-icon">📝</span> Templates
                    </button>
                    ${props.messages.length > 0 && html`
                      <button class="menu-item" onClick=${() => menuAction(props.onExportChat)}>
                        <span class="menu-icon">📤</span> Export
                      </button>
                    `}
                    <div class="menu-divider" />
                    <button class="menu-item" onClick=${() => menuAction(props.onAddGateway)}>
                      <span class="menu-icon">🔌</span> Add Gateway
                    </button>
                  </div>
                `}
              </div>
              ${hasMultipleGateways && html`
                <select
                  class="input-tool-select"
                  value=${props.activeGateway}
                  onChange=${(e: Event) => props.onSwitchGateway((e.target as HTMLSelectElement).value)}
                  title="Switch gateway"
                >
                  ${props.gateways.map((g) => html`<option key=${g.name} value=${g.name}>${g.name}</option>`)}
                </select>
              `}
              ${editingModel ? html`
                <input
                  ref=${modelInputRef}
                  class="input-model-edit"
                  type="text"
                  value=${modelDraft}
                  list="model-list"
                  onInput=${(e: Event) => setModelDraft((e.target as HTMLInputElement).value)}
                  onKeyDown=${handleModelKeyDown}
                  onBlur=${commitModel}
                  placeholder="Model..."
                />
                <datalist id="model-list">
                  ${props.models.map((m) => html`<option key=${m} value=${m} />`)}
                </datalist>
              ` : html`
                <button class="input-tool-btn model-btn" onClick=${startModelEdit} title="Click to change model">
                  ${props.currentModel || 'Model'}${' '}↓
                </button>
              `}
            </div>
            <button
              class="send-btn-new"
              onClick=${handleSend}
              disabled=${!props.connected || props.streaming || !input.trim()}
              title="Send message"
            >
              ${props.streaming ? '...' : '↑'}
            </button>
          </div>
        </div>

        <div class="status-bar">
          <button class="status-connection ${props.connected ? 'connected' : ''}" onClick=${props.onReconnect} title=${props.connected ? 'Connected — click to reconnect' : 'Disconnected — click to connect'}>
            <span class="status-dot ${props.connected ? 'connected' : 'disconnected'}" />
            ${props.connected ? props.activeGateway : 'Disconnected'}
          </button>
          ${props.responseModel && props.responseModel !== props.currentModel && html`
            <span class="status-model-badge" title="Actual model used">${props.responseModel}</span>
          `}
        </div>
      </div>
    </div>
  `;
}
