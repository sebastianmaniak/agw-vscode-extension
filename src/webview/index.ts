import { h, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { ChatPanel } from './components/ChatPanel';
import { McpPlayground } from './components/McpPlayground';
import { ResourceBrowser } from './components/ResourceBrowser';
import { A2aPlayground } from './components/A2aPlayground';
import { ConversationList } from './components/ConversationList';
import { SystemPromptEditor } from './components/SystemPromptEditor';
import { PromptTemplates } from './components/PromptTemplates';
import type {
  ExtensionToWebviewMessage,
  McpTool,
  McpResource,
  ToolCall,
  ConversationSummary,
  PromptTemplate,
  ChatMessage,
  A2aAgentCardInfo,
} from '../types';

const html = htm.bind(h);

const vscode = acquireVsCodeApi();

type Tab = 'chat' | 'playground' | 'resources' | 'a2a';
type Overlay = 'none' | 'history' | 'systemPrompt' | 'templates';

interface AppState {
  messages: UIMessage[];
  modelHistory: string[];
  currentModel: string;
  connected: boolean;
  tools: McpTool[];
  resources: McpResource[];
  resourceContent: { uri: string; content: string; mimeType?: string } | null;
  streaming: boolean;
  toolTestResult: { result: string; error?: string } | null;
  a2aAgentCard: A2aAgentCardInfo | null;
  a2aTaskResult: { result: string; error?: string } | null;
  tab: Tab;
  overlay: Overlay;
  conversations: ConversationSummary[];
  systemPrompt: string;
  promptTemplates: PromptTemplate[];
}

export interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool-call' | 'tool-result';
  content: string;
  toolCall?: ToolCall;
  toolCallId?: string;
  streaming?: boolean;
}

function chatMessagesToUI(messages: ChatMessage[]): UIMessage[] {
  const ui: UIMessage[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      ui.push({ id: crypto.randomUUID(), role: 'user', content: m.content ?? '' });
    } else if (m.role === 'assistant') {
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          ui.push({ id: crypto.randomUUID(), role: 'tool-call', content: '', toolCall: tc });
        }
      } else {
        ui.push({ id: crypto.randomUUID(), role: 'assistant', content: m.content ?? '' });
      }
    } else if (m.role === 'tool') {
      ui.push({ id: crypto.randomUUID(), role: 'tool-result', content: m.content ?? '', toolCallId: m.tool_call_id });
    }
  }
  return ui;
}

