import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import type { McpTool, JsonSchema } from '../../types';

const html = htm.bind(h);

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
};

interface ToolTestFormProps {
  tool: McpTool;
  testResult: { result: string; error?: string } | null;
}

export function ToolTestForm({ tool, testResult }: ToolTestFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [expanded, setExpanded] = useState(true);

  const properties = tool.inputSchema.properties ?? {};
  const required = new Set(tool.inputSchema.required ?? []);

  const handleSubmit = () => {
    const vscode = acquireVsCodeApi();
    vscode.postMessage({
      type: 'testTool',
      toolName: tool.name,
      args: values,
    });
  };

  const setValue = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  return html`
    <div class="tool-test-form">
      <div class="tool-test-header" onClick=${() => setExpanded(!expanded)}>
        <span class="tool-test-title">Test: ${tool.name}</span>
        <span>${expanded ? 'v' : '>'}</span>
      </div>
      ${expanded && html`
        <div class="tool-test-body">
          <p class="tool-test-desc">${tool.description}</p>
          ${Object.entries(properties).map(([key, schema]) => html`
            <div class="form-field" key=${key}>
              <label class="form-label">
                ${key}${required.has(key) ? ' *' : ''}
                ${schema.description ? html`<span class="form-hint">${schema.description}</span>` : null}
              </label>
              ${renderField(key, schema, values[key], setValue)}
            </div>
          `)}
          <button class="send-btn" onClick=${handleSubmit}>
            Execute
          </button>
          ${testResult && html`
            <div class="tool-test-result ${testResult.error ? 'error' : ''}">
              <div class="tool-test-result-label">${testResult.error ? 'Error' : 'Result'}</div>
              <pre>${testResult.error ?? testResult.result}</pre>
            </div>
          `}
        </div>
      `}
    </div>
  `;
}

function renderField(
  key: string,
  schema: JsonSchema,
  value: unknown,
  setValue: (key: string, value: unknown) => void,
) {
  if (schema.enum) {
    return html`
      <select
        class="form-select"
        value=${value ?? ''}
        onChange=${(e: Event) => setValue(key, (e.target as HTMLSelectElement).value)}
      >
        <option value="">Select...</option>
        ${schema.enum.map((opt: string) => html`
          <option key=${opt} value=${opt}>${opt}</option>
        `)}
      </select>
    `;
  }

  if (schema.type === 'boolean') {
    return html`
      <input
        type="checkbox"
        class="form-checkbox"
        checked=${!!value}
        onChange=${(e: Event) => setValue(key, (e.target as HTMLInputElement).checked)}
      />
    `;
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    return html`
      <input
        type="number"
        class="form-input"
        value=${value ?? ''}
        onInput=${(e: Event) => setValue(key, Number((e.target as HTMLInputElement).value))}
        placeholder=${schema.default != null ? 'Default: ' + String(schema.default) : ''}
      />
    `;
  }

  return html`
    <input
      type="text"
      class="form-input"
      value=${value ?? ''}
      onInput=${(e: Event) => setValue(key, (e.target as HTMLInputElement).value)}
      placeholder=${schema.default != null ? 'Default: ' + String(schema.default) : ''}
    />
  `;
}
