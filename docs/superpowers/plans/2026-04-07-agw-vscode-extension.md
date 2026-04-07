# AgentGateway VS Code Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working VS Code extension that provides streaming AI chat and MCP tool browsing through a running AgentGateway instance.

**Architecture:** Webview-based chat panel (Preact + HTM) communicates with an extension host that manages all AgentGateway API calls. A native tree view provides MCP tool browsing. The extension host handles streaming SSE for chat and JSON-RPC over Streamable HTTP for MCP.

**Tech Stack:** TypeScript, VS Code Extension API, Preact + HTM, marked + highlight.js + DOMPurify, esbuild

**Key API Details (AgentGateway):**
- LLM API: `POST /v1/chat/completions` (OpenAI-compatible, SSE streaming) on LLM listener port
- Models: `GET /v1/models` on LLM listener port
- MCP: JSON-RPC over Streamable HTTP (POST) on MCP listener port
- Health: `GET /healthz/ready` on port 15021
- Admin dashboard: port 15000

**Important:** AgentGateway runs LLM and MCP on separate listener ports (e.g. 8080 for LLM, 3000 for MCP). The extension needs two endpoint settings.

---

## File Map

```
agw-vscode-extension/
├── package.json                     # Extension manifest: commands, views, settings, activation
├── tsconfig.json                    # Extension host TypeScript config (Node.js)
├── esbuild.mjs                      # Build config: two entry points (extension + webview)
├── .vscodeignore                    # Packaging exclusions
├── resources/
│   └── agw-icon.svg                 # Activity bar icon (single-color SVG)
├── src/
│   ├── extension.ts                 # activate/deactivate, register providers + commands
│   ├── types.ts                     # Shared types: messages, tools, config, API responses
│   ├── gateway/
│   │   ├── client.ts               # Base HTTP client, connection management, health check
│   │   ├── models.ts               # GET /v1/models — list available LLM models
│   │   ├── chat.ts                 # POST /v1/chat/completions — streaming SSE chat
│   │   └── mcp.ts                  # MCP JSON-RPC: initialize, tools/list, tools/call
│   ├── state/
│   │   └── conversation.ts         # Conversation history: add/clear messages, tool results
│   ├── providers/
│   │   ├── chatViewProvider.ts     # WebviewViewProvider for chat panel
│   │   └── toolTreeProvider.ts     # TreeDataProvider for MCP tool browser
│   └── webview/
│       ├── tsconfig.json           # Webview TypeScript config (browser)
│       ├── index.ts                # Preact app entry: mount, message handler
│       ├── components/
│       │   ├── ChatPanel.ts        # Top bar + message thread + input area
│       │   ├── MessageBubble.ts    # Single message: user, assistant, or tool result
│       │   ├── ToolCallCard.ts     # Collapsible tool call + result inline card
│       │   ├── ToolTestForm.ts     # JSON schema -> form for testing tools
│       │   └── ModelSelector.ts    # Dropdown for model switching
│       └── styles.css              # All webview styles
├── test/
│   ├── gateway/
│   │   ├── client.test.ts          # Health check, error handling
│   │   ├── models.test.ts          # Model listing, parsing
│   │   ├── chat.test.ts            # Streaming SSE parsing, tool_calls detection
│   │   └── mcp.test.ts             # JSON-RPC tool discovery, tool execution
│   └── state/
│       └── conversation.test.ts    # Message history management
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/webview/tsconfig.json`
- Create: `esbuild.mjs`
- Create: `.vscodeignore`
- Create: `resources/agw-icon.svg`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "agw-vscode",
  "displayName": "AgentGateway",
  "description": "AI chat and MCP tool browser for AgentGateway",
  "version": "0.1.0",
  "publisher": "solo-io",
  "license": "Apache-2.0",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["AI", "Chat"],
  "activationEvents": [],
  "main": "./dist/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "agw-explorer",
          "title": "AgentGateway",
          "icon": "resources/agw-icon.svg"
        }
      ]
    },
    "views": {
      "agw-explorer": [
        {
          "id": "agw-tools",
          "name": "MCP Tools"
        },
        {
          "type": "webview",
          "id": "agw-chat",
          "name": "Chat"
        }
      ]
    },
    "commands": [
      {
        "command": "agw.openChat",
        "title": "Open Chat",
        "category": "AgentGateway",
        "icon": "$(comment-discussion)"
      },
      {
        "command": "agw.refreshTools",
        "title": "Refresh Tools",
        "category": "AgentGateway",
        "icon": "$(refresh)"
      },
      {
        "command": "agw.configure",
        "title": "Configure",
        "category": "AgentGateway",
        "icon": "$(gear)"
      }
    ],
    "menus": {
      "view/title": [
        {
          "command": "agw.refreshTools",
          "when": "view == agw-tools",
          "group": "navigation"
        }
      ]
    },
    "configuration": {
      "title": "AgentGateway",
      "properties": {
        "agw.llmEndpoint": {
          "type": "string",
          "default": "http://localhost:8080",
          "description": "URL of the AgentGateway LLM listener (OpenAI-compatible API)"
        },
        "agw.mcpEndpoint": {
          "type": "string",
          "default": "http://localhost:3000",
          "description": "URL of the AgentGateway MCP listener"
        },
        "agw.apiKey": {
          "type": "string",
          "default": "",
          "description": "API key for authenticated AgentGateway instances"
        },
        "agw.defaultModel": {
          "type": "string",
          "default": "",
          "description": "Default LLM model to use for chat (leave empty to pick from available models)"
        }
      }
    }
  },
  "scripts": {
    "compile": "node esbuild.mjs",
    "watch": "node esbuild.mjs --watch",
    "package": "node esbuild.mjs --production",
    "check-types": "tsc --noEmit && tsc --noEmit -p src/webview/tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "esbuild": "^0.24.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "preact": "^10.24.0",
    "htm": "^3.1.1",
    "marked": "^14.0.0",
    "highlight.js": "^11.10.0",
    "dompurify": "^3.1.0",
    "@types/dompurify": "^3.0.5"
  },
  "dependencies": {
    "preact": "^10.24.0",
    "htm": "^3.1.1",
    "marked": "^14.0.0",
    "highlight.js": "^11.10.0",
    "dompurify": "^3.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "Node16",
    "moduleResolution": "Node16",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/webview/**", "test/**"]
}
```

- [ ] **Step 3: Create `src/webview/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "ES2022",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  },
  "include": ["./**/*.ts"]
}
```

- [ ] **Step 4: Create `esbuild.mjs`**

```javascript
import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

const sharedOptions = {
  bundle: true,
  minify: isProduction,
  sourcemap: !isProduction,
  logLevel: 'info',
};

// Extension host build (Node.js, CJS)
const extensionBuild = {
  ...sharedOptions,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  format: 'cjs',
  platform: 'node',
  external: ['vscode'],
};

// Webview build (browser, IIFE)
const webviewBuild = {
  ...sharedOptions,
  entryPoints: ['src/webview/index.ts'],
  outfile: 'dist/webview.js',
  format: 'iife',
  platform: 'browser',
};

