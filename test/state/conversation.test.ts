// test/state/conversation.test.ts
import { describe, it, expect } from 'vitest';
import { Conversation } from '../../src/state/conversation';

describe('Conversation', () => {
  it('starts empty', () => {
    const conv = new Conversation();
    expect(conv.messages).toEqual([]);
  });

  it('adds user message', () => {
    const conv = new Conversation();
    conv.addUserMessage('Hello');
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0]).toEqual({ role: 'user', content: 'Hello' });
  });

  it('adds assistant message', () => {
    const conv = new Conversation();
    conv.addAssistantMessage('Hi there');
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0]).toEqual({ role: 'assistant', content: 'Hi there' });
  });

  it('adds assistant message with tool calls', () => {
    const conv = new Conversation();
    conv.addAssistantToolCallMessage([{
      id: 'call_1',
      type: 'function',
      function: { name: 'search', arguments: '{"q":"test"}' },
    }]);
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0].role).toBe('assistant');
    expect(conv.messages[0].content).toBeNull();
    expect(conv.messages[0].tool_calls).toHaveLength(1);
  });

  it('adds tool result message', () => {
    const conv = new Conversation();
    conv.addToolResultMessage('call_1', 'result data');
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0]).toEqual({
      role: 'tool',
      content: 'result data',
      tool_call_id: 'call_1',
    });
  });

  it('clears all messages', () => {
    const conv = new Conversation();
    conv.addUserMessage('Hello');
    conv.addAssistantMessage('Hi');
    conv.clear();
    expect(conv.messages).toEqual([]);
  });

  it('builds messages array for API call', () => {
    const conv = new Conversation();
    conv.addUserMessage('weather in NYC');
    conv.addAssistantToolCallMessage([{
      id: 'call_1',
      type: 'function',
      function: { name: 'get_weather', arguments: '{"city":"NYC"}' },
    }]);
    conv.addToolResultMessage('call_1', '72F, sunny');
    conv.addAssistantMessage('The weather in NYC is 72F and sunny.');

    expect(conv.messages).toHaveLength(4);
    expect(conv.messages[0].role).toBe('user');
    expect(conv.messages[1].role).toBe('assistant');
    expect(conv.messages[2].role).toBe('tool');
    expect(conv.messages[3].role).toBe('assistant');
  });
});
