# AgentGateway for VS Code

AI chat and MCP tool browser for [AgentGateway](https://agentgateway.dev).

## Features

- **Streaming AI Chat** - Chat with any LLM through AgentGateway's OpenAI-compatible API with real-time streaming responses
- **MCP Tool Browser** - Discover, inspect, and test MCP tools federated through AgentGateway
- **Tool Use in Chat** - The LLM can automatically invoke MCP tools during conversations and incorporate results
- **Model Switching** - Discover and switch between available models on the fly

## Prerequisites

A running [AgentGateway](https://github.com/agentgateway/agentgateway) instance with:
- An LLM listener configured (e.g., port 8080)
- Optionally, an MCP listener configured (e.g., port 3000)

## Getting Started

1. Install the extension
2. Open VS Code Settings and configure:
   - `agw.llmEndpoint` - URL of your AgentGateway LLM listener (default: `http://localhost:8080`)
   - `agw.mcpEndpoint` - URL of your AgentGateway MCP listener (default: `http://localhost:3000`)
   - `agw.apiKey` - API key if your gateway requires authentication
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