if (isWatch) {
  const [extCtx, webCtx] = await Promise.all([
    esbuild.context(extensionBuild),
    esbuild.context(webviewBuild),
  ]);
  await Promise.all([extCtx.watch(), webCtx.watch()]);
  console.log('Watching for changes...');
} else {
  await Promise.all([
    esbuild.build(extensionBuild),
    esbuild.build(webviewBuild),
  ]);
}
```

- [ ] **Step 5: Create `.vscodeignore`**

```
src/**
test/**
node_modules/**
.vscode/**
.gitignore
tsconfig.json
esbuild.mjs
**/*.map
docs/**
```

- [ ] **Step 6: Create `resources/agw-icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
</svg>
```

- [ ] **Step 7: Install dependencies and verify build**

```bash
npm install
npm run compile
```

Expected: `dist/extension.js` and `dist/webview.js` created without errors.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json src/webview/tsconfig.json esbuild.mjs .vscodeignore resources/agw-icon.svg
git commit -m "feat: project scaffolding with esbuild, TypeScript, and Preact"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```typescript
// --- Configuration ---

export interface AgwConfig {
  llmEndpoint: string;
  mcpEndpoint: string;
  apiKey: string;
  defaultModel: string;
}

// --- OpenAI-compatible API types ---

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  tools?: ChatTool[];
}

export interface ChatTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

export interface ChatCompletionChunk {
  id: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
}

export interface Model {
  id: string;
  object: string;
  owned_by: string;
}

export interface ModelsResponse {
  data: Model[];
}

// --- MCP types ---

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  description?: string;
  enum?: string[];
  items?: JsonSchema;
  default?: unknown;
  [key: string]: unknown;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  /** Which MCP server this tool belongs to (from annotations or server grouping) */
  serverName?: string;
}

export interface McpJsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpJsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// --- Webview message types ---

export type ExtensionToWebviewMessage =
  | { type: 'streamChunk'; content: string }
  | { type: 'streamEnd' }
  | { type: 'streamError'; error: string }
  | { type: 'toolCallStart'; toolCall: ToolCall }
  | { type: 'toolCallResult'; toolCallId: string; result: string }
  | { type: 'modelsLoaded'; models: Model[]; current: string }
  | { type: 'connectionStatus'; connected: boolean }
  | { type: 'toolsLoaded'; tools: McpTool[] }
  | { type: 'toolTestResult'; result: string; error?: string }
  | { type: 'assistantMessage'; content: string }
  | { type: 'conversationCleared' };

export type WebviewToExtensionMessage =
  | { type: 'sendMessage'; content: string }
  | { type: 'newChat' }
  | { type: 'selectModel'; model: string }
  | { type: 'testTool'; toolName: string; args: Record<string, unknown> }
  | { type: 'toggleTool'; toolName: string; enabled: boolean }
  | { type: 'inspectTool'; toolName: string };
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared types for API, MCP, and webview messages"
```

---

## Task 3: Gateway Client — Connection & Health Check

**Files:**
- Create: `src/gateway/client.ts`
- Create: `test/gateway/client.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/gateway/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GatewayClient } from '../src/gateway/client';

describe('GatewayClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkHealth', () => {
    it('returns true when healthz endpoint responds 200', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('ready\n'),
      }));

      const client = new GatewayClient({
        llmEndpoint: 'http://localhost:8080',
        mcpEndpoint: 'http://localhost:3000',
        apiKey: '',
        defaultModel: '',
      });

      const result = await client.checkHealth();
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:15021/healthz/ready',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('returns false when healthz endpoint fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('not ready'),
      }));

      const client = new GatewayClient({
        llmEndpoint: 'http://localhost:8080',
        mcpEndpoint: 'http://localhost:3000',
        apiKey: '',
        defaultModel: '',
      });

      const result = await client.checkHealth();
      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

      const client = new GatewayClient({
        llmEndpoint: 'http://localhost:8080',
        mcpEndpoint: 'http://localhost:3000',
        apiKey: '',
        defaultModel: '',
      });

      const result = await client.checkHealth();
      expect(result).toBe(false);
    });
  });

  describe('headers', () => {
    it('includes Authorization header when apiKey is set', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      }));

      const client = new GatewayClient({
        llmEndpoint: 'http://localhost:8080',
        mcpEndpoint: 'http://localhost:3000',
        apiKey: 'test-key-123',
        defaultModel: '',
      });

      await client.fetchJson('http://localhost:8080/v1/models');
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/models',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key-123',
          }),
        })
      );
    });

    it('omits Authorization header when apiKey is empty', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      }));

      const client = new GatewayClient({
        llmEndpoint: 'http://localhost:8080',
        mcpEndpoint: 'http://localhost:3000',
        apiKey: '',
        defaultModel: '',
      });

      await client.fetchJson('http://localhost:8080/v1/models');
      const callHeaders = (fetch as any).mock.calls[0][1].headers;
      expect(callHeaders['Authorization']).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/gateway/client.test.ts
```

Expected: FAIL -- cannot find module `../src/gateway/client`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/gateway/client.ts
import type { AgwConfig } from '../types';

export class GatewayClient {
  private config: AgwConfig;

  constructor(config: AgwConfig) {
    this.config = config;
  }

  updateConfig(config: AgwConfig): void {
    this.config = config;
  }

  get llmEndpoint(): string {
    return this.config.llmEndpoint.replace(/\/+$/, '');
  }

  get mcpEndpoint(): string {
    return this.config.mcpEndpoint.replace(/\/+$/, '');
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      h['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return h;
  }

  /**
   * Derives the readiness endpoint from the LLM endpoint.
   * AgentGateway default readiness port is 15021.
   */
  private get healthUrl(): string {
    const url = new URL(this.config.llmEndpoint);
    url.port = '15021';
    url.pathname = '/healthz/ready';
    return url.toString();
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(this.healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      method: 'GET',
      headers: this.headers,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  async postJson<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  async postStream(url: string, body: unknown): Promise<Response> {
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    return res;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/gateway/client.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/gateway/client.ts test/gateway/client.test.ts
git commit -m "feat: gateway client with health check and HTTP helpers"
```

---

## Task 4: Model Discovery

**Files:**
- Create: `src/gateway/models.ts`
- Create: `test/gateway/models.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/gateway/models.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchModels } from '../src/gateway/models';
import { GatewayClient } from '../src/gateway/client';

describe('fetchModels', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed model list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
          { id: 'claude-sonnet-4-20250514', object: 'model', owned_by: 'anthropic' },
        ],
      }),
    }));

    const client = new GatewayClient({
      llmEndpoint: 'http://localhost:8080',
      mcpEndpoint: 'http://localhost:3000',
      apiKey: '',
      defaultModel: '',
    });

    const models = await fetchModels(client);
    expect(models).toHaveLength(2);
    expect(models[0].id).toBe('gpt-4o');
    expect(models[1].id).toBe('claude-sonnet-4-20250514');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/v1/models',
      expect.any(Object)
    );
  });

  it('returns empty array on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

    const client = new GatewayClient({
      llmEndpoint: 'http://localhost:8080',
      mcpEndpoint: 'http://localhost:3000',
      apiKey: '',
      defaultModel: '',
    });

    const models = await fetchModels(client);
    expect(models).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/gateway/models.test.ts
```

Expected: FAIL -- cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/gateway/models.ts
import type { GatewayClient } from './client';
import type { Model, ModelsResponse } from '../types';

