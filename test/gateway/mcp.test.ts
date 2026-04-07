import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpClient } from '../../src/gateway/mcp';
import { GatewayClient } from '../../src/gateway/client';

function makeGatewayClient() {
  return new GatewayClient({
    llmEndpoint: 'http://localhost:8080',
    mcpEndpoint: 'http://localhost:3000',
    apiKey: '',
    defaultModel: '',
  });
}

describe('McpClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize + listTools', () => {
    it('sends initialize then tools/list and returns tools', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, opts: any) => {
        const body = JSON.parse(opts.body);

        if (body.method === 'initialize') {
          return {
            ok: true,
            headers: new Headers({ 'mcp-session-id': 'sess-123' }),
            json: () => Promise.resolve({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                protocolVersion: '2025-03-26',
                capabilities: { tools: {} },
                serverInfo: { name: 'agentgateway', version: '0.1.0' },
              },
            }),
          };
        }

        if (body.method === 'notifications/initialized') {
          return {
            ok: true,
            headers: new Headers({ 'mcp-session-id': 'sess-123' }),
            json: () => Promise.resolve({}),
          };
        }

        if (body.method === 'tools/list') {
          return {
            ok: true,
            headers: new Headers({ 'mcp-session-id': 'sess-123' }),
            json: () => Promise.resolve({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                tools: [
                  {
                    name: 'get_weather',
                    description: 'Get current weather',
                    inputSchema: {
                      type: 'object',
                      properties: { city: { type: 'string' } },
                      required: ['city'],
                    },
                  },
                  {
                    name: 'search_docs',
                    description: 'Search documentation',
                    inputSchema: {
                      type: 'object',
                      properties: { query: { type: 'string' } },
                      required: ['query'],
                    },
                  },
                ],
              },
            }),
          };
        }

        return { ok: true, json: () => Promise.resolve({}) };
      }));

      const gateway = makeGatewayClient();
      const mcp = new McpClient(gateway);
      const tools = await mcp.connect();

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('get_weather');
      expect(tools[1].name).toBe('search_docs');
    });
  });

  describe('callTool', () => {
    it('sends tools/call and returns result', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, opts: any) => {
        const body = JSON.parse(opts.body);

        if (body.method === 'initialize') {
          return {
            ok: true,
            headers: new Headers({ 'mcp-session-id': 'sess-123' }),
            json: () => Promise.resolve({
              jsonrpc: '2.0', id: body.id,
              result: { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'test' } },
            }),
          };
        }

        if (body.method === 'notifications/initialized') {
          return { ok: true, headers: new Headers({}), json: () => Promise.resolve({}) };
        }

        if (body.method === 'tools/list') {
          return {
            ok: true,
            headers: new Headers({ 'mcp-session-id': 'sess-123' }),
            json: () => Promise.resolve({
              jsonrpc: '2.0', id: body.id,
              result: { tools: [{ name: 'get_weather', description: 'Weather', inputSchema: { type: 'object' } }] },
            }),
          };
        }

        if (body.method === 'tools/call') {
          expect(body.params.name).toBe('get_weather');
          expect(body.params.arguments).toEqual({ city: 'NYC' });
          return {
            ok: true,
            headers: new Headers({ 'mcp-session-id': 'sess-123' }),
            json: () => Promise.resolve({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                content: [{ type: 'text', text: '72F, sunny' }],
              },
            }),
          };
        }

        return { ok: true, headers: new Headers({}), json: () => Promise.resolve({}) };
      }));

      const gateway = makeGatewayClient();
      const mcp = new McpClient(gateway);
      await mcp.connect();

      const result = await mcp.callTool('get_weather', { city: 'NYC' });
      expect(result).toBe('72F, sunny');
    });
  });
});
