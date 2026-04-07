import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchModels } from '../../src/gateway/models';
import { GatewayClient } from '../../src/gateway/client';

describe('fetchModels', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed model list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { id: 'gpt-4o', object: 'model', owned_by: 'openai' },
          { id: 'claude-sonnet-4-20250514', object: 'model', owned_by: 'anthropic' },
        ],
      }),
    }));

    const client = new GatewayClient({
      llmEndpoint: 'http://localhost:8080',
      mcpEndpoint: 'http://localhost:3000',
      apiKey: '',
      defaultModel: '',
    });

    const models = await fetchModels(client);
    expect(models).toHaveLength(2);
    expect(models[0].id).toBe('gpt-4o');
    expect(models[1].id).toBe('claude-sonnet-4-20250514');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/v1/models',
      expect.any(Object)
    );
  });

  it('returns empty array on error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

    const client = new GatewayClient({
      llmEndpoint: 'http://localhost:8080',
      mcpEndpoint: 'http://localhost:3000',
      apiKey: '',
      defaultModel: '',
    });

    const models = await fetchModels(client);
    expect(models).toEqual([]);
  });
});