export async function fetchModels(client: GatewayClient): Promise<Model[]> {
  try {
    const res = await client.fetchJson<ModelsResponse>(
      `${client.llmEndpoint}/v1/models`
    );
    return res.data ?? [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/gateway/models.test.ts
```

Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/gateway/models.ts test/gateway/models.test.ts
git commit -m "feat: model discovery via /v1/models endpoint"
```

---

## Task 5: Streaming Chat Completions

**Files:**
- Create: `src/gateway/chat.ts`
- Create: `test/gateway/chat.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/gateway/chat.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamChatCompletion, parseSSELine } from '../src/gateway/chat';
import { GatewayClient } from '../src/gateway/client';
import type { ChatMessage, ChatTool, ChatCompletionChunk } from '../src/types';

describe('parseSSELine', () => {
  it('parses a data line into a chunk', () => {
    const chunk: ChatCompletionChunk = {
      id: 'chatcmpl-1',
      choices: [{
        index: 0,
        delta: { content: 'Hello' },
        finish_reason: null,
      }],
    };
    const result = parseSSELine(`data: ${JSON.stringify(chunk)}`);
    expect(result).toEqual(chunk);
  });

  it('returns null for [DONE]', () => {
    expect(parseSSELine('data: [DONE]')).toBeNull();
  });

  it('returns undefined for empty lines', () => {
    expect(parseSSELine('')).toBeUndefined();
    expect(parseSSELine('\n')).toBeUndefined();
  });

  it('returns undefined for comment lines', () => {
    expect(parseSSELine(': keep-alive')).toBeUndefined();
  });
});

describe('streamChatCompletion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('streams content chunks via callback', async () => {
    const sseBody = [
      'data: {"id":"1","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}',
      '',
      'data: {"id":"1","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}',
      '',
      'data: {"id":"1","choices":[{"index":0,"delta":{"content":" there"},"finish_reason":null}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseBody));
        controller.close();
      },
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    }));

    const client = new GatewayClient({
      llmEndpoint: 'http://localhost:8080',
      mcpEndpoint: 'http://localhost:3000',
      apiKey: '',
      defaultModel: '',
    });

    const chunks: ChatCompletionChunk[] = [];
    await streamChatCompletion(
      client,
      'gpt-4o',
      [{ role: 'user', content: 'hello' }],
      [],
      (chunk) => { chunks.push(chunk); }
    );

    expect(chunks).toHaveLength(3);
    expect(chunks[1].choices[0].delta.content).toBe('Hi');
    expect(chunks[2].choices[0].delta.content).toBe(' there');
  });

  it('detects tool_calls in stream', async () => {
    const toolCallChunks = [
      'data: {"id":"1","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"get_weather","arguments":""}}]},"finish_reason":null}]}',
      '',
      'data: {"id":"1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"city\\":\\"NYC\\"}"}}]},"finish_reason":null}]}',
      '',
      'data: {"id":"1","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(toolCallChunks));
        controller.close();
      },
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    }));

    const client = new GatewayClient({
      llmEndpoint: 'http://localhost:8080',
      mcpEndpoint: 'http://localhost:3000',
      apiKey: '',
      defaultModel: '',
    });

    const chunks: ChatCompletionChunk[] = [];
    await streamChatCompletion(
      client,
      'gpt-4o',
      [{ role: 'user', content: 'weather in NYC' }],
      [],
      (chunk) => { chunks.push(chunk); }
    );

    // First chunk has tool_calls with name
    expect(chunks[0].choices[0].delta.tool_calls![0].function!.name).toBe('get_weather');
    // Last chunk has finish_reason tool_calls
    expect(chunks[2].choices[0].finish_reason).toBe('tool_calls');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/gateway/chat.test.ts
```

Expected: FAIL -- cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/gateway/chat.ts
import type { GatewayClient } from './client';
import type {
  ChatMessage,
  ChatTool,
  ChatCompletionChunk,
  ChatCompletionRequest,
} from '../types';

export function parseSSELine(line: string): ChatCompletionChunk | null | undefined {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) {
    return undefined;
  }
  if (!trimmed.startsWith('data: ')) {
    return undefined;
  }
  const data = trimmed.slice(6);
  if (data === '[DONE]') {
    return null;
  }
  return JSON.parse(data) as ChatCompletionChunk;
}

export async function streamChatCompletion(
  client: GatewayClient,
  model: string,
  messages: ChatMessage[],
  tools: ChatTool[],
  onChunk: (chunk: ChatCompletionChunk) => void,
  signal?: AbortSignal,
): Promise<void> {
  const body: ChatCompletionRequest = {
    model,
    messages,
    stream: true,
  };
  if (tools.length > 0) {
    body.tools = tools;
  }

  const res = await client.postStream(
    `${client.llmEndpoint}/v1/chat/completions`,
    body,
  );

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep last potentially incomplete line in buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const parsed = parseSSELine(line);
        if (parsed === null) return; // [DONE]
        if (parsed !== undefined) {
          onChunk(parsed);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/gateway/chat.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/gateway/chat.ts test/gateway/chat.test.ts
git commit -m "feat: streaming chat completions with SSE parsing"
```

---

## Task 6: Conversation State Management

**Files:**
- Create: `src/state/conversation.ts`
- Create: `test/state/conversation.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/state/conversation.test.ts
import { describe, it, expect } from 'vitest';
import { Conversation } from '../src/state/conversation';

describe('Conversation', () => {
  it('starts empty', () => {
    const conv = new Conversation();
    expect(conv.messages).toEqual([]);
  });

  it('adds user message', () => {
    const conv = new Conversation();
    conv.addUserMessage('Hello');
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0]).toEqual({ role: 'user', content: 'Hello' });
  });

  it('adds assistant message', () => {
    const conv = new Conversation();
    conv.addAssistantMessage('Hi there');
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0]).toEqual({ role: 'assistant', content: 'Hi there' });
  });

  it('adds assistant message with tool calls', () => {
    const conv = new Conversation();
    conv.addAssistantToolCallMessage([{
      id: 'call_1',
      type: 'function',
      function: { name: 'search', arguments: '{"q":"test"}' },
    }]);
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0].role).toBe('assistant');
    expect(conv.messages[0].content).toBeNull();
    expect(conv.messages[0].tool_calls).toHaveLength(1);
  });

  it('adds tool result message', () => {
    const conv = new Conversation();
    conv.addToolResultMessage('call_1', 'result data');
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0]).toEqual({
      role: 'tool',
      content: 'result data',
      tool_call_id: 'call_1',
    });
  });

  it('clears all messages', () => {
    const conv = new Conversation();
    conv.addUserMessage('Hello');
    conv.addAssistantMessage('Hi');
    conv.clear();
    expect(conv.messages).toEqual([]);
  });

  it('builds messages array for API call', () => {
    const conv = new Conversation();
    conv.addUserMessage('weather in NYC');
    conv.addAssistantToolCallMessage([{
      id: 'call_1',
      type: 'function',
      function: { name: 'get_weather', arguments: '{"city":"NYC"}' },
    }]);
    conv.addToolResultMessage('call_1', '72F, sunny');
    conv.addAssistantMessage('The weather in NYC is 72F and sunny.');

    expect(conv.messages).toHaveLength(4);
    expect(conv.messages[0].role).toBe('user');
    expect(conv.messages[1].role).toBe('assistant');
    expect(conv.messages[2].role).toBe('tool');
    expect(conv.messages[3].role).toBe('assistant');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/state/conversation.test.ts
```

Expected: FAIL -- cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/state/conversation.ts
import type { ChatMessage, ToolCall } from '../types';

export class Conversation {
  private _messages: ChatMessage[] = [];

  get messages(): ChatMessage[] {
    return [...this._messages];
  }

  addUserMessage(content: string): void {
    this._messages.push({ role: 'user', content });
  }

  addAssistantMessage(content: string): void {
    this._messages.push({ role: 'assistant', content });
  }

  addAssistantToolCallMessage(toolCalls: ToolCall[]): void {
    this._messages.push({
      role: 'assistant',
      content: null,
      tool_calls: toolCalls,
    });
  }

  addToolResultMessage(toolCallId: string, result: string): void {
    this._messages.push({
      role: 'tool',
      content: result,
      tool_call_id: toolCallId,
    });
  }

  clear(): void {
    this._messages = [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/state/conversation.test.ts
```

Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/state/conversation.ts test/state/conversation.test.ts
git commit -m "feat: conversation state management"
```

---

## Task 7: MCP Tool Discovery & Execution

**Files:**
- Create: `src/gateway/mcp.ts`
- Create: `test/gateway/mcp.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/gateway/mcp.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpClient } from '../src/gateway/mcp';
import { GatewayClient } from '../src/gateway/client';

function makeGatewayClient() {
  return new GatewayClient({
    llmEndpoint: 'http://localhost:8080',
    mcpEndpoint: 'http://localhost:3000',
    apiKey: '',
    defaultModel: '',
  });
}

describe('McpClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize + listTools', () => {
    it('sends initialize then tools/list and returns tools', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, opts: any) => {
        const body = JSON.parse(opts.body);

        if (body.method === 'initialize') {
          return {
            ok: true,
            headers: new Headers({ 'mcp-session-id': 'sess-123' }),
            json: () => Promise.resolve({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                protocolVersion: '2025-03-26',
                capabilities: { tools: {} },
                serverInfo: { name: 'agentgateway', version: '0.1.0' },
              },
            }),
          };
        }

        if (body.method === 'notifications/initialized') {
          return {
            ok: true,
            headers: new Headers({ 'mcp-session-id': 'sess-123' }),
            json: () => Promise.resolve({}),
          };
        }

        if (body.method === 'tools/list') {
          return {
            ok: true,
            headers: new Headers({ 'mcp-session-id': 'sess-123' }),
            json: () => Promise.resolve({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                tools: [
                  {
                    name: 'get_weather',
                    description: 'Get current weather',
                    inputSchema: {
                      type: 'object',
                      properties: { city: { type: 'string' } },
                      required: ['city'],
                    },
                  },
                  {
                    name: 'search_docs',
                    description: 'Search documentation',
                    inputSchema: {
                      type: 'object',
                      properties: { query: { type: 'string' } },
                      required: ['query'],
                    },
                  },
                ],
              },
            }),
          };
        }

        return { ok: true, json: () => Promise.resolve({}) };
      }));

      const gateway = makeGatewayClient();
      const mcp = new McpClient(gateway);
      const tools = await mcp.connect();

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('get_weather');
      expect(tools[1].name).toBe('search_docs');
    });
  });

  describe('callTool', () => {
    it('sends tools/call and returns result', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, opts: any) => {
        const body = JSON.parse(opts.body);

        if (body.method === 'initialize') {
          return {
            ok: true,
            headers: new Headers({ 'mcp-session-id': 'sess-123' }),
            json: () => Promise.resolve({
              jsonrpc: '2.0', id: body.id,
              result: { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'test' } },
            }),
          };
        }

        if (body.method === 'notifications/initialized') {
          return { ok: true, headers: new Headers({}), json: () => Promise.resolve({}) };
        }

        if (body.method === 'tools/list') {
          return {
            ok: true,
            headers: new Headers({ 'mcp-session-id': 'sess-123' }),
            json: () => Promise.resolve({
              jsonrpc: '2.0', id: body.id,
              result: { tools: [{ name: 'get_weather', description: 'Weather', inputSchema: { type: 'object' } }] },
            }),
          };
        }

        if (body.method === 'tools/call') {
          expect(body.params.name).toBe('get_weather');
          expect(body.params.arguments).toEqual({ city: 'NYC' });
          return {
            ok: true,
            headers: new Headers({ 'mcp-session-id': 'sess-123' }),
            json: () => Promise.resolve({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                content: [{ type: 'text', text: '72F, sunny' }],
              },
            }),
          };
        }

        return { ok: true, headers: new Headers({}), json: () => Promise.resolve({}) };
      }));

      const gateway = makeGatewayClient();
      const mcp = new McpClient(gateway);
      await mcp.connect();

      const result = await mcp.callTool('get_weather', { city: 'NYC' });
      expect(result).toBe('72F, sunny');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run test/gateway/mcp.test.ts
