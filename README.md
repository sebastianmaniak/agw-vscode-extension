<p align="center">
  <img src="resources/agw-icon.png" alt="agentgateway logo" width="120">
</p>

<h1 align="center">agentgateway for VS Code</h1>

<p align="center">
  <strong>The developer interface for <a href="https://agentgateway.dev">agentgateway</a></strong><br>
  Chat with any LLM. Test MCP tools. Browse resources. Run A2A agents.<br>
  All from your editor sidebar.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/built%20by-SebbyCorp-blueviolet" alt="Built by SebbyCorp">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License"></a>
  <img src="https://img.shields.io/badge/VS%20Code-1.85%2B-007ACC" alt="VS Code">
  <img src="https://img.shields.io/badge/Cursor-compatible-green" alt="Cursor">
</p>

---

## Why?

**[agentgateway](https://github.com/agentgateway/agentgateway)** is an open-source AI agent communication proxy — routing to any LLM provider, orchestrating MCP tools, and enabling agent-to-agent collaboration.

**This extension brings all of that into your editor.** Instead of switching between terminals, curl commands, and web UIs to test your gateway setup, you get a native VS Code experience with streaming chat, interactive tool testing, and live resource browsing.

**One extension. Every provider. Every tool. Every agent.**

---

## Highlights

**Talk to any LLM** — OpenAI, Anthropic, Google, Mistral, local models — whatever your gateway routes to. Stream responses in real time with full markdown rendering and syntax highlighting.

**Test MCP tools without writing code** — The playground auto-generates forms from tool schemas. Fill in parameters, hit execute, see results. No curl, no scripts.

**Switch gateways instantly** — Dev, staging, production — configure multiple agentgateway instances and switch between them from the chat toolbar. No restart needed.

**Track what you spend** — Per-message and per-conversation token counts, right in the chat. Know exactly how many tokens each interaction costs.

**Send code to chat** — Select code in your editor, hit `Cmd+L`, and it appears as a dismissible context chip in the chat. Ask the LLM about it, get explanations, request changes.

**Agentic tool loops** — The LLM doesn't just respond — it can invoke MCP tools, get results, and continue reasoning. Full agentic loop, visible in the chat with collapsible tool call cards.

---

## Features at a Glance

![Uploading agw-vscode.gif…]()


### Chat
| | |
|---|---|
| **Streaming responses** | Real-time SSE streaming with markdown + code highlighting |
| **Agentic tool use** | LLM invokes MCP tools automatically during conversation |
| **Token tracking** | Per-message badges + session totals in the status bar |
| **Conversation history** | Auto-save, browse, resume, delete past chats |
| **System prompt** | Persistent system prompt for every conversation |
| **Prompt templates** | Save and reuse common prompts |
| **Code context** | `Cmd+L` sends editor selections as dismissible chips |
| **Chat export** | Export conversations as markdown |

### Tools & Resources
| | |
|---|---|
| **MCP Playground** | Browse tools, auto-generated test forms, execute and inspect results |
| **Resource Browser** | List and read MCP resources with content preview |
| **A2A Testing** | Fetch agent cards, view skills, send tasks via Agent-to-Agent protocol |

### Configuration
| | |
|---|---|
| **Multi-gateway profiles** | Switch between dev/staging/prod gateways from the toolbar |
| **Editable model selector** | Type any model name or pick from history |
| **Model presets** | Pre-configure models with provider labels |
| **Auto-connect** | Detects gateway on launch, reconnect with one click |

---

<p align="center">
  <img src="agw-vscode.gif" alt="agentgateway for VS Code demo" width="800">
</p>

---

## Quick Start

### 1. Start agentgateway

```bash
# Local
agentgateway -f agw-config.yaml

# Or via Kubernetes
kubectl port-forward svc/agentgateway 8080:8080 -n <namespace>
```

### 2. Install the Extension

```bash
git clone https://github.com/sebastianmaniak/agw-vscode-extension.git
cd agw-vscode-extension
npm install && npm run compile
npx @vscode/vsce package --no-dependencies --allow-missing-repository
code --install-extension agw-vscode-0.2.0.vsix
```

### 3. Configure

Open **Settings** (`Cmd+,`) and search for `agw`:

```jsonc
{
  "agw.llmEndpoint": "http://localhost:8080/openai",
  "agw.mcpEndpoint": "http://localhost:8080/mcp",
  "agw.apiKey": "your-api-key",       // optional
  "agw.defaultModel": "gpt-4o"        // optional
}
```

### 4. Go

Click the **agentgateway** icon in the Activity Bar. Start chatting.

---

## Multi-Gateway Profiles

Running multiple gateways? Configure them all and switch instantly:

```jsonc
{
  // Default gateway (always available)
  "agw.llmEndpoint": "http://localhost:8080/openai",
  "agw.mcpEndpoint": "http://localhost:8080/mcp",

  // Additional gateways
  "agw.gateways": [
    {
      "name": "Production",
      "llmEndpoint": "https://prod-gw.example.com/openai",
      "mcpEndpoint": "https://prod-gw.example.com/mcp",
      "apiKey": "prod-key"
    },
    {
      "name": "Anthropic",
      "llmEndpoint": "http://localhost:8080/anthropic",
      "mcpEndpoint": "http://localhost:8080/mcp"
    }
  ]
}
```

A gateway dropdown appears in the input toolbar. Switching reconnects automatically — new models, new tools, zero friction.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+L` / `Ctrl+L` | Send selected code to chat |
| `Enter` | Send message |
| `Shift+Enter` | New line in message |

---

## Development

```bash
npm run watch        # Auto-rebuild on changes
npm run check-types  # Type checking
npm test             # Run tests
npm run test:watch   # Watch mode
```

Press **F5** to launch an Extension Development Host with the extension loaded.

<details>
<summary><strong>Project Structure</strong></summary>

```
src/
├── extension.ts                # Entry point, activation, handler wiring
├── types.ts                    # Shared types (config, API, messages)
├── gateway/
│   ├── client.ts               # HTTP client with health check fallback
│   ├── chat.ts                 # SSE streaming + token usage capture
│   ├── models.ts               # Model listing with graceful fallback
│   ├── mcp.ts                  # MCP JSON-RPC over Streamable HTTP
│   └── a2a.ts                  # A2A protocol (agent cards + tasks)
├── state/
│   └── conversation.ts         # Chat history + globalState persistence
├── providers/
│   ├── chatViewProvider.ts     # Webview provider + agentic completion loop
│   └── toolTreeProvider.ts     # Sidebar tree view for MCP tools
└── webview/
    ├── index.ts                # Preact app (4 tabs + overlay system)
    ├── styles.css              # VS Code theme-aware styles
    └── components/
        ├── ChatPanel.ts        # Cursor-style input bar + action menu
        ├── MessageBubble.ts    # Markdown rendering + Copy/Insert actions
        ├── McpPlayground.ts    # Tool testing with dynamic forms
        ├── ResourceBrowser.ts  # MCP resource viewer
        ├── A2aPlayground.ts    # A2A agent card + task sender
        ├── ConversationList.ts # History browser
        ├── SystemPromptEditor.ts
        ├── PromptTemplates.ts
        └── ToolCallCard.ts     # Collapsible tool call/result cards
```

</details>

---

## Compatibility

| Editor | Support |
|--------|---------|
| **VS Code** | 1.85+ |
| **Cursor** | Full |
| **Windsurf** | Full |

Install via `.vsix` in any VS Code-compatible editor.

---

<p align="center">
  Built by <strong>SebbyCorp</strong> · <a href="https://agentgateway.dev">agentgateway.dev</a> · <a href="LICENSE">Apache-2.0</a>
</p>
