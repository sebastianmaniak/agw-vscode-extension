import { h, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { ChatPanel } from './components/ChatPanel';
import type {
  ExtensionToWebviewMessage,
  Model,
  McpTool,
  ToolCall,
} from '../types';

const html = htm.bind(h);

const vscode = acquireVsCodeApi();

interface AppState {
  messages: UIMessage[];
  models: Model[];
  currentModel: string;
  connected: boolean;
  tools: McpTool[];
  streaming: boolean;
  toolTestResult: { result: string; error?: string } | null;
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
  const [state, setState] = useState<AppState>({
    messages: [],
    models: [],
    currentModel: '',
    connected: false,
    tools: [],
    streaming: false,
    toolTestResult: null,
  });

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
          setState((prev) => ({
            ...prev,
            models: msg.models,
            currentModel: msg.current,
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
    setState((prev) => ({ ...prev, currentModel: model }));
    vscode.postMessage({ type: 'selectModel', model });
  };

  return html`
    <${ChatPanel}
      messages=${state.messages}
      models=${state.models}
      currentModel=${state.currentModel}
      connected=${state.connected}
      streaming=${state.streaming}
      onSendMessage=${onSendMessage}
      onNewChat=${onNewChat}
      onSelectModel=${onSelectModel}
    />
  `;
}

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

render(html`<${App} />`, document.getElementById('root')!);
