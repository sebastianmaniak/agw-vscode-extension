# AgentGateway VS Code Extension — Design Spec

## Overview

A VS Code extension that connects to a running AgentGateway instance, providing:
1. **Streaming AI chat** via AgentGateway's OpenAI-compatible API
2. **MCP tool browser** — discover, inspect, and test tools federated through the MCP gateway
3. **Tool use in chat** — the LLM can invoke MCP tools during conversations

Target user: anyone with a running AgentGateway instance. The UX should be approachable.

## Architecture

Three layers:

### Webview Panel (Chat UI)
- Rendered with Preact + HTM
- Markdown rendering via `marked`, code highlighting via `highlight.js`
- Streaming token display via SSE
- Inline tool call result cards
- Communicates with extension host via `postMessage`

### Tree View (MCP Tool Browser)
- Native VS Code tree view in the sidebar
- Shows tools grouped by MCP server
- Click to inspect, test, or toggle for chat

### Extension Host (Brain)
- AgentGateway API client
- Chat completions with streaming (SSE)
- MCP tool discovery and execution
- Conversation state management
- Connection management

```
┌──────────────────────────────────────────────────┐
│                   VS Code                         │
│                                                   │
│  ┌──────────────┐    ┌─────────────────────────┐ │
│  │  Tree View    │    │   Webview Panel          │ │
│  │  (MCP Tools)  │    │   (Chat UI)              │ │
│  └──────┬───────┘    └──────────┬──────────────┘ │
│         │     message passing    │                 │
│         └──────────┬─────────────┘                 │
│         ┌──────────▼───────────┐                   │
│         │   Extension Host      │                   │
│         └──────────┬───────────┘                   │
└──────────────────────────────────────────────────┘
                     │ HTTP/SSE
                     ▼
          ┌─────────────────────┐
          │   AgentGateway       │
          └─────────────────────┘
```

## Connection & Configuration

### VS Code Settings
- `agentgateway.endpoint` — URL of the AgentGateway instance (default: `http://localhost:15000`)
- `agentgateway.apiKey` — optional API key for authenticated gateways
- `agentgateway.defaultModel` — default LLM model for chat

### Connection Flow
1. On activation, read endpoint from settings
2. Health check call to AgentGateway
3. Status bar item shows connection state (connected/disconnected/error)
4. If not configured, welcome view with "Configure AgentGateway" button

### Model Discovery
- On connect, query `GET /v1/models`
- Populate model picker dropdown in chat UI
- User can switch models mid-conversation

## Chat UI & Streaming

### Layout
- **Top bar:** model selector dropdown, connection indicator, "New Chat" button
- **Message thread:** scrollable list of user/assistant messages
- **Input area:** multi-line text input, Enter to send, Shift+Enter for newline

### Message Rendering
- **User messages:** plain text, subtle background
- **Assistant messages:** markdown via `marked`, code blocks via `highlight.js`
- **Tool call messages:** collapsible card showing tool name, parameters, and result — inline in conversation
- **Streaming:** tokens append as they arrive via SSE, auto-scroll

### Streaming Implementation
1. Extension host calls `POST /v1/chat/completions` with `stream: true`
2. Parses SSE `data:` chunks
3. Forwards each delta to webview via `postMessage`
4. Webview appends tokens to active message

### Tool Use Flow in Chat
1. Send messages with `tools` array from discovered MCP tools
2. LLM responds with `tool_calls` — extension host executes against AgentGateway's MCP endpoint
3. Tool result appended as `tool` role message
4. Re-send conversation so LLM can incorporate result
5. Webview shows tool call + result as inline card

### Conversation State
- Full message history in extension host memory
- "New Chat" clears history
- No persistence across sessions for v1

## MCP Tool Browser

### Tree View (`agentgateway-tools`)
- Fetches tools from AgentGateway's MCP gateway on connect
- Grouped by MCP server:
  ```
  MCP Tools
  ├── server-1
  │   ├── tool-a (description)
  │   └── tool-b (description)
  └── server-2
      └── tool-c (description)
  ```
- Refresh button in title bar
- Per-tool toggle (checkmark icon) to enable/disable for chat

### Tool Inspection
- Click a tool to see: full description, input schema as parameter table, required vs optional params

### Tool Testing
- "Test Tool" button opens a form generated from JSON schema
- Text inputs, dropdowns for enums, checkboxes for booleans
- Execute sends tool call to AgentGateway, displays raw result
- "Send to Chat" copies tool + result into active conversation

## Tech Stack

- **Extension:** TypeScript, VS Code Extension API
- **Webview UI:** Preact + HTM
- **Markdown:** `marked` + `highlight.js`
- **HTTP/SSE:** Node.js native `fetch`, manual SSE parsing
- **Bundling:** esbuild

## Project Structure

```
agw-vscode-extension/
├── src/
│   ├── extension.ts              # activation, commands, registrations
│   ├── gateway/
│   │   ├── client.ts             # AgentGateway API client
│   │   ├── chat.ts               # chat completions + streaming
│   │   ├── tools.ts              # MCP tool discovery + execution
│   │   └── models.ts             # model listing
│   ├── providers/
│   │   ├── chatViewProvider.ts   # webview provider for chat panel
│   │   └── toolTreeProvider.ts   # tree data provider for MCP tools
│   ├── state/
│   │   └── conversation.ts       # conversation history management
│   └── types/
│       └── index.ts              # shared types
├── webview/
│   ├── chat.html                 # chat panel HTML shell
│   ├── chat.js                   # Preact chat UI logic
│   └── styles.css                # styles
├── package.json                  # extension manifest
├── tsconfig.json
├── esbuild.config.mjs
└── README.md
```

### package.json Contributions
- `viewsContainers`: sidebar container with AgentGateway icon
- `views`: `agentgateway-tools` tree view
- `commands`: Open Chat, Refresh Tools, Configure, Test Tool
- `configuration`: endpoint, apiKey, defaultModel
- `menus`: tree view context menu items

## Scope — v1

### In Scope
- Connect to a running AgentGateway instance
- Streaming chat via OpenAI-compatible API
- Model discovery and switching
- MCP tool browsing, inspection, and testing
- LLM tool use (function calling) in chat with inline result display
- Per-tool enable/disable for chat
- Connection status in status bar
- VS Code settings for endpoint, API key, default model

### Out of Scope (Future)
- Gateway lifecycle management (start/stop/install)
- A2A agent discovery and interaction
- Chat history persistence across sessions
- Multi-conversation tabs
- Config file editing / YAML authoring
- Inline code actions (apply code from chat to editor)
- AgentGateway config management
- Authentication beyond API key (OAuth, JWT)
