import { h, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { ChatPanel } from './components/ChatPanel';
import { McpPlayground } from './components/McpPlayground';
import type {
  ExtensionToWebviewMessage,
  McpTool,
  ToolCall,
} from '../types';

const html = htm.bind(h);

const vscode = acquireVsCodeApi();

type Tab = 'chat' | 'playground';

interface AppState {
  messages: UIMessage[];
  modelHistory: string[];
  currentModel: string;
  connected: boolean;
  tools: McpTool[];
  streaming: boolean;
  toolTestResult: { result: string; error?: string } | null;
  tab: Tab;
}

export interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool-call' | 'tool-result';
  content: string;
  toolCall?: ToolCall;
  toolCallId?: string;
  streaming?: boolean;
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
      streaming: false,
      toolTestResult: null,
      tab: saved?.tab ?? 'chat',
    };
  });

  // Persist model and tab choices
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
              msgs.push({
                id: crypto.randomUUID(),
                role: 'assistant',
                content: msg.content,
                streaming: true,
              });
            }
            return { ...prev, messages: msgs, streaming: true };
          });
          break;

        case 'streamEnd':
          setState((prev) => {
            const msgs = prev.messages.map((m) =>
              m.streaming ? { ...m, streaming: false } : m,
            );
            return { ...prev, messages: msgs, streaming: false };
          });
          break;

        case 'streamError':
          setState((prev) => {
            const msgs = [...prev.messages, {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content: `**Error:** ${msg.error}`,
            }];
            return { ...prev, messages: msgs, streaming: false };
          });
          break;

        case 'toolCallStart':
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, {
              id: crypto.randomUUID(),
              role: 'tool-call' as const,
              content: '',
              toolCall: msg.toolCall,
            }],
          }));
          break;

        case 'toolCallResult':
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, {
              id: crypto.randomUUID(),
              role: 'tool-result' as const,
              content: msg.result,
              toolCallId: msg.toolCallId,
            }],
          }));
          break;

        case 'modelsLoaded':
          setState((prev) => {
            const newHistory = [...new Set([...prev.modelHistory, ...msg.models.map(m => m.id)])];
            return {
              ...prev,
              modelHistory: newHistory,
              currentModel: prev.currentModel || msg.current,
            };
          });
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
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const onSendMessage = (content: string) => {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, {
        id: crypto.randomUUID(),
        role: 'user',
        content,
      }],
    }));
    vscode.postMessage({ type: 'sendMessage', content });
  };

  const onNewChat = () => {
    vscode.postMessage({ type: 'newChat' });
  };

  const onSelectModel = (model: string) => {
    setState((prev) => ({
      ...prev,
      currentModel: model,
      modelHistory: [...new Set([model, ...prev.modelHistory])],
    }));
    vscode.postMessage({ type: 'selectModel', model });
  };

  const onReconnect = () => {
    vscode.postMessage({ type: 'reconnect' });
  };

  const onTestTool = (toolName: string, args: Record<string, unknown>) => {
    setState((prev) => ({ ...prev, toolTestResult: null }));
    vscode.postMessage({ type: 'testTool', toolName, args });
  };

  const onRefreshTools = () => {
    vscode.postMessage({ type: 'refreshTools' });
  };

  const setTab = (tab: Tab) => {
    setState((prev) => ({ ...prev, tab }));
  };

  return html`
    <div class="app">
      <div class="tab-bar">
        <button
          class="tab-btn ${state.tab === 'chat' ? 'active' : ''}"
          onClick=${() => setTab('chat')}
        >
          Chat
        </button>
        <button
          class="tab-btn ${state.tab === 'playground' ? 'active' : ''}"
          onClick=${() => setTab('playground')}
        >
          MCP Playground${state.tools.length > 0 ? ` (${state.tools.length})` : ''}
        </button>
      </div>

      ${state.tab === 'chat' && html`
        <${ChatPanel}
          messages=${state.messages}
          models=${state.modelHistory}
          currentModel=${state.currentModel}
          connected=${state.connected}
          streaming=${state.streaming}
          onSendMessage=${onSendMessage}
          onNewChat=${onNewChat}
          onSelectModel=${onSelectModel}
          onReconnect=${onReconnect}
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
    </div>
  `;
}

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

render(html`<${App} />`, document.getElementById('root')!);
