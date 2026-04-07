import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GatewayClient } from '../../src/gateway/client';

describe('GatewayClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkHealth', () => {
    it('returns true when healthz endpoint responds 200', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('ready\n'),
      }));

      const client = new GatewayClient({
        llmEndpoint: 'http://localhost:8080',
        mcpEndpoint: 'http://localhost:3000',
        apiKey: '',
        defaultModel: '',
      });

      const result = await client.checkHealth();
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:15021/healthz/ready',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('returns false when healthz endpoint fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('not ready'),
      }));

      const client = new GatewayClient({
        llmEndpoint: 'http://localhost:8080',
        mcpEndpoint: 'http://localhost:3000',
        apiKey: '',
        defaultModel: '',
      });

      const result = await client.checkHealth();
      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

      const client = new GatewayClient({
        llmEndpoint: 'http://localhost:8080',
        mcpEndpoint: 'http://localhost:3000',
        apiKey: '',
        defaultModel: '',
      });

      const result = await client.checkHealth();
      expect(result).toBe(false);
    });
  });

  describe('headers', () => {
    it('includes Authorization header when apiKey is set', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      }));

      const client = new GatewayClient({
        llmEndpoint: 'http://localhost:8080',
        mcpEndpoint: 'http://localhost:3000',
        apiKey: 'test-key-123',
        defaultModel: '',
      });

      await client.fetchJson('http://localhost:8080/v1/models');
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/models',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key-123',
          }),
        })
      );
    });

    it('omits Authorization header when apiKey is empty', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      }));

      const client = new GatewayClient({
        llmEndpoint: 'http://localhost:8080',
        mcpEndpoint: 'http://localhost:3000',
        apiKey: '',
        defaultModel: '',
      });

      await client.fetchJson('http://localhost:8080/v1/models');
      const callHeaders = (fetch as any).mock.calls[0][1].headers;
      expect(callHeaders['Authorization']).toBeUndefined();
    });
  });
});
