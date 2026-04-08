import * as vscode from 'vscode';
import type { AgwConfig, PromptTemplate } from './types';
import { GatewayClient } from './gateway/client';
import { McpClient } from './gateway/mcp';
import { A2aClient } from './gateway/a2a';
import { fetchModels } from './gateway/models';
import { Conversation, ConversationStore } from './state/conversation';
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
    modelPresets: cfg.get<{ id: string; provider?: string }[]>('modelPresets', []),
  };
}

const SYSTEM_PROMPT_KEY = 'agw.systemPrompt';
const PROMPT_TEMPLATES_KEY = 'agw.promptTemplates';

export function activate(context: vscode.ExtensionContext) {
  const config = getConfig();
  const gateway = new GatewayClient(config);
  const mcp = new McpClient(gateway);
  const a2a = new A2aClient(gateway);
  const conversation = new Conversation();
  const store = new ConversationStore(context.globalState);

  let models: Model[] = [];
  let tools: McpTool[] = [];
  let currentModel = config.defaultModel;
  let connected = false;

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  statusBarItem.command = 'agw.configure';
  statusBarItem.text = '$(plug) agw: Connecting...';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const toolTreeProvider = new ToolTreeProvider();
  const treeView = vscode.window.createTreeView('agw-tools', {
    treeDataProvider: toolTreeProvider,
  });
  context.subscriptions.push(treeView);

  const chatProvider = new ChatViewProvider(
    context.extensionUri,
    gateway,
    mcp,
    conversation,
    () => currentModel,
    () => tools.filter((t) => toolTreeProvider.isToolEnabled(t.name)),
    () => context.globalState.get<string>(SYSTEM_PROMPT_KEY, ''),
  );

  // --- Handler wiring ---

  chatProvider.setReconnectHandler(() => connectToGateway());

  chatProvider.setModelChangeHandler((model) => {
    currentModel = model;
    conversation.setModel(model);
  });

  chatProvider.setRefreshToolsHandler(async () => {
    try {
      tools = await mcp.listTools();
      toolTreeProvider.setTools(tools);
      chatProvider.sendToWebview({ type: 'toolsLoaded', tools });
    } catch (e: any) {
      chatProvider.sendToWebview({ type: 'toolTestResult', result: '', error: e.message });
    }
  });

  chatProvider.setConversationHandlers({
    onList: () => {
      const convos = store.list().map((c) => ({
        id: c.id,
        title: c.title,
        model: c.model,
        updatedAt: c.updatedAt,
        messageCount: c.messages.length,
      }));
      chatProvider.sendToWebview({ type: 'conversationList', conversations: convos });
    },
    onLoad: (id: string) => {
      const saved = store.get(id);
      if (saved) {
        conversation.loadFrom(saved);
        currentModel = saved.model || currentModel;
        chatProvider.sendToWebview({
          type: 'conversationLoaded',
          id: saved.id,
          messages: saved.messages,
          title: saved.title,
          model: saved.model,
        });
      }
    },
    onDelete: (id: string) => {
      store.delete(id);
      const convos = store.list().map((c) => ({
        id: c.id,
        title: c.title,
        model: c.model,
        updatedAt: c.updatedAt,
        messageCount: c.messages.length,
      }));
      chatProvider.sendToWebview({ type: 'conversationList', conversations: convos });
    },
    onSave: () => {
      conversation.setModel(currentModel);
      store.save(conversation);
    },
    onExport: () => {
      const msgs = conversation.messages;
      if (msgs.length === 0) return;
      let md = `# ${conversation.title || 'Chat Export'}\n\n`;
      md += `**Model:** ${conversation.model || currentModel}\n`;
      md += `**Date:** ${new Date().toISOString()}\n\n---\n\n`;
      for (const m of msgs) {
        if (m.role === 'system') {
          md += `> **System:** ${m.content}\n\n`;
        } else if (m.role === 'user') {
          md += `**You:** ${m.content}\n\n`;
        } else if (m.role === 'assistant') {
          if (m.tool_calls) {
            for (const tc of m.tool_calls) {
              md += `**Tool Call:** \`${tc.function.name}\`\n\`\`\`json\n${tc.function.arguments}\n\`\`\`\n\n`;
            }
          } else {
            md += `**Assistant:** ${m.content}\n\n`;
          }
        } else if (m.role === 'tool') {
          md += `**Tool Result:**\n\`\`\`\n${m.content}\n\`\`\`\n\n`;
        }
      }
      const doc = vscode.workspace.openTextDocument({ content: md, language: 'markdown' });
      doc.then((d) => vscode.window.showTextDocument(d));
    },
  });

  chatProvider.setSystemPromptHandler((prompt: string) => {
    context.globalState.update(SYSTEM_PROMPT_KEY, prompt);
  });

  chatProvider.setResourceHandlers({
    onList: async () => {
      try {
        const resources = await mcp.listResources();
        chatProvider.sendToWebview({ type: 'resourcesLoaded', resources });
      } catch (e: any) {
        chatProvider.sendToWebview({ type: 'resourcesLoaded', resources: [] });
      }
    },
    onRead: async (uri: string) => {
      try {
        const { content, mimeType } = await mcp.readResource(uri);
        chatProvider.sendToWebview({ type: 'resourceContent', uri, content, mimeType });
      } catch (e: any) {
        chatProvider.sendToWebview({ type: 'resourceContent', uri, content: `Error: ${e.message}` });
      }
    },
  });

  chatProvider.setPromptTemplateHandlers({
    onList: () => {
      const templates = context.globalState.get<PromptTemplate[]>(PROMPT_TEMPLATES_KEY, []);
      chatProvider.sendToWebview({ type: 'promptTemplatesLoaded', templates });
    },
    onSave: (template: PromptTemplate) => {
      const templates = context.globalState.get<PromptTemplate[]>(PROMPT_TEMPLATES_KEY, []);
      const idx = templates.findIndex((t) => t.id === template.id);
      if (idx >= 0) { templates[idx] = template; } else { templates.push(template); }
      context.globalState.update(PROMPT_TEMPLATES_KEY, templates);
      chatProvider.sendToWebview({ type: 'promptTemplatesLoaded', templates });
    },
    onDelete: (id: string) => {
      const templates = context.globalState.get<PromptTemplate[]>(PROMPT_TEMPLATES_KEY, []).filter((t) => t.id !== id);
      context.globalState.update(PROMPT_TEMPLATES_KEY, templates);
      chatProvider.sendToWebview({ type: 'promptTemplatesLoaded', templates });
    },
  });

  chatProvider.setA2aHandlers({
    onFetchCard: async () => {
      try {
        const card = await a2a.fetchAgentCard();
        chatProvider.sendToWebview({
          type: 'a2aAgentCard',
          card: { name: card.name, description: card.description, url: card.url, skills: card.skills },
        });
      } catch (e: any) {
        chatProvider.sendToWebview({ type: 'a2aAgentCard', card: null, error: e.message });
      }
    },
    onSendTask: async (message: string, skillId?: string) => {
      try {
        const result = await a2a.sendTask(message, skillId);
        const text = result.artifacts?.map((a) =>
          a.parts.map((p) => p.text ?? '').join('')
        ).join('\n') ?? result.status?.message?.parts.map((p) => p.text ?? '').join('') ?? JSON.stringify(result, null, 2);
        chatProvider.sendToWebview({ type: 'a2aTaskResult', result: text });
      } catch (e: any) {
        chatProvider.sendToWebview({ type: 'a2aTaskResult', result: '', error: e.message });
      }
    },
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('agw-chat', chatProvider),
  );

  // --- Connection ---

  async function connectToGateway() {
    statusBarItem.text = '$(sync~spin) agw: Connecting...';

    const healthy = await gateway.checkHealth();
    if (!healthy) {
      statusBarItem.text = '$(error) agw: Disconnected';
      statusBarItem.tooltip = 'agentgateway is not reachable. Click to configure.';
      connected = false;
      chatProvider.sendToWebview({ type: 'connectionStatus', connected: false });
      return;
    }

    connected = true;
    statusBarItem.text = '$(check) agw: Connected';
    statusBarItem.tooltip = `LLM: ${config.llmEndpoint}\nMCP: ${config.mcpEndpoint}`;
    chatProvider.sendToWebview({ type: 'connectionStatus', connected: true });

    models = await fetchModels(gateway);
    // Add preset models from settings
    for (const preset of config.modelPresets) {
      if (!models.find((m) => m.id === preset.id)) {
        models.push({ id: preset.id, object: 'model', owned_by: preset.provider ?? 'preset' });
      }
    }
    if (!currentModel && models.length > 0) {
      currentModel = models[0].id;
    }
    if (models.length === 0 && currentModel) {
      models = [{ id: currentModel, object: 'model', owned_by: 'configured' }];
    }
    chatProvider.sendToWebview({
      type: 'modelsLoaded',
      models,
      current: currentModel,
    });

    try {
      tools = await mcp.connect();
      toolTreeProvider.setTools(tools);
      chatProvider.sendToWebview({ type: 'toolsLoaded', tools });
    } catch (e) {
      tools = [];
      toolTreeProvider.setTools([]);
    }

    // Send system prompt to webview
    const sp = context.globalState.get<string>(SYSTEM_PROMPT_KEY, '');
    chatProvider.sendToWebview({ type: 'systemPromptLoaded', prompt: sp });

    // Send prompt templates to webview
    const templates = context.globalState.get<PromptTemplate[]>(PROMPT_TEMPLATES_KEY, []);
    chatProvider.sendToWebview({ type: 'promptTemplatesLoaded', templates });
  }

  // --- Commands ---

  context.subscriptions.push(
    vscode.commands.registerCommand('agw.openChat', () => {
      vscode.commands.executeCommand('agw-chat.focus');
    }),

    vscode.commands.registerCommand('agw.sendToChat', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const selection = editor.selection;
      const code = editor.document.getText(selection.isEmpty ? undefined : selection);
      const fileName = editor.document.fileName.split('/').pop() ?? '';
      const language = editor.document.languageId;
      vscode.commands.executeCommand('agw-chat.focus');
      chatProvider.sendToWebview({ type: 'codeContext', code, fileName, language });
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

  connectToGateway();
}

export function deactivate() {}
