import type { ChatMessage, ToolCall } from '../types';

export interface SavedConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: number;
  updatedAt: number;
}

export class Conversation {
  private _messages: ChatMessage[] = [];
  private _id: string = crypto.randomUUID();
  private _title = '';
  private _model = '';
  private _createdAt: number = Date.now();

  get id(): string { return this._id; }
  get title(): string { return this._title; }
  get model(): string { return this._model; }

  get messages(): ChatMessage[] {
    return [...this._messages];
  }

  setModel(model: string): void {
    this._model = model;
  }

  addUserMessage(content: string): void {
    this._messages.push({ role: 'user', content });
    if (!this._title) {
      this._title = content.slice(0, 60) + (content.length > 60 ? '...' : '');
    }
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

  toSaved(): SavedConversation {
    return {
      id: this._id,
      title: this._title,
      messages: [...this._messages],
      model: this._model,
      createdAt: this._createdAt,
      updatedAt: Date.now(),
    };
  }

  loadFrom(saved: SavedConversation): void {
    this._id = saved.id;
    this._title = saved.title;
    this._messages = [...saved.messages];
    this._model = saved.model;
    this._createdAt = saved.createdAt;
  }

  clear(): void {
    this._messages = [];
    this._id = crypto.randomUUID();
    this._title = '';
    this._model = '';
    this._createdAt = Date.now();
  }
}

const HISTORY_KEY = 'agw.conversationHistory';
const MAX_HISTORY = 50;

export class ConversationStore {
  constructor(private storage: { get<T>(key: string, defaultValue: T): T; update(key: string, value: unknown): Thenable<void> }) {}

  list(): SavedConversation[] {
    const items = this.storage.get<SavedConversation[]>(HISTORY_KEY, []);
    return items.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  save(conversation: Conversation): void {
    if (conversation.messages.length === 0) return;
    const items = this.list();
    const idx = items.findIndex((c) => c.id === conversation.id);
    const saved = conversation.toSaved();
    if (idx >= 0) {
      items[idx] = saved;
    } else {
      items.unshift(saved);
    }
    this.storage.update(HISTORY_KEY, items.slice(0, MAX_HISTORY));
  }

  get(id: string): SavedConversation | undefined {
    return this.list().find((c) => c.id === id);
  }

  delete(id: string): void {
    const items = this.list().filter((c) => c.id !== id);
    this.storage.update(HISTORY_KEY, items);
  }

  clearAll(): void {
    this.storage.update(HISTORY_KEY, []);
  }
}
