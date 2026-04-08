import type { GatewayClient } from './client';
import type { McpTool, McpResource, McpJsonRpcRequest, McpJsonRpcResponse } from '../types';

export class McpClient {
  private gateway: GatewayClient;
  private sessionId: string | null = null;
  private nextId = 1;

  constructor(gateway: GatewayClient) {
    this.gateway = gateway;
  }

  private async rpc(method: string, params?: Record<string, unknown>): Promise<McpJsonRpcResponse> {
    const request: McpJsonRpcRequest = {
      jsonrpc: '2.0',
      id: this.nextId++,
      method,
      ...(params ? { params } : {}),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const res = await fetch(this.gateway.mcpEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      throw new Error(`MCP RPC error: HTTP ${res.status}`);
    }

    const sid = res.headers.get('mcp-session-id');
    if (sid) {
      this.sessionId = sid;
    }

    const contentType = res.headers.get('content-type') ?? '';

    // If server responds with SSE, read the stream and extract the JSON-RPC response
    if (contentType.includes('text/event-stream')) {
      return this.readSseResponse(res);
    }

    return res.json() as Promise<McpJsonRpcResponse>;
  }

  private async readSseResponse(res: Response): Promise<McpJsonRpcResponse> {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lastData: McpJsonRpcResponse | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data) {
            try {
              lastData = JSON.parse(data);
            } catch {
              // skip non-JSON data lines
            }
          }
        }
      }
    }

    if (!lastData) {
      throw new Error('MCP SSE stream ended without a JSON-RPC response');
    }
    return lastData;
  }

  private async notify(method: string, params?: Record<string, unknown>): Promise<void> {
    const body: any = {
      jsonrpc: '2.0',
      method,
      ...(params ? { params } : {}),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    await fetch(this.gateway.mcpEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  async connect(): Promise<McpTool[]> {
    const initResult = await this.rpc('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'agw-vscode', version: '0.1.0' },
    });

    if (initResult.error) {
      throw new Error(`MCP initialize failed: ${initResult.error.message}`);
    }

    await this.notify('notifications/initialized');

    return this.listTools();
  }

  get isConnected(): boolean {
    return this.sessionId !== null;
  }

  async listTools(): Promise<McpTool[]> {
    if (!this.sessionId) {
      return this.connect();
    }
    const result = await this.rpc('tools/list');
    if (result.error) {
      throw new Error(`MCP tools/list failed: ${result.error.message}`);
    }
    const data = result.result as { tools: McpTool[] };
    return data.tools ?? [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.rpc('tools/call', { name, arguments: args });
    if (result.error) {
      throw new Error(`MCP tools/call failed: ${result.error.message}`);
    }
    const data = result.result as { content: Array<{ type: string; text?: string }> };
    return data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n');
  }

  async listResources(): Promise<McpResource[]> {
    if (!this.sessionId) {
      await this.connect();
    }
    const result = await this.rpc('resources/list');
    if (result.error) {
      throw new Error(`MCP resources/list failed: ${result.error.message}`);
    }
    const data = result.result as { resources: McpResource[] };
    return data.resources ?? [];
  }

  async readResource(uri: string): Promise<{ content: string; mimeType?: string }> {
    if (!this.sessionId) {
      await this.connect();
    }
    const result = await this.rpc('resources/read', { uri });
    if (result.error) {
      throw new Error(`MCP resources/read failed: ${result.error.message}`);
    }
    const data = result.result as { contents: Array<{ uri: string; text?: string; mimeType?: string; blob?: string }> };
    const first = data.contents?.[0];
    return {
      content: first?.text ?? (first?.blob ? atob(first.blob) : ''),
      mimeType: first?.mimeType,
    };
  }

  disconnect(): void {
    this.sessionId = null;
    this.nextId = 1;
  }
}
