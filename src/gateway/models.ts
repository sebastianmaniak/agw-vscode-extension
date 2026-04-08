import type { GatewayClient } from './client';
import type { Model, ModelsResponse } from '../types';

export async function fetchModels(client: GatewayClient): Promise<Model[]> {
  try {
    const res = await client.fetchJson<ModelsResponse>(
      `${client.llmEndpoint}/v1/models`
    );
    return res.data ?? [];
  } catch {
    // agentgateway may not support GET /v1/models — return empty
    return [];
  }
}