```

Expected: FAIL -- cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/gateway/mcp.ts
import type { GatewayClient } from './client';
import type { McpTool, McpJsonRpcRequest, McpJsonRpcResponse } from '../types';

export class McpClient {
  private gateway: GatewayClient;
  private sessionId: string | null = null;
  private nextId = 1;

  constructor(gateway: GatewayClient) {
    this.gateway = gateway;
  }

  private async rpc(method: string, params?: Record<string, unknown>): Promise<McpJsonRpcResponse> {
    const request: McpJsonRpcRequest = {
      jsonrpc: '2.0',
      id: this.nextId++,
      method,
      ...(params ? { params } : {}),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const res = await fetch(this.gateway.mcpEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      throw new Error(`MCP RPC error: HTTP ${res.status}`);
    }

    // Capture session ID from response
    const sid = res.headers.get('mcp-session-id');
    if (sid) {
      this.sessionId = sid;
    }

    return res.json() as Promise<McpJsonRpcResponse>;
  }

  private async notify(method: string, params?: Record<string, unknown>): Promise<void> {
    const body: any = {
      jsonrpc: '2.0',
      method,
      ...(params ? { params } : {}),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    await fetch(this.gateway.mcpEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  /**
   * Initialize MCP session and return available tools.
   */
  async connect(): Promise<McpTool[]> {
    // Step 1: Initialize
    const initResult = await this.rpc('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'agw-vscode', version: '0.1.0' },
    });

    if (initResult.error) {
      throw new Error(`MCP initialize failed: ${initResult.error.message}`);
    }

    // Step 2: Send initialized notification
    await this.notify('notifications/initialized');

    // Step 3: List tools
    return this.listTools();
  }

  async listTools(): Promise<McpTool[]> {
    const result = await this.rpc('tools/list');
    if (result.error) {
      throw new Error(`MCP tools/list failed: ${result.error.message}`);
    }
    const data = result.result as { tools: McpTool[] };
    return data.tools ?? [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.rpc('tools/call', { name, arguments: args });
    if (result.error) {
      throw new Error(`MCP tools/call failed: ${result.error.message}`);
    }
    const data = result.result as { content: Array<{ type: string; text?: string }> };
    return data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n');
  }

  disconnect(): void {
    this.sessionId = null;
    this.nextId = 1;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run test/gateway/mcp.test.ts
```

Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/gateway/mcp.ts test/gateway/mcp.test.ts
git commit -m "feat: MCP client with JSON-RPC tool discovery and execution"
```

---

## Task 8: Extension Activation & Status Bar

**Files:**
- Create: `src/extension.ts`

- [ ] **Step 1: Create `src/extension.ts`**

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import type { AgwConfig } from './types';
import { GatewayClient } from './gateway/client';
import { McpClient } from './gateway/mcp';
import { fetchModels } from './gateway/models';
import { Conversation } from './state/conversation';
import { ChatViewProvider } from './providers/chatViewProvider';
import { ToolTreeProvider } from './providers/toolTreeProvider';
import type { McpTool, Model } from './types';

function getConfig(): AgwConfig {
  const cfg = vscode.workspace.getConfiguration('agw');
  return {
    llmEndpoint: cfg.get<string>('llmEndpoint', 'http://localhost:8080'),
    mcpEndpoint: cfg.get<string>('mcpEndpoint', 'http://localhost:3000'),
    apiKey: cfg.get<string>('apiKey', ''),
    defaultModel: cfg.get<string>('defaultModel', ''),
  };
}

export function activate(context: vscode.ExtensionContext) {
  const config = getConfig();
  const gateway = new GatewayClient(config);
  const mcp = new McpClient(gateway);
  const conversation = new Conversation();

  // State
  let models: Model[] = [];
  let tools: McpTool[] = [];
  let currentModel = config.defaultModel;
  let connected = false;

  // Status bar
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  statusBarItem.command = 'agw.configure';
  statusBarItem.text = '$(plug) AGW: Connecting...';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Tree view provider
  const toolTreeProvider = new ToolTreeProvider();
  const treeView = vscode.window.createTreeView('agw-tools', {
    treeDataProvider: toolTreeProvider,
  });
  context.subscriptions.push(treeView);

  // Chat webview provider
  const chatProvider = new ChatViewProvider(
    context.extensionUri,
    gateway,
    mcp,
    conversation,
    () => currentModel,
    () => tools.filter((t) => toolTreeProvider.isToolEnabled(t.name)),
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('agw-chat', chatProvider),
  );

  // Connect and discover
  async function connectToGateway() {
    statusBarItem.text = '$(sync~spin) AGW: Connecting...';

    const healthy = await gateway.checkHealth();
    if (!healthy) {
      statusBarItem.text = '$(error) AGW: Disconnected';
      statusBarItem.tooltip = 'AgentGateway is not reachable. Click to configure.';
      connected = false;
      chatProvider.sendToWebview({ type: 'connectionStatus', connected: false });
      return;
    }

    connected = true;
    statusBarItem.text = '$(check) AGW: Connected';
    statusBarItem.tooltip = `LLM: ${config.llmEndpoint}\nMCP: ${config.mcpEndpoint}`;
    chatProvider.sendToWebview({ type: 'connectionStatus', connected: true });

    // Fetch models
    models = await fetchModels(gateway);
    if (!currentModel && models.length > 0) {
      currentModel = models[0].id;
    }
    chatProvider.sendToWebview({
      type: 'modelsLoaded',
      models,
      current: currentModel,
    });

    // Fetch MCP tools
    try {
      tools = await mcp.connect();
      toolTreeProvider.setTools(tools);
      chatProvider.sendToWebview({ type: 'toolsLoaded', tools });
    } catch (e) {
      // MCP is optional -- gateway may not have an MCP listener
      tools = [];
      toolTreeProvider.setTools([]);
    }
  }

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('agw.openChat', () => {
      vscode.commands.executeCommand('agw-chat.focus');
    }),

    vscode.commands.registerCommand('agw.refreshTools', async () => {
      try {
        tools = await mcp.listTools();
        toolTreeProvider.setTools(tools);
        chatProvider.sendToWebview({ type: 'toolsLoaded', tools });
        vscode.window.showInformationMessage(`Loaded ${tools.length} MCP tools`);
      } catch (e: any) {
        vscode.window.showErrorMessage(`Failed to refresh tools: ${e.message}`);
      }
    }),

    vscode.commands.registerCommand('agw.configure', () => {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'agw',
      );
    }),

    vscode.commands.registerCommand('agw.toggleTool', (item: any) => {
      if (item?.tool?.name) {
        toolTreeProvider.toggleTool(item.tool.name);
      }
    }),

    vscode.commands.registerCommand('agw.inspectTool', (item: any) => {
      if (item?.tool) {
        chatProvider.sendToWebview({
          type: 'toolsLoaded',
          tools: [item.tool],
        });
      }
    }),
  );

  // React to config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('agw')) {
        const newConfig = getConfig();
        gateway.updateConfig(newConfig);
        mcp.disconnect();
        connectToGateway();
      }
    }),
  );

  // Initial connection
  connectToGateway();
}

export function deactivate() {
  // Nothing to clean up -- disposables handled by context.subscriptions
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run check-types 2>&1 || true
```

