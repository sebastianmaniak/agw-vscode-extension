import { h } from 'preact';
import { useState, useRef } from 'preact/hooks';
import htm from 'htm';

const html = htm.bind(h);

interface ModelSelectorProps {
  models: string[];
  current: string;
  onSelect: (model: string) => void;
}

export function ModelSelector({ models, current, onSelect }: ModelSelectorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEditing = () => {
    setDraft(current);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = () => {
    const val = draft.trim();
    if (val && val !== current) {
      onSelect(val);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  if (editing) {
    return html`
      <div class="model-combo">
        <input
          ref=${inputRef}
          class="model-input"
          type="text"
          value=${draft}
          list="model-suggestions"
          onInput=${(e: Event) => setDraft((e.target as HTMLInputElement).value)}
          onKeyDown=${handleKeyDown}
          onBlur=${commit}
          placeholder="Type model name..."
        />
        <datalist id="model-suggestions">
          ${models.map((m) => html`<option key=${m} value=${m} />`)}
        </datalist>
      </div>
    `;
  }

  return html`
    <button class="model-display" onClick=${startEditing} title="Click to change model">
      ${current || 'Set model...'}
    </button>
  `;
}
