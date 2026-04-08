# agentgateway for VS Code

AI chat and MCP tool playground for [agentgateway](https://agentgateway.dev).

## Features

- **Streaming AI Chat** — Chat with any LLM through agentgateway's OpenAI-compatible API with real-time streaming responses
- **MCP Playground** — Discover, inspect, and test MCP tools with a dynamic form UI (similar to agentgateway's built-in playground)
- **Tool Use in Chat** — The LLM can automatically invoke MCP tools during conversations and incorporate results
- **Editable Model Selector** — Type any model name or pick from history; your choice is persisted across sessions
- **Connection Management** — Connect/reconnect button with status indicator; works with local or remote (e.g., Kubernetes) agentgateway instances

## Prerequisites

A running [agentgateway](https://github.com/agentgateway/agentgateway) instance with:
- An LLM listener configured (OpenAI-compatible API)
- Optionally, an MCP listener configured (Streamable HTTP)

## Getting Started

1. Install the extension (see [Local Development](#local-development) below to build from source)
2. Open VS Code Settings (`Cmd+,` / `Ctrl+,`) and search for `agw`
3. Configure:
   - **`agw.llmEndpoint`** — URL of your agentgateway LLM listener (e.g., `http://localhost:8080/openai`)
   - **`agw.mcpEndpoint`** — URL of your agentgateway MCP listener (e.g., `http://localhost:8080/mcp`)
   - **`agw.apiKey`** — API key if your gateway requires authentication
   - **`agw.defaultModel`** — Default model name (optional; you can also type it directly in the chat)
4. Click the agentgateway icon in the Activity Bar
5. Click **Connect** in the chat header
6. Start chatting or switch to the **MCP Playground** tab to test tools

### Connecting to agentgateway

**Local instance:**
```bash
agentgateway -f agw-config.yaml
```

**Kubernetes (port-forward):**
```bash
kubectl port-forward svc/agentgateway 8080:8080 -n <namespace>
```

Then set your LLM endpoint to `http://localhost:8080/openai` (or whatever path your listener uses).

> **Note:** agentgateway does not expose a `/v1/models` listing endpoint. The model selector lets you type any model name — the gateway routes to the configured backend provider regardless of the model field.

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [VS Code](https://code.visualstudio.com/)

### Build from Source

```bash
# Clone the repo
git clone https://github.com/sebastianmaniak/agw-vscode-extension.git
cd agw-vscode-extension

# Install dependencies
npm install

# Build the extension
npm run compile
```

### Install Locally

Package the extension as a `.vsix` file and install it directly into VS Code:

```bash
# Package (requires @vscode/vsce)
npx @vscode/vsce package --no-dependencies --allow-missing-repository

# Install the .vsix into VS Code
code --install-extension agw-vscode-0.1.0.vsix
```

Then reload VS Code (`Cmd+Shift+P` → "Reload Window").

### Development Workflow

```bash
# Watch mode (auto-rebuild on changes)
npm run watch

# Type checking
npm run check-types

# Run tests
npm test
```

You can also press **F5** in VS Code to launch an Extension Development Host with the extension loaded.

### Project Structure

```
src/
├── extension.ts              # Extension entry point, activation, wiring
├── types.ts                  # Shared types (config, API, messages)
├── gateway/
│   ├── client.ts             # HTTP client for agentgateway
│   ├── chat.ts               # SSE streaming chat completions
│   ├── models.ts             # Model listing
│   └── mcp.ts                # MCP JSON-RPC client (Streamable HTTP)
├── state/
│   └── conversation.ts       # Chat message history
├── providers/
│   ├── chatViewProvider.ts   # Webview provider for chat + playground
│   └── toolTreeProvider.ts   # Tree view for MCP tools
└── webview/
    ├── index.ts              # Preact app with tabs (Chat / MCP Playground)
    ├── styles.css            # VS Code theme-aware styles
    └── components/
        ├── ChatPanel.ts      # Chat UI with messages and input
        ├── McpPlayground.ts  # MCP tool testing playground
        ├── MessageBubble.ts  # Rendered message with markdown
        ├── ModelSelector.ts  # Editable model combo box
        └── ToolCallCard.ts   # Collapsible tool call/result cards
```

## License

Apache-2.0