This will fail until we create the provider files in the next tasks. That's expected -- we commit this now and wire it up after.

- [ ] **Step 3: Commit**

```bash
git add src/extension.ts
git commit -m "feat: extension activation with status bar, commands, and connection flow"
```

---

## Task 9: Tool Tree Provider

**Files:**
- Create: `src/providers/toolTreeProvider.ts`

- [ ] **Step 1: Create `src/providers/toolTreeProvider.ts`**

```typescript
// src/providers/toolTreeProvider.ts
import * as vscode from 'vscode';
import type { McpTool } from '../types';

export class ToolTreeItem extends vscode.TreeItem {
  constructor(
    public readonly tool: McpTool,
    public enabled: boolean,
  ) {
    super(tool.name, vscode.TreeItemCollapsibleState.None);
    this.description = tool.description;
    this.tooltip = new vscode.MarkdownString(
      `**${tool.name}**\n\n${tool.description}\n\n` +
      '```json\n' + JSON.stringify(tool.inputSchema, null, 2) + '\n```',
    );
    this.iconPath = new vscode.ThemeIcon(
      enabled ? 'check' : 'circle-outline',
    );
    this.contextValue = enabled ? 'tool-enabled' : 'tool-disabled';
  }
}

export class ToolTreeProvider implements vscode.TreeDataProvider<ToolTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ToolTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tools: McpTool[] = [];
  private enabledTools: Set<string> = new Set();
  private items: ToolTreeItem[] = [];

  setTools(tools: McpTool[]): void {
    this.tools = tools;
    // Enable all tools by default
    for (const tool of tools) {
      if (!this.enabledTools.has(tool.name)) {
        this.enabledTools.add(tool.name);
      }
    }
    this.rebuildItems();
    this._onDidChangeTreeData.fire();
  }

  isToolEnabled(name: string): boolean {
    return this.enabledTools.has(name);
  }

  toggleTool(name: string): void {
    if (this.enabledTools.has(name)) {
      this.enabledTools.delete(name);
    } else {
      this.enabledTools.add(name);
    }
    this.rebuildItems();
    this._onDidChangeTreeData.fire();
  }

  private rebuildItems(): void {
    this.items = this.tools.map(
      (tool) => new ToolTreeItem(tool, this.enabledTools.has(tool.name)),
    );
  }

  getTreeItem(element: ToolTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): ToolTreeItem[] {
    return this.items;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/providers/toolTreeProvider.ts
git commit -m "feat: MCP tool tree view provider with enable/disable toggle"
```

---

## Task 10: Chat Webview Provider

**Files:**
- Create: `src/providers/chatViewProvider.ts`

- [ ] **Step 1: Create `src/providers/chatViewProvider.ts`**

