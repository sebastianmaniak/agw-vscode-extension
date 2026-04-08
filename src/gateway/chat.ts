import type { GatewayClient } from './client';
import type {
  ChatMessage,
  ChatTool,
  ChatCompletionChunk,
  ChatCompletionRequest,
} from '../types';

export function parseSSELine(line: string): ChatCompletionChunk | null | undefined {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) {
    return undefined;
  }
  if (!trimmed.startsWith('data: ')) {
    return undefined;
  }
  const data = trimmed.slice(6);
  if (data === '[DONE]') {
    return null;
  }
  return JSON.parse(data) as ChatCompletionChunk;
}

export async function streamChatCompletion(
  client: GatewayClient,
  model: string,
  messages: ChatMessage[],
  tools: ChatTool[],
  onChunk: (chunk: ChatCompletionChunk) => void,
  signal?: AbortSignal,
): Promise<void> {
  const body: ChatCompletionRequest = {
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (tools.length > 0) {
    body.tools = tools;
  }

  const res = await client.postStream(
    `${client.llmEndpoint}/v1/chat/completions`,
    body,
  );

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const parsed = parseSSELine(line);
        if (parsed === null) return;
        if (parsed !== undefined) {
          onChunk(parsed);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
