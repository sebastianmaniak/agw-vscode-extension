import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import type { McpResource } from '../../types';

const html = htm.bind(h);

interface ResourceBrowserProps {
  resources: McpResource[];
  onRefresh: () => void;
  onRead: (uri: string) => void;
  resourceContent: { uri: string; content: string; mimeType?: string } | null;
}

export function ResourceBrowser(props: ResourceBrowserProps) {
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = props.resources.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.uri.toLowerCase().includes(search.toLowerCase()) ||
    (r.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (uri: string) => {
    setSelectedUri(uri);
    props.onRead(uri);
  };

  const selected = props.resources.find((r) => r.uri === selectedUri);

  return html`
    <div class="playground">
      <div class="playground-header">
        <span class="playground-title">MCP Resources</span>
        <button class="icon-btn" onClick=${props.onRefresh} title="Refresh Resources">
          Refresh
        </button>
      </div>

      <div class="playground-body">
        <div class="playground-tools">
          <input
            class="playground-search"
            type="text"
            placeholder="Search resources..."
            value=${search}
            onInput=${(e: Event) => setSearch((e.target as HTMLInputElement).value)}
          />
          <div class="tool-list">
            ${filtered.length === 0 && html`
              <div class="tool-list-empty">
                ${props.resources.length === 0 ? 'No resources found' : 'No matching resources'}
              </div>
            `}
            ${filtered.map((r) => html`
              <div
                key=${r.uri}
                class="tool-list-item ${selectedUri === r.uri ? 'selected' : ''}"
                onClick=${() => handleSelect(r.uri)}
              >
                <div class="tool-list-name">${r.name}</div>
                <div class="tool-list-desc">${r.description || r.uri}</div>
              </div>
            `)}
          </div>
        </div>

        <div class="playground-detail">
          ${!selected && html`
            <div class="playground-empty">Select a resource to read its content</div>
          `}
          ${selected && html`
            <div class="playground-tool-detail">
              <div class="detail-header">
                <h3 class="detail-name">${selected.name}</h3>
                ${selected.mimeType && html`
                  <span class="detail-server">${selected.mimeType}</span>
                `}
              </div>
              <p class="detail-desc">${selected.uri}</p>
              ${selected.description && html`<p class="detail-desc">${selected.description}</p>`}

              <div class="detail-section">
                <div class="detail-section-header"><span>Content</span></div>
                ${props.resourceContent?.uri === selectedUri ? html`
                  <pre class="detail-response">${props.resourceContent.content}</pre>
                ` : html`
                  <div class="detail-no-params">Loading...</div>
                `}
              </div>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}
