import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import type { McpTool, JsonSchema } from '../../types';

const html = htm.bind(h);

interface McpPlaygroundProps {
  tools: McpTool[];
  connected: boolean;
  onTestTool: (toolName: string, args: Record<string, unknown>) => void;
  onRefreshTools: () => void;
  testResult: { result: string; error?: string } | null;
}

export function McpPlayground(props: McpPlaygroundProps) {
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [executing, setExecuting] = useState(false);
  const [search, setSearch] = useState('');

  const filteredTools = props.tools.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  const selectTool = (tool: McpTool) => {
    setSelectedTool(tool);
    setValues({});
    setExecuting(false);
  };

  const setValue = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleExecute = () => {
    if (!selectedTool) return;
    setExecuting(true);
    props.onTestTool(selectedTool.name, values);
  };

  // When testResult changes while executing, mark done
  if (executing && props.testResult) {
    setExecuting(false);
  }

  const generateSample = (schema: JsonSchema): Record<string, unknown> => {
    const sample: Record<string, unknown> = {};
    const properties = schema.properties ?? {};
    for (const [key, prop] of Object.entries(properties)) {
      if (prop.default != null) {
        sample[key] = prop.default;
      } else if (prop.enum && prop.enum.length > 0) {
        sample[key] = prop.enum[0];
      } else if (prop.type === 'string') {
        sample[key] = '';
      } else if (prop.type === 'number' || prop.type === 'integer') {
        sample[key] = 0;
      } else if (prop.type === 'boolean') {
        sample[key] = false;
      } else if (prop.type === 'object') {
        sample[key] = {};
      }
    }
    return sample;
  };

  return html`
    <div class="playground">
      <div class="playground-header">
        <span class="playground-title">MCP Playground</span>
        <button class="icon-btn" onClick=${props.onRefreshTools} title="Refresh Tools">
          Refresh
        </button>
      </div>

      ${!props.connected && html`
        <div class="playground-notice">
          Not connected to agentgateway. Click Connect to start.
        </div>
      `}

      <div class="playground-body">
        <div class="playground-tools">
          <input
            class="playground-search"
            type="text"
            placeholder="Search tools..."
            value=${search}
            onInput=${(e: Event) => setSearch((e.target as HTMLInputElement).value)}
          />
          <div class="tool-list">
            ${filteredTools.length === 0 && html`
              <div class="tool-list-empty">
                ${props.tools.length === 0 ? 'No tools loaded' : 'No matching tools'}
              </div>
            `}
            ${filteredTools.map((tool) => html`
              <div
                key=${tool.name}
                class="tool-list-item ${selectedTool?.name === tool.name ? 'selected' : ''}"
                onClick=${() => selectTool(tool)}
              >
                <div class="tool-list-name">${tool.name}</div>
                <div class="tool-list-desc">${tool.description}</div>
              </div>
            `)}
          </div>
        </div>

        <div class="playground-detail">
          ${!selectedTool && html`
            <div class="playground-empty">
              Select a tool to test it
            </div>
          `}
          ${selectedTool && html`
            <div class="playground-tool-detail">
              <div class="detail-header">
                <h3 class="detail-name">${selectedTool.name}</h3>
                ${selectedTool.serverName && html`
                  <span class="detail-server">${selectedTool.serverName}</span>
                `}
              </div>
              <p class="detail-desc">${selectedTool.description}</p>

              <div class="detail-section">
                <div class="detail-section-header">
                  <span>Parameters</span>
                  ${Object.keys(selectedTool.inputSchema.properties ?? {}).length > 0 && html`
                    <button
                      class="icon-btn small"
                      onClick=${() => setValues(generateSample(selectedTool.inputSchema))}
                      title="Fill with sample values"
                    >
                      Sample
                    </button>
                  `}
                </div>
                ${renderParams(selectedTool.inputSchema, values, setValue)}
              </div>

              <div class="detail-actions">
                <button
                  class="send-btn"
                  onClick=${handleExecute}
                  disabled=${executing || !props.connected}
                >
                  ${executing ? 'Running...' : 'Run Tool'}
                </button>
              </div>

              ${props.testResult && html`
                <div class="detail-section">
                  <div class="detail-section-header">
                    <span>${props.testResult.error ? 'Error' : 'Response'}</span>
                  </div>
                  <pre class="detail-response ${props.testResult.error ? 'error' : ''}">${
                    props.testResult.error ?? formatJson(props.testResult.result)
                  }</pre>
                </div>
              `}

              <div class="detail-section">
                <div class="detail-section-header">
                  <span>Schema</span>
                </div>
                <pre class="detail-schema">${JSON.stringify(selectedTool.inputSchema, null, 2)}</pre>
              </div>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

function renderParams(
  schema: JsonSchema,
  values: Record<string, unknown>,
  setValue: (key: string, value: unknown) => void,
) {
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const entries = Object.entries(properties);

  if (entries.length === 0) {
    return html`<div class="detail-no-params">No parameters required</div>`;
  }

  return entries.map(([key, prop]) => html`
    <div class="param-field" key=${key}>
      <label class="param-label">
        ${key}
        ${required.has(key) ? html`<span class="param-required">*</span>` : null}
      </label>
      ${prop.description && html`<div class="param-hint">${prop.description}</div>`}
      ${renderInput(key, prop, values[key], setValue)}
    </div>
  `);
}

function renderInput(
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
        ${schema.enum.map((opt: string) => html`<option key=${opt} value=${opt}>${opt}</option>`)}
      </select>
    `;
  }

  if (schema.type === 'boolean') {
    return html`
      <label class="param-checkbox">
        <input
          type="checkbox"
          checked=${!!value}
          onChange=${(e: Event) => setValue(key, (e.target as HTMLInputElement).checked)}
        />
        <span>${value ? 'true' : 'false'}</span>
      </label>
    `;
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    return html`
      <input
        type="number"
        class="form-input"
        value=${value ?? ''}
        onInput=${(e: Event) => setValue(key, Number((e.target as HTMLInputElement).value))}
        placeholder=${schema.default != null ? String(schema.default) : ''}
      />
    `;
  }

  if (schema.type === 'object') {
    return html`
      <textarea
        class="form-input param-json"
        value=${typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2)}
        onInput=${(e: Event) => {
          const raw = (e.target as HTMLTextAreaElement).value;
          try { setValue(key, JSON.parse(raw)); } catch { setValue(key, raw); }
        }}
        placeholder="JSON object..."
        rows="3"
      />
    `;
  }

  return html`
    <input
      type="text"
      class="form-input"
      value=${value ?? ''}
      onInput=${(e: Event) => setValue(key, (e.target as HTMLInputElement).value)}
      placeholder=${schema.default != null ? String(schema.default) : ''}
    />
  `;
}

function formatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
