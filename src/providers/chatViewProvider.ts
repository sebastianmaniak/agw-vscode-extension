import * as vscode from 'vscode';
import type { GatewayClient } from '../gateway/client';
import type { McpClient } from '../gateway/mcp';
import type { Conversation } from '../state/conversation';
import type {
  ChatTool,
  McpTool,
  ToolCall,
  PromptTemplate,
  ChatCompletionChunk,
  TokenUsage,
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
  A2aAgentCardInfo,
} from '../types';
import { streamChatCompletion } from '../gateway/chat';

interface ConversationHandlers {
  onList: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onSave: () => void;
  onExport: () => void;
}

interface ResourceHandlers {
  onList: () => void;
  onRead: (uri: string) => void;
}

interface PromptTemplateHandlers {
  onList: () => void;
  onSave: (template: PromptTemplate) => void;
  onDelete: (id: string) => void;
}

interface A2aHandlers {
  onFetchCard: () => void;
  onSendTask: (message: string, skillId?: string) => void;
}

export class ChatViewProvider implements vscode.WebviewViewProvider {
  private webviewView?: vscode.WebviewView;
  private pendingMessages: ExtensionToWebviewMessage[] = [];
  private onReconnect?: () => void;
  private onModelChange?: (model: string) => void;
  private onRefreshTools?: () => void;
  private onSetSystemPrompt?: (prompt: string) => void;
  private onSwitchGateway?: (name: string) => void;
  private conversationHandlers?: ConversationHandlers;
  private resourceHandlers?: ResourceHandlers;
  private promptTemplateHandlers?: PromptTemplateHandlers;
  private a2aHandlers?: A2aHandlers;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly gateway: GatewayClient,
    private readonly mcp: McpClient,
    private readonly conversation: Conversation,
    private readonly getModel: () => string,
    private readonly getEnabledTools: () => McpTool[],
    private readonly getSystemPrompt: () => string,
  ) {}

  setReconnectHandler(handler: () => void): void { this.onReconnect = handler; }
  setModelChangeHandler(handler: (model: string) => void): void { this.onModelChange = handler; }
  setRefreshToolsHandler(handler: () => void): void { this.onRefreshTools = handler; }
  setSystemPromptHandler(handler: (prompt: string) => void): void { this.onSetSystemPrompt = handler; }
  setGatewayHandler(handler: (name: string) => void): void { this.onSwitchGateway = handler; }
  setConversationHandlers(handlers: ConversationHandlers): void { this.conversationHandlers = handlers; }
  setResourceHandlers(handlers: ResourceHandlers): void { this.resourceHandlers = handlers; }
  setPromptTemplateHandlers(handlers: PromptTemplateHandlers): void { this.promptTemplateHandlers = handlers; }
  setA2aHandlers(handlers: A2aHandlers): void { this.a2aHandlers = handlers; }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
      ],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (msg: WebviewToExtensionMessage) => this.handleWebviewMessage(msg),
    );

    for (const msg of this.pendingMessages) {
      webviewView.webview.postMessage(msg);
    }
    this.pendingMessages = [];
  }

  sendToWebview(message: ExtensionToWebviewMessage): void {
    if (this.webviewView) {
      this.webviewView.webview.postMessage(message);
    } else {
      this.pendingMessages.push(message);
    }
  }

  private async handleWebviewMessage(msg: WebviewToExtensionMessage): Promise<void> {
    switch (msg.type) {
      case 'sendMessage':
        await this.handleSendMessage(msg.content);
        break;
      case 'newChat':
        this.conversationHandlers?.onSave();
        this.conversation.clear();
        this.sendToWebview({ type: 'conversationCleared' });
        break;
      case 'selectModel':
        this.onModelChange?.(msg.model);
        break;
      case 'testTool':
        await this.handleTestTool(msg.toolName, msg.args);
        break;
      case 'toggleTool':
        break;
      case 'inspectTool':
        break;
      case 'reconnect':
        this.onReconnect?.();
        break;
      case 'refreshTools':
        this.onRefreshTools?.();
        break;
      case 'listConversations':
        this.conversationHandlers?.onList();
        break;
      case 'loadConversation':
        this.conversationHandlers?.onLoad(msg.id);
        break;
      case 'deleteConversation':
        this.conversationHandlers?.onDelete(msg.id);
        break;
      case 'exportChat':
        this.conversationHandlers?.onExport();
        break;
      case 'setSystemPrompt':
        this.onSetSystemPrompt?.(msg.prompt);
        break;
      case 'getSystemPrompt':
        this.sendToWebview({ type: 'systemPromptLoaded', prompt: this.getSystemPrompt() });
        break;
      case 'listResources':
        this.resourceHandlers?.onList();
        break;
      case 'readResource':
        this.resourceHandlers?.onRead(msg.uri);
        break;
      case 'listPromptTemplates':
        this.promptTemplateHandlers?.onList();
        break;
      case 'savePromptTemplate':
        this.promptTemplateHandlers?.onSave(msg.template);
        break;
      case 'deletePromptTemplate':
        this.promptTemplateHandlers?.onDelete(msg.id);
        break;
      case 'insertCodeAtCursor':
        this.insertCodeAtCursor(msg.code);
        break;
      case 'copyCode':
        vscode.env.clipboard.writeText(msg.code);
        break;
      case 'fetchA2aCard':
        this.a2aHandlers?.onFetchCard();
        break;
      case 'sendA2aTask':
        this.a2aHandlers?.onSendTask(msg.message, msg.skillId);
        break;
      case 'switchGateway':
        this.onSwitchGateway?.(msg.name);
        break;
      case 'addGateway':
        vscode.commands.executeCommand('workbench.action.openSettings', 'agw.gateways');
        break;
    }
  }

  private async handleSendMessage(content: string): Promise<void> {
    // Add system prompt if set
    const systemPrompt = this.getSystemPrompt();
    if (systemPrompt && this.conversation.messages.length === 0) {
      this.conversation.addUserMessage(content);
      // Prepend system message for the API call
    } else {
      this.conversation.addUserMessage(content);
    }

    const enabledTools = this.getEnabledTools();
    const chatTools: ChatTool[] = enabledTools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));

    await this.runCompletionLoop(chatTools);
    this.conversationHandlers?.onSave();
  }

  private async runCompletionLoop(chatTools: ChatTool[]): Promise<void> {
    let assistantContent = '';
    let toolCalls: ToolCall[] = [];
    const toolCallArgs: Map<number, string> = new Map();
    let responseModel = '';
    let usage: TokenUsage | undefined;

    // Build messages with system prompt prepended
    const systemPrompt = this.getSystemPrompt();
    const messages = [...this.conversation.messages];
    if (systemPrompt) {
      messages.unshift({ role: 'system', content: systemPrompt });
    }

    try {
      await streamChatCompletion(
        this.gateway,
        this.getModel(),
        messages,
        chatTools,
        (chunk: ChatCompletionChunk) => {
          if (chunk.model) { responseModel = chunk.model; }
          if (chunk.usage) { usage = chunk.usage; }
          const choice = chunk.choices[0];
          if (!choice) return;

          if (choice.delta.content) {
            assistantContent += choice.delta.content;
            this.sendToWebview({
              type: 'streamChunk',
              content: choice.delta.content,
            });
          }

          if (choice.delta.tool_calls) {
            for (const tc of choice.delta.tool_calls) {
              if (tc.id) {
                toolCalls.push({
                  id: tc.id,
                  type: 'function',
                  function: {
                    name: tc.function?.name ?? '',
                    arguments: '',
                  },
                });
                toolCallArgs.set(tc.index, '');
              }
              if (tc.function?.arguments) {
                const prev = toolCallArgs.get(tc.index) ?? '';
                toolCallArgs.set(tc.index, prev + tc.function.arguments);
              }
              if (tc.function?.name && toolCalls[tc.index]) {
                toolCalls[tc.index].function.name = tc.function.name;
              }
            }
          }

          if (choice.finish_reason === 'tool_calls') {
            for (const [index, args] of toolCallArgs) {
              if (toolCalls[index]) {
                toolCalls[index].function.arguments = args;
              }
            }
          }
        },
      );

      if (toolCalls.length > 0) {
        this.conversation.addAssistantToolCallMessage(toolCalls);

        for (const tc of toolCalls) {
          this.sendToWebview({ type: 'toolCallStart', toolCall: tc });

          try {
            const args = JSON.parse(tc.function.arguments);
            const result = await this.mcp.callTool(tc.function.name, args);
            this.conversation.addToolResultMessage(tc.id, result);
            this.sendToWebview({
              type: 'toolCallResult',
              toolCallId: tc.id,
              result,
            });
          } catch (e: any) {
            const errorMsg = `Error: ${e.message}`;
            this.conversation.addToolResultMessage(tc.id, errorMsg);
            this.sendToWebview({
              type: 'toolCallResult',
              toolCallId: tc.id,
              result: errorMsg,
            });
          }
        }

        await this.runCompletionLoop(chatTools);
      } else {
        this.conversation.addAssistantMessage(assistantContent);
        this.sendToWebview({ type: 'streamEnd', responseModel, usage });
      }
    } catch (e: any) {
      this.sendToWebview({ type: 'streamError', error: e.message });
    }
  }

  private async handleTestTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<void> {
    try {
      const result = await this.mcp.callTool(toolName, args);
      this.sendToWebview({ type: 'toolTestResult', result });
    } catch (e: any) {
      this.sendToWebview({ type: 'toolTestResult', result: '', error: e.message });
    }
  }

  private insertCodeAtCursor(code: string): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor to insert code into');
      return;
    }
    editor.edit((editBuilder) => {
      if (editor.selection.isEmpty) {
        editBuilder.insert(editor.selection.active, code);
      } else {
        editBuilder.replace(editor.selection, code);
      }
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'styles.css'),
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${styleUri}">
  <title>agentgateway Chat</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
