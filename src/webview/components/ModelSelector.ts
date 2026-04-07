import { h } from 'preact';
import htm from 'htm';
import type { Model } from '../../types';

const html = htm.bind(h);

interface ModelSelectorProps {
  models: Model[];
  current: string;
  onSelect: (model: string) => void;
}

export function ModelSelector({ models, current, onSelect }: ModelSelectorProps) {
  return html`
    <select
      class="model-selector"
      value=${current}
      onChange=${(e: Event) => onSelect((e.target as HTMLSelectElement).value)}
    >
      ${models.length === 0 && html`
        <option value="">No models available</option>
      `}
      ${models.map((m) => html`
        <option key=${m.id} value=${m.id}>${m.id}</option>
      `)}
    </select>
  `;
}
