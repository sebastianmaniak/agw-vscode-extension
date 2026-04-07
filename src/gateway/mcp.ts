import type { GatewayClient } from './client';
import type { McpTool, McpJsonRpcRequest, McpJsonRpcResponse } from '../types';

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
      'Accept': 'application/json',
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

    return res.json() as Promise<McpJsonRpcResponse>;
  }

  private async notify(method: string, params?: Record<string, unknown>): Promise<void> {
    const body: any = {
      jsonrpc: '2.0',
      method,
      ...(params ? { params } : {}),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
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

  async listTools(): Promise<McpTool[]> {
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

  disconnect(): void {
    this.sessionId = null;
    this.nextId = 1;
  }
}
