<p align="center">
  <img src="resources/agw-icon.png" alt="agentgateway logo" width="128">
</p>

<h1 align="center">agentgateway for VS Code</h1>

<p align="center">
  AI chat, MCP tool playground, resource browser, and A2A agent testing for <a href="https://agentgateway.dev">agentgateway</a>.
</p>

## Features

- **Streaming AI Chat** — Chat with any LLM through agentgateway's OpenAI-compatible API with real-time streaming
- **MCP Playground** — Discover, inspect, and test MCP tools with dynamic forms, sample generation, and response display
- **MCP Resource Browser** — Browse and read MCP resources exposed through agentgateway
- **A2A Agent Testing** — Fetch agent cards, view skills, and send tasks via Google's Agent-to-Agent protocol
- **Conversation History** — Auto-saves chats; browse, resume, and delete past conversations
- **System Prompt** — Set a persistent system prompt prepended to every conversation
- **Prompt Templates** — Save and reuse common prompts with one-click insertion
- **Chat Export** — Export conversations as markdown files
- **Editable Model Selector** — Type any model name or pick from history; persists across sessions
- **Model Presets** — Configure model presets with provider labels in settings
- **Tool Use in Chat** — The LLM automatically invokes MCP tools during conversations (agentic loop)
- **Syntax Highlighting** — VS Code theme-aware code highlighting in assistant messages
- **Multi-Gateway Profiles** — Configure multiple agentgateway instances and switch between them
- **Code Context** — Send editor selections to chat with `Cmd+L`; shown as dismissible chips
- **Connection Management** — Connect/reconnect button; works with local or remote (k8s) instances

## Prerequisites

A running [agentgateway](https://github.com/agentgateway/agentgateway) instance with:
- An LLM listener configured (OpenAI-compatible API)
- Optionally, an MCP listener (Streamable HTTP) for tool discovery and execution
- Optionally, an A2A listener for agent-to-agent communication

## Getting Started

1. Install the extension (see [Local Development](#local-development) to build from source)
2. Open VS Code Settings (`Cmd+,` / `Ctrl+,`) and search for `agw`
3. Configure:
   - **`agw.llmEndpoint`** — URL of your agentgateway LLM listener (e.g., `http://localhost:8080/openai`)
   - **`agw.mcpEndpoint`** — URL of your agentgateway MCP listener (e.g., `http://localhost:8080/mcp`)
   - **`agw.apiKey`** — API key if your gateway requires authentication
   - **`agw.defaultModel`** — Default model name (optional; you can type it in the chat)
   - **`agw.modelPresets`** — Array of `{ "id": "model-name", "provider": "OpenAI" }` for quick model switching
   - **`agw.gateways`** — Array of additional gateway profiles (see below)
4. Click the agentgateway icon in the Activity Bar
5. Click **Connect** in the chat header
6. Start chatting, or explore the **Tools**, **Resources**, and **A2A** tabs

### Connecting to agentgateway

**Local instance:**
```bash
agentgateway -f agw-config.yaml
```

**Kubernetes (port-forward):**
```bash
kubectl port-forward svc/agentgateway 8080:8080 -n <namespace>
```

### Multiple Gateways

To switch between multiple agentgateway instances, add profiles in settings:

```json
"agw.gateways": [
  {
    "name": "Production",
    "llmEndpoint": "https://prod-gw.example.com:8080",
    "mcpEndpoint": "https://prod-gw.example.com:3000",
    "apiKey": "prod-key"
  },
  {
    "name": "Staging",
    "llmEndpoint": "http://staging:8080",
    "mcpEndpoint": "http://staging:3000"
  }
]
```

The default `agw.llmEndpoint` / `agw.mcpEndpoint` settings become the "Default" profile. A gateway dropdown appears in the input toolbar when multiple profiles are configured.

### Tabs

| Tab | Description |
|-----|-------------|
| **Chat** | AI chat with streaming, tool use, system prompt, templates, history |
| **Tools** | MCP tool playground — browse, test, execute with dynamic forms |
| **Resources** | MCP resource browser — list and read resources |
| **A2A** | Agent-to-Agent protocol — fetch agent cards, send tasks |

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [VS Code](https://code.visualstudio.com/)

### Build from Source

```bash
git clone https://github.com/sebastianmaniak/agw-vscode-extension.git
cd agw-vscode-extension
npm install
npm run compile
```

### Install Locally

```bash
npx @vscode/vsce package --no-dependencies --allow-missing-repository
code --install-extension agw-vscode-0.2.0.vsix
```

Then reload VS Code (`Cmd+Shift+P` → "Reload Window").

### Development Workflow

```bash
npm run watch      # Auto-rebuild on changes
npm run check-types # Type checking
npm test           # Run tests
npm run test:watch # Watch mode tests
```

Press **F5** in VS Code to launch an Extension Development Host.

### Project Structure

```
src/
├── extension.ts              # Extension entry, activation, handler wiring
├── types.ts                  # Shared types (config, API, messages, A2A)
├── gateway/
│   ├── client.ts             # HTTP client for agentgateway
│   ├── chat.ts               # SSE streaming chat completions
│   ├── models.ts             # Model listing
│   ├── mcp.ts                # MCP JSON-RPC client (Streamable HTTP)
│   └── a2a.ts                # A2A protocol client
├── state/
│   └── conversation.ts       # Chat history + persistence store
├── providers/
│   ├── chatViewProvider.ts   # Webview provider + completion loop
│   └── toolTreeProvider.ts   # Tree view for MCP tools
└── webview/
    ├── index.ts              # Preact app with 4 tabs + overlays
    ├── styles.css            # VS Code theme-aware styles
    └── components/
        ├── ChatPanel.ts      # Chat UI with Cursor-style input bar
        ├── McpPlayground.ts  # MCP tool testing
        ├── ResourceBrowser.ts # MCP resource viewer
        ├── A2aPlayground.ts  # A2A agent testing
        ├── ConversationList.ts # Chat history browser
        ├── SystemPromptEditor.ts # System prompt config
        ├── PromptTemplates.ts # Saved prompt templates
        ├── MessageBubble.ts  # Markdown message rendering
        └── ToolCallCard.ts   # Tool call/result cards
```

## Compatibility

This extension works with:
- **VS Code** (1.85+)
- **Cursor** (VS Code fork)
- **Windsurf** (VS Code fork)

Install via `.vsix` file in any VS Code-compatible editor.

## License

Apache-2.0