```typescript
// src/providers/chatViewProvider.ts
import * as vscode from 'vscode';
import type { GatewayClient } from '../gateway/client';
import type { McpClient } from '../gateway/mcp';
import type { Conversation } from '../state/conversation';
import type {
  ChatTool,
  McpTool,
  ToolCall,
  ChatCompletionChunk,
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from '../types';
import { streamChatCompletion } from '../gateway/chat';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  private webviewView?: vscode.WebviewView;
  private pendingMessages: ExtensionToWebviewMessage[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly gateway: GatewayClient,
    private readonly mcp: McpClient,
    private readonly conversation: Conversation,
    private readonly getModel: () => string,
    private readonly getEnabledTools: () => McpTool[],
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
      ],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(
      (msg: WebviewToExtensionMessage) => this.handleWebviewMessage(msg),
    );

    // Flush any pending messages
    for (const msg of this.pendingMessages) {
      webviewView.webview.postMessage(msg);
    }
    this.pendingMessages = [];
  }

  sendToWebview(message: ExtensionToWebviewMessage): void {
    if (this.webviewView) {
      this.webviewView.webview.postMessage(message);
    } else {
      this.pendingMessages.push(message);
    }
  }

  private async handleWebviewMessage(msg: WebviewToExtensionMessage): Promise<void> {
    switch (msg.type) {
      case 'sendMessage':
        await this.handleSendMessage(msg.content);
        break;

      case 'newChat':
        this.conversation.clear();
        this.sendToWebview({ type: 'conversationCleared' });
        break;

      case 'selectModel':
        // Model selection is handled in webview state; nothing to persist here
        break;

      case 'testTool':
        await this.handleTestTool(msg.toolName, msg.args);
        break;

      case 'toggleTool':
        // Handled by extension.ts via tree view
        break;

      case 'inspectTool':
        // Tool details shown in webview from cached tools data
        break;
    }
  }

  private async handleSendMessage(content: string): Promise<void> {
    this.conversation.addUserMessage(content);

    const enabledTools = this.getEnabledTools();
    const chatTools: ChatTool[] = enabledTools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));

    await this.runCompletionLoop(chatTools);
  }

  private async runCompletionLoop(chatTools: ChatTool[]): Promise<void> {
    // Accumulate the streamed response
    let assistantContent = '';
    let toolCalls: ToolCall[] = [];
    const toolCallArgs: Map<number, string> = new Map();

    try {
      await streamChatCompletion(
        this.gateway,
        this.getModel(),
        this.conversation.messages,
        chatTools,
        (chunk: ChatCompletionChunk) => {
          const choice = chunk.choices[0];
          if (!choice) return;

          // Content delta
          if (choice.delta.content) {
            assistantContent += choice.delta.content;
            this.sendToWebview({
              type: 'streamChunk',
              content: choice.delta.content,
            });
          }

          // Tool call deltas
          if (choice.delta.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              if (tc.id) {
                // New tool call
                toolCalls.push({
                  id: tc.id,
                  type: 'function',
                  function: {
                    name: tc.function?.name ?? '',
                    arguments: '',
                  },
                });
                toolCallArgs.set(tc.index, '');
              }
              if (tc.function?.arguments) {
                const prev = toolCallArgs.get(tc.index) ?? '';
                toolCallArgs.set(tc.index, prev + tc.function.arguments);
              }
              if (tc.function?.name && toolCalls[tc.index]) {
                toolCalls[tc.index].function.name = tc.function.name;
              }
            }
          }

          // Finish
          if (choice.finish_reason === 'tool_calls') {
            // Finalize accumulated arguments
            for (const [index, args] of toolCallArgs) {
              if (toolCalls[index]) {
                toolCalls[index].function.arguments = args;
              }
            }
          }
        },
      );

      // Stream ended
      if (toolCalls.length > 0) {
        // Add assistant message with tool calls
        this.conversation.addAssistantToolCallMessage(toolCalls);

        // Execute each tool call
        for (const tc of toolCalls) {
          this.sendToWebview({ type: 'toolCallStart', toolCall: tc });

          try {
            const args = JSON.parse(tc.function.arguments);
            const result = await this.mcp.callTool(tc.function.name, args);
            this.conversation.addToolResultMessage(tc.id, result);
            this.sendToWebview({
              type: 'toolCallResult',
              toolCallId: tc.id,
              result,
            });
          } catch (e: any) {
            const errorMsg = `Error: ${e.message}`;
            this.conversation.addToolResultMessage(tc.id, errorMsg);
            this.sendToWebview({
              type: 'toolCallResult',
              toolCallId: tc.id,
              result: errorMsg,
            });
          }
        }

        // Re-run completion with tool results so LLM can respond
        await this.runCompletionLoop(chatTools);
      } else {
        // Regular text response -- finalize
        this.conversation.addAssistantMessage(assistantContent);
        this.sendToWebview({ type: 'streamEnd' });
      }
    } catch (e: any) {
      this.sendToWebview({ type: 'streamError', error: e.message });
    }
  }

  private async handleTestTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<void> {
    try {
      const result = await this.mcp.callTool(toolName, args);
      this.sendToWebview({ type: 'toolTestResult', result });
    } catch (e: any) {
      this.sendToWebview({ type: 'toolTestResult', result: '', error: e.message });
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'styles.css'),
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${styleUri}">
  <title>AgentGateway Chat</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/providers/chatViewProvider.ts
git commit -m "feat: chat webview provider with streaming and tool use loop"
```

---

## Task 11: Webview Chat UI

**Files:**
- Create: `src/webview/index.ts`
- Create: `src/webview/components/ChatPanel.ts`
- Create: `src/webview/components/MessageBubble.ts`
- Create: `src/webview/components/ToolCallCard.ts`
- Create: `src/webview/components/ModelSelector.ts`
- Create: `src/webview/styles.css`

- [ ] **Step 1: Create `src/webview/index.ts`**

```typescript
// src/webview/index.ts
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

// Declare VS Code API type
declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

render(html`<${App} />`, document.getElementById('root')!);
```

- [ ] **Step 2: Create `src/webview/components/ChatPanel.ts`**

```typescript
// src/webview/components/ChatPanel.ts
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

  // Auto-scroll to bottom on new messages
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
    // Auto-resize textarea
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
            <p>Send a message to start chatting through AgentGateway.</p>
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
          placeholder=${props.connected ? 'Send a message...' : 'Not connected to AgentGateway'}
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
```

- [ ] **Step 3: Create `src/webview/components/MessageBubble.ts`**

This component uses DOMPurify to sanitize all HTML rendered from markdown, preventing XSS.

```typescript
// src/webview/components/MessageBubble.ts
import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import htm from 'htm';
import { marked } from 'marked';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import type { UIMessage } from '../index';
import { ToolCallCard } from './ToolCallCard';

const html = htm.bind(h);

// Configure marked to use highlight.js
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

  // Sanitize all rendered HTML to prevent XSS
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
```

- [ ] **Step 4: Create `src/webview/components/ToolCallCard.ts`**

```typescript
// src/webview/components/ToolCallCard.ts
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
```

- [ ] **Step 5: Create `src/webview/components/ModelSelector.ts`**

```typescript
// src/webview/components/ModelSelector.ts
import { h } from 'preact';
import htm from 'htm';
import type { Model } from '../../types';

const html = htm.bind(h);

interface ModelSelectorProps {
  models: Model[];
  current: string;
  onSelect: (model: string) => void;
}

export function ModelSelector({ models, current, onSelect }: ModelSelectorProps) {
  return html`
    <select
      class="model-selector"
      value=${current}
      onChange=${(e: Event) => onSelect((e.target as HTMLSelectElement).value)}
    >
      ${models.length === 0 && html`
        <option value="">No models available</option>
      `}
      ${models.map((m) => html`
        <option key=${m.id} value=${m.id}>${m.id}</option>
      `)}
    </select>
  `;
}
```