function App() {
  const [state, setState] = useState<AppState>(() => {
    const saved = vscode.getState() as Partial<AppState> | null;
    return {
      messages: [],
      modelHistory: saved?.modelHistory ?? [],
      currentModel: saved?.currentModel ?? '',
      connected: false,
      tools: [],
      resources: [],
      resourceContent: null,
      streaming: false,
      toolTestResult: null,
      a2aAgentCard: null,
      a2aTaskResult: null,
      tab: saved?.tab ?? 'chat',
      overlay: 'none',
      conversations: [],
      systemPrompt: '',
      promptTemplates: [],
    };
  });

  useEffect(() => {
    vscode.setState({
      modelHistory: state.modelHistory,
      currentModel: state.currentModel,
      tab: state.tab,
    });
  }, [state.modelHistory, state.currentModel, state.tab]);

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const msg = event.data;

      switch (msg.type) {
        case 'streamChunk':
          setState((prev) => {
            const msgs = [...prev.messages];
            const last = msgs[msgs.length - 1];
            if (last && last.role === 'assistant' && last.streaming) {
              msgs[msgs.length - 1] = { ...last, content: last.content + msg.content };
            } else {
              msgs.push({ id: crypto.randomUUID(), role: 'assistant', content: msg.content, streaming: true });
            }
            return { ...prev, messages: msgs, streaming: true };
          });
          break;

        case 'streamEnd':
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((m) => m.streaming ? { ...m, streaming: false } : m),
            streaming: false,
          }));
          break;

        case 'streamError':
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, { id: crypto.randomUUID(), role: 'assistant' as const, content: `**Error:** ${msg.error}` }],
            streaming: false,
          }));
          break;

        case 'toolCallStart':
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, { id: crypto.randomUUID(), role: 'tool-call' as const, content: '', toolCall: msg.toolCall }],
          }));
          break;

        case 'toolCallResult':
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, { id: crypto.randomUUID(), role: 'tool-result' as const, content: msg.result, toolCallId: msg.toolCallId }],
          }));
          break;

        case 'modelsLoaded':
          setState((prev) => ({
            ...prev,
            modelHistory: [...new Set([...prev.modelHistory, ...msg.models.map(m => m.id)])],
            currentModel: prev.currentModel || msg.current,
          }));
          break;

        case 'connectionStatus':
          setState((prev) => ({ ...prev, connected: msg.connected }));
          break;

        case 'toolsLoaded':
          setState((prev) => ({ ...prev, tools: msg.tools }));
          break;

        case 'toolTestResult':
          setState((prev) => ({ ...prev, toolTestResult: msg }));
          break;

        case 'conversationCleared':
          setState((prev) => ({ ...prev, messages: [], streaming: false }));
          break;

        case 'conversationList':
          setState((prev) => ({ ...prev, conversations: msg.conversations }));
          break;

        case 'conversationLoaded':
          setState((prev) => ({
            ...prev,
            messages: chatMessagesToUI(msg.messages),
            currentModel: msg.model || prev.currentModel,
            overlay: 'none',
          }));
          break;

        case 'resourcesLoaded':
          setState((prev) => ({ ...prev, resources: msg.resources }));
          break;

        case 'resourceContent':
          setState((prev) => ({ ...prev, resourceContent: { uri: msg.uri, content: msg.content, mimeType: msg.mimeType } }));
          break;

        case 'systemPromptLoaded':
          setState((prev) => ({ ...prev, systemPrompt: msg.prompt }));
          break;

        case 'promptTemplatesLoaded':
          setState((prev) => ({ ...prev, promptTemplates: msg.templates }));
          break;

        case 'a2aAgentCard':
          setState((prev) => ({ ...prev, a2aAgentCard: msg.card }));
          break;

        case 'a2aTaskResult':
          setState((prev) => ({ ...prev, a2aTaskResult: msg }));
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // --- Actions ---

  const onSendMessage = (content: string) => {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, { id: crypto.randomUUID(), role: 'user', content }],
    }));
    vscode.postMessage({ type: 'sendMessage', content });
  };

  const onNewChat = () => { vscode.postMessage({ type: 'newChat' }); };

  const onSelectModel = (model: string) => {
    setState((prev) => ({
      ...prev,
      currentModel: model,
      modelHistory: [...new Set([model, ...prev.modelHistory])],
    }));
    vscode.postMessage({ type: 'selectModel', model });
  };

  const onReconnect = () => { vscode.postMessage({ type: 'reconnect' }); };

  const onTestTool = (toolName: string, args: Record<string, unknown>) => {
    setState((prev) => ({ ...prev, toolTestResult: null }));
    vscode.postMessage({ type: 'testTool', toolName, args });
  };

  const onRefreshTools = () => { vscode.postMessage({ type: 'refreshTools' }); };

  const onExportChat = () => { vscode.postMessage({ type: 'exportChat' }); };

  const showHistory = () => {
    vscode.postMessage({ type: 'listConversations' });
    setState((prev) => ({ ...prev, overlay: 'history' }));
  };

  const setTab = (tab: Tab) => {
    setState((prev) => ({ ...prev, tab }));
    if (tab === 'resources') { vscode.postMessage({ type: 'listResources' }); }
  };

  // Insert template content into chat input
  const onUseTemplate = (content: string) => {
    setState((prev) => ({ ...prev, overlay: 'none' }));
    // We'll use a small trick: set a "pendingInput" that ChatPanel picks up
    (window as any).__pendingInput = content;
    // Force re-render
    setState((prev) => ({ ...prev }));
  };

  return html`
    <div class="app">
      <div class="tab-bar">
        <button class="tab-btn ${state.tab === 'chat' ? 'active' : ''}" onClick=${() => setTab('chat')}>
          Chat
        </button>
        <button class="tab-btn ${state.tab === 'playground' ? 'active' : ''}" onClick=${() => setTab('playground')}>
          Tools${state.tools.length > 0 ? ` (${state.tools.length})` : ''}
        </button>
        <button class="tab-btn ${state.tab === 'resources' ? 'active' : ''}" onClick=${() => setTab('resources')}>
          Resources
        </button>
        <button class="tab-btn ${state.tab === 'a2a' ? 'active' : ''}" onClick=${() => setTab('a2a')}>
          A2A
        </button>
      </div>

      ${state.overlay !== 'none' ? html`
        ${state.overlay === 'history' && html`
          <${ConversationList}
            conversations=${state.conversations}
            onLoad=${(id: string) => vscode.postMessage({ type: 'loadConversation', id })}
            onDelete=${(id: string) => vscode.postMessage({ type: 'deleteConversation', id })}
            onClose=${() => setState((prev: AppState) => ({ ...prev, overlay: 'none' }))}
          />
        `}
        ${state.overlay === 'systemPrompt' && html`
          <${SystemPromptEditor}
            prompt=${state.systemPrompt}
            onSave=${(prompt: string) => {
              setState((prev: AppState) => ({ ...prev, systemPrompt: prompt }));
              vscode.postMessage({ type: 'setSystemPrompt', prompt });
            }}
            onClose=${() => setState((prev: AppState) => ({ ...prev, overlay: 'none' }))}
          />
        `}
        ${state.overlay === 'templates' && html`
          <${PromptTemplates}
            templates=${state.promptTemplates}
            onUse=${onUseTemplate}
            onSave=${(t: PromptTemplate) => vscode.postMessage({ type: 'savePromptTemplate', template: t })}
            onDelete=${(id: string) => vscode.postMessage({ type: 'deletePromptTemplate', id })}
            onClose=${() => setState((prev: AppState) => ({ ...prev, overlay: 'none' }))}
          />
        `}
      ` : html`
        ${state.tab === 'chat' && html`
          <${ChatPanel}
            messages=${state.messages}
            models=${state.modelHistory}
            currentModel=${state.currentModel}
            connected=${state.connected}
            streaming=${state.streaming}
            systemPrompt=${state.systemPrompt}
            onSendMessage=${onSendMessage}
            onNewChat=${onNewChat}
            onSelectModel=${onSelectModel}
            onReconnect=${onReconnect}
            onShowHistory=${showHistory}
            onShowSystemPrompt=${() => setState((prev: AppState) => ({ ...prev, overlay: 'systemPrompt' }))}
            onShowTemplates=${() => {
              vscode.postMessage({ type: 'listPromptTemplates' });
              setState((prev: AppState) => ({ ...prev, overlay: 'templates' }));
            }}
            onExportChat=${onExportChat}
          />
        `}

        ${state.tab === 'playground' && html`
          <${McpPlayground}
            tools=${state.tools}
            connected=${state.connected}
            onTestTool=${onTestTool}
            onRefreshTools=${onRefreshTools}
            testResult=${state.toolTestResult}
          />
        `}

        ${state.tab === 'resources' && html`
          <${ResourceBrowser}
            resources=${state.resources}
            onRefresh=${() => vscode.postMessage({ type: 'listResources' })}
            onRead=${(uri: string) => vscode.postMessage({ type: 'readResource', uri })}
            resourceContent=${state.resourceContent}
          />
        `}

        ${state.tab === 'a2a' && html`
          <${A2aPlayground}
            connected=${state.connected}
            agentCard=${state.a2aAgentCard}
            onFetchCard=${() => vscode.postMessage({ type: 'fetchA2aCard' })}
            onSendTask=${(message: string, skillId?: string) => {
              setState((prev: AppState) => ({ ...prev, a2aTaskResult: null }));
              vscode.postMessage({ type: 'sendA2aTask', message, skillId });
            }}
            taskResult=${state.a2aTaskResult}
          />
        `}
      `}
    </div>
  `;
}

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

render(html`<${App} />`, document.getElementById('root')!);
