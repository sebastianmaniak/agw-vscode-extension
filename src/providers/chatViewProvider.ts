import * as vscode from 'vscode';
import type { GatewayClient } from '../gateway/client';
import type { McpClient } from '../gateway/mcp';
import type { Conversation } from '../state/conversation';
import type {
  ChatTool,
  McpTool,
  ToolCall,
  ChatCompletionChunk,
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from '../types';
import { streamChatCompletion } from '../gateway/chat';

export class ChatViewProvider implements vscode.WebviewViewProvider {
  private webviewView?: vscode.WebviewView;
  private pendingMessages: ExtensionToWebviewMessage[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly gateway: GatewayClient,
    private readonly mcp: McpClient,
    private readonly conversation: Conversation,
    private readonly getModel: () => string,
    private readonly getEnabledTools: () => McpTool[],
  ) {}

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
        this.conversation.clear();
        this.sendToWebview({ type: 'conversationCleared' });
        break;
      case 'selectModel':
        break;
      case 'testTool':
        await this.handleTestTool(msg.toolName, msg.args);
        break;
      case 'toggleTool':
        break;
      case 'inspectTool':
        break;
    }
  }

  private async handleSendMessage(content: string): Promise<void> {
    this.conversation.addUserMessage(content);

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
  }

  private async runCompletionLoop(chatTools: ChatTool[]): Promise<void> {
    let assistantContent = '';
    let toolCalls: ToolCall[] = [];
    const toolCallArgs: Map<number, string> = new Map();

    try {
      await streamChatCompletion(
        this.gateway,
        this.getModel(),
        this.conversation.messages,
        chatTools,
        (chunk: ChatCompletionChunk) => {
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
        this.sendToWebview({ type: 'streamEnd' });
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
  <title>AgentGateway Chat</title>
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