- [ ] **Step 6: Create `src/webview/styles.css`**

```css
/* src/webview/styles.css */

:root {
  --bg: var(--vscode-editor-background);
  --fg: var(--vscode-editor-foreground);
  --border: var(--vscode-panel-border);
  --input-bg: var(--vscode-input-background);
  --input-fg: var(--vscode-input-foreground);
  --input-border: var(--vscode-input-border);
  --btn-bg: var(--vscode-button-background);
  --btn-fg: var(--vscode-button-foreground);
  --btn-hover: var(--vscode-button-hoverBackground);
  --user-bg: var(--vscode-textBlockQuote-background);
  --tool-bg: var(--vscode-editorWidget-background);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--fg);
  background: var(--bg);
  height: 100vh;
  overflow: hidden;
}

#root {
  height: 100%;
}

/* Chat panel layout */
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Header */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-selector {
  background: var(--input-bg);
  color: var(--input-fg);
  border: 1px solid var(--input-border);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  max-width: 200px;
}

.connection-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.connection-dot.connected { background: #4caf50; }
.connection-dot.disconnected { background: #f44336; }

.icon-btn {
  background: none;
  border: none;
  color: var(--fg);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.icon-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

/* Messages area */
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  opacity: 0.6;
  text-align: center;
  padding: 24px;
}

/* Message bubbles */
.message {
  max-width: 100%;
}

.message-label {
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 4px;
  opacity: 0.7;
}

.message-user .message-content {
  background: var(--user-bg);
  padding: 8px 12px;
  border-radius: 8px;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-assistant .message-content {
  padding: 4px 0;
  line-height: 1.5;
}

.message-assistant .message-content pre {
  background: var(--vscode-textCodeBlock-background);
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}

.message-assistant .message-content code {
  font-family: var(--vscode-editor-font-family);
  font-size: var(--vscode-editor-font-size);
}

.message-assistant .message-content p {
  margin: 4px 0;
}

/* Streaming cursor */
.cursor {
  display: inline-block;
  width: 6px;
  height: 14px;
  background: var(--fg);
  margin-left: 2px;
  animation: blink 0.8s infinite;
  vertical-align: text-bottom;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* Tool cards */
.tool-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  background: var(--tool-bg);
  cursor: pointer;
  font-size: 12px;
}

.tool-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-icon {
  font-size: 11px;
  font-weight: 700;
  font-family: var(--vscode-editor-font-family);
  opacity: 0.7;
}
.tool-name { font-weight: 600; }
.tool-label { font-weight: 600; opacity: 0.8; }
.tool-expand { margin-left: auto; opacity: 0.5; }

.tool-args,
.tool-result-content {
  margin-top: 8px;
  padding: 8px;
  background: var(--vscode-textCodeBlock-background);
  border-radius: 4px;
  font-family: var(--vscode-editor-font-family);
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}

/* Input area */
.input-area {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  background: var(--input-bg);
  color: var(--input-fg);
  border: 1px solid var(--input-border);
  border-radius: 6px;
  padding: 8px 12px;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  resize: none;
  line-height: 1.4;
  max-height: 150px;
  overflow-y: auto;
}

.chat-input:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
}

.chat-input:disabled {
  opacity: 0.5;
}

.send-btn {
  background: var(--btn-bg);
  color: var(--btn-fg);
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.send-btn:hover:not(:disabled) {
  background: var(--btn-hover);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

/* Tool test form */
.tool-test-form {
  border: 1px solid var(--border);
  border-radius: 6px;
  margin: 12px;
  overflow: hidden;
}

.tool-test-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--tool-bg);
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
}

.tool-test-body {
  padding: 12px;
}

.tool-test-desc {
  font-size: 12px;
  opacity: 0.7;
  margin-bottom: 12px;
}

.form-field {
  margin-bottom: 12px;
}

.form-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
}

.form-hint {
  font-weight: normal;
  opacity: 0.6;
  margin-left: 4px;
}

.form-input,
.form-select {
  width: 100%;
  background: var(--input-bg);
  color: var(--input-fg);
  border: 1px solid var(--input-border);
  border-radius: 4px;
  padding: 6px 8px;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
}

.form-checkbox {
  margin: 4px 0;
}

.tool-test-result {
  margin-top: 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
}

.tool-test-result.error {
  border-color: var(--vscode-errorForeground);
}

.tool-test-result-label {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  background: var(--tool-bg);
}

.tool-test-result pre {
  padding: 8px;
  font-family: var(--vscode-editor-font-family);
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}
```

- [ ] **Step 7: Build and verify no errors**

```bash
npm run compile
```

Expected: Both `dist/extension.js` and `dist/webview.js` built without errors.

- [ ] **Step 8: Commit**

```bash
git add src/webview/ src/providers/
git commit -m "feat: webview chat UI with Preact, streaming, and tool call cards"
```

---

## Task 12: Tool Test Form (Webview)

**Files:**
- Create: `src/webview/components/ToolTestForm.ts`

This component generates a form from a JSON schema, letting users test MCP tools directly.

- [ ] **Step 1: Create `src/webview/components/ToolTestForm.ts`**

```typescript
// src/webview/components/ToolTestForm.ts
import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import type { McpTool, JsonSchema } from '../../types';

const html = htm.bind(h);

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
};

interface ToolTestFormProps {
  tool: McpTool;
  testResult: { result: string; error?: string } | null;
}

export function ToolTestForm({ tool, testResult }: ToolTestFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [expanded, setExpanded] = useState(true);

  const properties = tool.inputSchema.properties ?? {};
  const required = new Set(tool.inputSchema.required ?? []);

  const handleSubmit = () => {
    const vscode = acquireVsCodeApi();
    vscode.postMessage({
      type: 'testTool',
      toolName: tool.name,
      args: values,
    });
  };

  const setValue = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  return html`
    <div class="tool-test-form">
      <div class="tool-test-header" onClick=${() => setExpanded(!expanded)}>
        <span class="tool-test-title">Test: ${tool.name}</span>
        <span>${expanded ? 'v' : '>'}</span>
      </div>
      ${expanded && html`
        <div class="tool-test-body">
          <p class="tool-test-desc">${tool.description}</p>
          ${Object.entries(properties).map(([key, schema]) => html`
            <div class="form-field" key=${key}>
              <label class="form-label">
                ${key}${required.has(key) ? ' *' : ''}
                ${schema.description ? html`<span class="form-hint">${schema.description}</span>` : null}
              </label>
              ${renderField(key, schema, values[key], setValue)}
            </div>
          `)}
          <button class="send-btn" onClick=${handleSubmit}>
            Execute
          </button>
          ${testResult && html`
            <div class="tool-test-result ${testResult.error ? 'error' : ''}">
              <div class="tool-test-result-label">${testResult.error ? 'Error' : 'Result'}</div>
              <pre>${testResult.error ?? testResult.result}</pre>
            </div>
          `}
        </div>
      `}
    </div>
  `;
}

function renderField(
  key: string,
  schema: JsonSchema,
  value: unknown,
  setValue: (key: string, value: unknown) => void,
) {
  if (schema.enum) {
    return html`
      <select
        class="form-select"
        value=${value ?? ''}
        onChange=${(e: Event) => setValue(key, (e.target as HTMLSelectElement).value)}
      >
        <option value="">Select...</option>
        ${schema.enum.map((opt: string) => html`
          <option key=${opt} value=${opt}>${opt}</option>
        `)}
      </select>
    `;
  }

  if (schema.type === 'boolean') {
    return html`
      <input
        type="checkbox"
        class="form-checkbox"
        checked=${!!value}
        onChange=${(e: Event) => setValue(key, (e.target as HTMLInputElement).checked)}
      />
    `;
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    return html`
      <input
        type="number"
        class="form-input"
        value=${value ?? ''}
        onInput=${(e: Event) => setValue(key, Number((e.target as HTMLInputElement).value))}
        placeholder=${schema.default != null ? `Default: ${schema.default}` : ''}
      />
    `;
  }

  // Default: string input
  return html`
    <input
      type="text"
      class="form-input"
      value=${value ?? ''}
      onInput=${(e: Event) => setValue(key, (e.target as HTMLInputElement).value)}
      placeholder=${schema.default != null ? `Default: ${schema.default}` : ''}
    />
  `;
}
```

