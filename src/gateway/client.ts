import type { AgwConfig } from '../types';

export class GatewayClient {
  private config: AgwConfig;

  constructor(config: AgwConfig) {
    this.config = config;
  }

  updateConfig(config: AgwConfig): void {
    this.config = config;
  }

  get llmEndpoint(): string {
    return this.config.llmEndpoint.replace(/\/+$/, '');
  }

  get mcpEndpoint(): string {
    return this.config.mcpEndpoint.replace(/\/+$/, '');
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      h['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return h;
  }

  private get healthUrl(): string {
    const url = new URL(this.config.llmEndpoint);
    url.port = '15021';
    url.pathname = '/healthz/ready';
    return url.toString();
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(this.healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      method: 'GET',
      headers: this.headers,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  async postJson<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  async postStream(url: string, body: unknown): Promise<Response> {
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    return res;
  }
}
