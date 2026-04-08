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
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('agw-chat', chatProvider),
  );

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
    if (!currentModel && models.length > 0) {
      currentModel = models[0].id;
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
  }

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
