import type { GatewayClient } from './client';

export interface A2aAgentCard {
  name: string;
  description?: string;
  url: string;
  capabilities?: Record<string, unknown>;
  skills?: A2aSkill[];
}

export interface A2aSkill {
  id: string;
  name: string;
  description?: string;
}

export interface A2aTaskResult {
  id: string;
  status: { state: string; message?: { parts: Array<{ text?: string }> } };
  artifacts?: Array<{ parts: Array<{ text?: string }> }>;
}

export class A2aClient {
  constructor(private gateway: GatewayClient) {}

  get endpoint(): string {
    // A2A endpoint can be the same as MCP or a separate one
    // Convention: /a2a path or separate listener
    return this.gateway.mcpEndpoint.replace(/\/mcp\/?$/, '/a2a');
  }

  async fetchAgentCard(): Promise<A2aAgentCard> {
    const url = `${this.endpoint}/.well-known/agent.json`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      throw new Error(`A2A agent card fetch failed: HTTP ${res.status}`);
    }
    return res.json() as Promise<A2aAgentCard>;
  }

  async sendTask(message: string, skillId?: string): Promise<A2aTaskResult> {
    const body: Record<string, unknown> = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'tasks/send',
      params: {
        id: crypto.randomUUID(),
        message: {
          role: 'user',
          parts: [{ text: message }],
        },
        ...(skillId ? { metadata: { skillId } } : {}),
      },
    };

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      throw new Error(`A2A task send failed: HTTP ${res.status}`);
    }

    const json = await res.json() as { result?: A2aTaskResult; error?: { message: string } };
    if (json.error) {
      throw new Error(`A2A error: ${json.error.message}`);
    }
    return json.result!;
  }
}
