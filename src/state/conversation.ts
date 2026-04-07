// src/state/conversation.ts
import type { ChatMessage, ToolCall } from '../types';

export class Conversation {
  private _messages: ChatMessage[] = [];

  get messages(): ChatMessage[] {
    return [...this._messages];
  }

  addUserMessage(content: string): void {
    this._messages.push({ role: 'user', content });
  }

  addAssistantMessage(content: string): void {
    this._messages.push({ role: 'assistant', content });
  }

  addAssistantToolCallMessage(toolCalls: ToolCall[]): void {
    this._messages.push({
      role: 'assistant',
      content: null,
      tool_calls: toolCalls,
    });
  }

  addToolResultMessage(toolCallId: string, result: string): void {
    this._messages.push({
      role: 'tool',
      content: result,
      tool_call_id: toolCallId,
    });
  }

  clear(): void {
    this._messages = [];
  }
}
