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