- [ ] **Step 2: Build and verify**

```bash
npm run compile
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/webview/components/ToolTestForm.ts
git commit -m "feat: tool test form with JSON schema-generated fields"
```

---

## Task 13: Copy Webview CSS to dist

**Files:**
- Modify: `esbuild.mjs`

The CSS file needs to be copied to `dist/` so the webview can load it. Add a copy plugin or a simple post-build step.

- [ ] **Step 1: Update `esbuild.mjs` to copy CSS**

Replace the webview build section with:

```javascript
// Webview build (browser, IIFE)
const webviewBuild = {
  ...sharedOptions,
  entryPoints: ['src/webview/index.ts'],
  outfile: 'dist/webview.js',
  format: 'iife',
  platform: 'browser',
  loader: { '.css': 'copy' },
};
```

Actually, esbuild's copy loader won't work cleanly here. Instead, add a simple file copy after the build:

```javascript
import * as esbuild from 'esbuild';
import { copyFileSync } from 'fs';

const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

const sharedOptions = {
  bundle: true,
  minify: isProduction,
  sourcemap: !isProduction,
  logLevel: 'info',
};

// Extension host build (Node.js, CJS)
const extensionBuild = {
  ...sharedOptions,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  format: 'cjs',
  platform: 'node',
  external: ['vscode'],
};

// Webview build (browser, IIFE)
const webviewBuild = {
  ...sharedOptions,
  entryPoints: ['src/webview/index.ts'],
  outfile: 'dist/webview.js',
  format: 'iife',
  platform: 'browser',
};

function copyAssets() {
  copyFileSync('src/webview/styles.css', 'dist/styles.css');
}

if (isWatch) {
  const [extCtx, webCtx] = await Promise.all([
    esbuild.context(extensionBuild),
    esbuild.context(webviewBuild),
  ]);
  copyAssets();
  await Promise.all([extCtx.watch(), webCtx.watch()]);
  console.log('Watching for changes...');
} else {
  await Promise.all([
    esbuild.build(extensionBuild),
    esbuild.build(webviewBuild),
  ]);
  copyAssets();
}
```

- [ ] **Step 2: Build and verify CSS is in dist/**

```bash
npm run compile && ls dist/styles.css
```

Expected: `dist/styles.css` exists.

- [ ] **Step 3: Commit**

```bash
git add esbuild.mjs
git commit -m "fix: copy webview CSS to dist during build"
```

---

## Task 14: Vitest Config & Full Test Run

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: All tests pass (client: 4, models: 2, chat: 5, mcp: 2, conversation: 7 = 20 total).

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: add vitest config"
```

---

## Task 15: Manual Testing & Polish

**Files:**
- Modify: various files for any issues found

- [ ] **Step 1: Launch the extension in development mode**

```bash
code --extensionDevelopmentPath="$(pwd)"
```

Or press F5 in VS Code with this project open.

- [ ] **Step 2: Verify connection flow**

1. Open VS Code settings and set `agw.llmEndpoint` and `agw.mcpEndpoint` to point at a running AgentGateway
2. Check that the status bar shows "AGW: Connected" with a green dot
3. If no AgentGateway is running, verify it shows "AGW: Disconnected"

- [ ] **Step 3: Verify chat flow**

1. Open the AgentGateway sidebar
2. Verify the model selector populates with available models
3. Type a message and press Enter
4. Verify streaming response appears token by token
5. Click "New" to clear the conversation

- [ ] **Step 4: Verify MCP tool browser**

1. Check the MCP Tools tree view shows discovered tools
2. Click a tool to see its schema in the tooltip
3. Right-click a tool and select "Toggle Tool for Chat"
4. Verify the checkmark icon toggles

- [ ] **Step 5: Verify tool use in chat**

1. Enable at least one MCP tool
2. Send a message that would trigger tool use (e.g., "What's the weather in NYC?" if a weather tool is available)
3. Verify the tool call card appears inline
4. Verify the tool result card appears
5. Verify the assistant incorporates the result in its response

- [ ] **Step 6: Fix any issues found during testing**

Address bugs, adjust styles, fix edge cases.

- [ ] **Step 7: Commit all fixes**

```bash
git add -A
git commit -m "fix: polish and bug fixes from manual testing"
```

---

## Task 16: README & Package.json Final Updates

**Files:**
- Modify: `README.md`
- Modify: `package.json` (add toggle/inspect commands and context menus)

- [ ] **Step 1: Add toggle and inspect commands to `package.json`**

Add to `contributes.commands`:

```json
{
  "command": "agw.toggleTool",
  "title": "Toggle Tool for Chat",
  "category": "AgentGateway"
},
{
  "command": "agw.inspectTool",
  "title": "Inspect Tool",
  "category": "AgentGateway"
}
```

Add to `contributes.menus`:

```json
"view/item/context": [
  {
    "command": "agw.toggleTool",
    "when": "view == agw-tools"
  },
  {
    "command": "agw.inspectTool",
    "when": "view == agw-tools"
  }
]
```

- [ ] **Step 2: Update `README.md`**

```markdown
# AgentGateway for VS Code

AI chat and MCP tool browser for [AgentGateway](https://agentgateway.dev).

## Features

- **Streaming AI Chat** -- Chat with any LLM through AgentGateway's OpenAI-compatible API with real-time streaming responses
- **MCP Tool Browser** -- Discover, inspect, and test MCP tools federated through AgentGateway
- **Tool Use in Chat** -- The LLM can automatically invoke MCP tools during conversations and incorporate results
- **Model Switching** -- Discover and switch between available models on the fly

## Prerequisites

A running [AgentGateway](https://github.com/agentgateway/agentgateway) instance with:
- An LLM listener configured (e.g., port 8080)
- Optionally, an MCP listener configured (e.g., port 3000)

## Getting Started

1. Install the extension
2. Open VS Code Settings and configure:
   - `agw.llmEndpoint` -- URL of your AgentGateway LLM listener (default: `http://localhost:8080`)
   - `agw.mcpEndpoint` -- URL of your AgentGateway MCP listener (default: `http://localhost:3000`)
   - `agw.apiKey` -- API key if your gateway requires authentication
3. Click the AgentGateway icon in the Activity Bar
4. Start chatting

## Development

```bash
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

### Run Tests

```bash
npm test
```

## License

Apache-2.0
```

- [ ] **Step 3: Commit**

```bash
git add package.json README.md
git commit -m "docs: add README and finalize package.json commands"
```
