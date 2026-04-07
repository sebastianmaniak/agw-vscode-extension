import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamChatCompletion, parseSSELine } from '../../src/gateway/chat';
import { GatewayClient } from '../../src/gateway/client';
import type { ChatCompletionChunk } from '../../src/types';

describe('parseSSELine', () => {
  it('parses a data line into a chunk', () => {
    const chunk: ChatCompletionChunk = {
      id: 'chatcmpl-1',
      choices: [{
        index: 0,
        delta: { content: 'Hello' },
        finish_reason: null,
      }],
    };
    const result = parseSSELine(`data: ${JSON.stringify(chunk)}`);
    expect(result).toEqual(chunk);
  });

  it('returns null for [DONE]', () => {
    expect(parseSSELine('data: [DONE]')).toBeNull();
  });

  it('returns undefined for empty lines', () => {
    expect(parseSSELine('')).toBeUndefined();
    expect(parseSSELine('\n')).toBeUndefined();
  });

  it('returns undefined for comment lines', () => {
    expect(parseSSELine(': keep-alive')).toBeUndefined();
  });
});

describe('streamChatCompletion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('streams content chunks via callback', async () => {
    const sseBody = [
      'data: {"id":"1","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}',
      '',
      'data: {"id":"1","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}',
      '',
      'data: {"id":"1","choices":[{"index":0,"delta":{"content":" there"},"finish_reason":null}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseBody));
        controller.close();
      },
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    }));

    const client = new GatewayClient({
      llmEndpoint: 'http://localhost:8080',
      mcpEndpoint: 'http://localhost:3000',
      apiKey: '',
      defaultModel: '',
    });

    const chunks: ChatCompletionChunk[] = [];
    await streamChatCompletion(
      client,
      'gpt-4o',
      [{ role: 'user', content: 'hello' }],
      [],
      (chunk) => { chunks.push(chunk); }
    );

    expect(chunks).toHaveLength(3);
    expect(chunks[1].choices[0].delta.content).toBe('Hi');
    expect(chunks[2].choices[0].delta.content).toBe(' there');
  });

  it('detects tool_calls in stream', async () => {
    const toolCallChunks = [
      'data: {"id":"1","choices":[{"index":0,"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"get_weather","arguments":""}}]},"finish_reason":null}]}',
      '',
      'data: {"id":"1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"city\\":\\"NYC\\"}"}}]},"finish_reason":null}]}',
      '',
      'data: {"id":"1","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(toolCallChunks));
        controller.close();
      },
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    }));

    const client = new GatewayClient({
      llmEndpoint: 'http://localhost:8080',
      mcpEndpoint: 'http://localhost:3000',
      apiKey: '',
      defaultModel: '',
    });

    const chunks: ChatCompletionChunk[] = [];
    await streamChatCompletion(
      client,
      'gpt-4o',
      [{ role: 'user', content: 'weather in NYC' }],
      [],
      (chunk) => { chunks.push(chunk); }
    );

    expect(chunks[0].choices[0].delta.tool_calls![0].function!.name).toBe('get_weather');
    expect(chunks[2].choices[0].finish_reason).toBe('tool_calls');
  });
});
