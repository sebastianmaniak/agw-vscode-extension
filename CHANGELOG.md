# Changelog

## 0.2.0

### Added
- **MCP Playground** — Discover, test, and execute MCP tools with dynamic forms and response display
- **MCP Resource Browser** — Browse and read MCP resources in a new Resources tab
- **Conversation History** — Auto-saves chats; browse, resume, and delete past conversations
- **System Prompt Editor** — Set a persistent system prompt prepended to every conversation
- **Prompt Templates** — Save and reuse common prompts with one-click insertion
- **Chat Export** — Export conversations as markdown files
- **Editable Model Selector** — Type any model name or pick from history; persists across sessions
- **Model Presets** — Configure model presets with provider labels in settings
- **Syntax Highlighting** — VS Code theme-aware code block highlighting in assistant messages
- **Connect/Reconnect Button** — Manual connection control with status indicator

### Fixed
- Health check now probes chat endpoint as fallback (works with k8s port-forward without admin port)
- MCP client sends proper `Accept: application/json, text/event-stream` header
- MCP client handles SSE responses from agentgateway
- Auto-reconnects MCP session when expired

## 0.1.0

### Added
- Initial release
- Streaming AI chat via agentgateway OpenAI-compatible API
- MCP tool discovery and execution
- Tool enable/disable toggles
- Model selection
- VS Code theme integration
