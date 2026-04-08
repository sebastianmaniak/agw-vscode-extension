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

  async checkHealth(): Promise<boolean> {
    // Try dedicated health endpoint first (port 15021)
    try {
      const url = new URL(this.config.llmEndpoint);
      url.port = '15021';
      url.pathname = '/healthz/ready';
      const res = await fetch(url.toString(), {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) return true;
    } catch {
      // Fall through to LLM endpoint check
    }

    // Fallback: probe the chat completions endpoint with a minimal request.
    // Any HTTP response (even 400) means the gateway is reachable.
    try {
      const res = await fetch(`${this.llmEndpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ model: '', messages: [] }),
        signal: AbortSignal.timeout(5000),
      });
      // Any response (200, 400, 422, etc.) means the server is alive
      return res.status > 0;
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
