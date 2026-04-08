import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';

const html = htm.bind(h);

interface SystemPromptEditorProps {
  prompt: string;
  onSave: (prompt: string) => void;
  onClose: () => void;
}

export function SystemPromptEditor(props: SystemPromptEditorProps) {
  const [draft, setDraft] = useState(props.prompt);

  useEffect(() => { setDraft(props.prompt); }, [props.prompt]);

  const handleSave = () => {
    props.onSave(draft);
    props.onClose();
  };

  return html`
    <div class="system-prompt-editor">
      <div class="sp-header">
        <span class="sp-title">System Prompt</span>
        <button class="icon-btn" onClick=${props.onClose}>Back</button>
      </div>
      <div class="sp-body">
        <p class="sp-hint">This prompt is prepended to every conversation as a system message.</p>
        <textarea
          class="sp-textarea"
          value=${draft}
          onInput=${(e: Event) => setDraft((e.target as HTMLTextAreaElement).value)}
          placeholder="You are a helpful assistant..."
          rows="8"
        />
        <div class="sp-actions">
          <button class="send-btn" onClick=${handleSave}>Save</button>
          ${draft && html`
            <button class="icon-btn" onClick=${() => { setDraft(''); props.onSave(''); }}>Clear</button>
          `}
        </div>
      </div>
    </div>
  `;
}
