// --- Configuration ---

export interface ModelPreset {
  id: string;
  provider?: string;
}

export interface GatewayProfile {
  name: string;
  llmEndpoint: string;
  mcpEndpoint: string;
  apiKey?: string;
  defaultModel?: string;
}

export interface AgwConfig {
  llmEndpoint: string;
  mcpEndpoint: string;
  apiKey: string;
  defaultModel: string;
  modelPresets: ModelPreset[];
  gateways: GatewayProfile[];
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
  model?: string;
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

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
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

// --- Conversation history ---

export interface ConversationSummary {
  id: string;
  title: string;
  model: string;
  updatedAt: number;
  messageCount: number;
}

// --- Webview message types ---

export type ExtensionToWebviewMessage =
  | { type: 'streamChunk'; content: string }
  | { type: 'streamEnd'; responseModel?: string }
  | { type: 'streamError'; error: string }
  | { type: 'toolCallStart'; toolCall: ToolCall }
  | { type: 'toolCallResult'; toolCallId: string; result: string }
  | { type: 'modelsLoaded'; models: Model[]; current: string }
  | { type: 'connectionStatus'; connected: boolean }
  | { type: 'toolsLoaded'; tools: McpTool[] }
  | { type: 'toolTestResult'; result: string; error?: string }
  | { type: 'assistantMessage'; content: string }
  | { type: 'conversationCleared' }
  | { type: 'conversationList'; conversations: ConversationSummary[] }
  | { type: 'conversationLoaded'; id: string; messages: ChatMessage[]; title: string; model: string }
  | { type: 'resourcesLoaded'; resources: McpResource[] }
  | { type: 'resourceContent'; uri: string; content: string; mimeType?: string }
  | { type: 'systemPromptLoaded'; prompt: string }
  | { type: 'promptTemplatesLoaded'; templates: PromptTemplate[] }
  | { type: 'a2aAgentCard'; card: A2aAgentCardInfo | null; error?: string }
  | { type: 'a2aTaskResult'; result: string; error?: string }
  | { type: 'codeContext'; code: string; fileName: string; language: string }
  | { type: 'gatewaysLoaded'; gateways: GatewayProfile[]; active: string };

export interface A2aAgentCardInfo {
  name: string;
  description?: string;
  url: string;
  skills?: Array<{ id: string; name: string; description?: string }>;
}

export type WebviewToExtensionMessage =
  | { type: 'sendMessage'; content: string }
  | { type: 'newChat' }
  | { type: 'selectModel'; model: string }
  | { type: 'testTool'; toolName: string; args: Record<string, unknown> }
  | { type: 'toggleTool'; toolName: string; enabled: boolean }
  | { type: 'inspectTool'; toolName: string }
  | { type: 'reconnect' }
  | { type: 'refreshTools' }
  | { type: 'listConversations' }
  | { type: 'loadConversation'; id: string }
  | { type: 'deleteConversation'; id: string }
  | { type: 'exportChat' }
  | { type: 'setSystemPrompt'; prompt: string }
  | { type: 'getSystemPrompt' }
  | { type: 'listResources' }
  | { type: 'readResource'; uri: string }
  | { type: 'savePromptTemplate'; template: PromptTemplate }
  | { type: 'deletePromptTemplate'; id: string }
  | { type: 'listPromptTemplates' }
  | { type: 'insertCodeAtCursor'; code: string }
  | { type: 'copyCode'; code: string }
  | { type: 'fetchA2aCard' }
  | { type: 'sendA2aTask'; message: string; skillId?: string }
  | { type: 'switchGateway'; name: string };

// --- Prompt templates ---

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
}
