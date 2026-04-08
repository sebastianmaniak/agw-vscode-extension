import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import type { PromptTemplate } from '../../types';

const html = htm.bind(h);

interface PromptTemplatesProps {
  templates: PromptTemplate[];
  onUse: (content: string) => void;
  onSave: (template: PromptTemplate) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function PromptTemplates(props: PromptTemplatesProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');

  const handleAdd = () => {
    if (!name.trim() || !content.trim()) return;
    props.onSave({
      id: crypto.randomUUID(),
      name: name.trim(),
      content: content.trim(),
    });
    setName('');
    setContent('');
    setAdding(false);
  };

  return html`
    <div class="prompt-templates">
      <div class="pt-header">
        <span class="pt-title">Prompt Templates</span>
        <div class="pt-header-actions">
          <button class="icon-btn" onClick=${() => setAdding(!adding)}>
            ${adding ? 'Cancel' : '+ New'}
          </button>
          <button class="icon-btn" onClick=${props.onClose}>Back</button>
        </div>
      </div>

      ${adding && html`
        <div class="pt-add-form">
          <input
            class="form-input"
            type="text"
            placeholder="Template name"
            value=${name}
            onInput=${(e: Event) => setName((e.target as HTMLInputElement).value)}
          />
          <textarea
            class="form-input pt-content-input"
            placeholder="Template content..."
            value=${content}
            onInput=${(e: Event) => setContent((e.target as HTMLTextAreaElement).value)}
            rows="4"
          />
          <button class="send-btn" onClick=${handleAdd} disabled=${!name.trim() || !content.trim()}>
            Save Template
          </button>
        </div>
      `}

      <div class="pt-list">
        ${props.templates.length === 0 && !adding && html`
          <div class="pt-empty">No saved templates. Click "+ New" to create one.</div>
        `}
        ${props.templates.map((t) => html`
          <div key=${t.id} class="pt-item">
            <div class="pt-item-header">
              <span class="pt-item-name">${t.name}</span>
              <div class="pt-item-actions">
                <button class="icon-btn small" onClick=${() => props.onUse(t.content)} title="Use">Use</button>
                <button class="icon-btn small" onClick=${() => props.onDelete(t.id)} title="Delete">x</button>
              </div>
            </div>
            <div class="pt-item-preview">${t.content.slice(0, 120)}${t.content.length > 120 ? '...' : ''}</div>
          </div>
        `)}
      </div>
    </div>
  `;
}
