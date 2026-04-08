import { h } from 'preact';
import htm from 'htm';
import type { GatewayProfile } from '../../types';

const html = htm.bind(h);

interface GatewaySelectorProps {
  gateways: GatewayProfile[];
  active: string;
  onSwitch: (name: string) => void;
}

export function GatewaySelector({ gateways, active, onSwitch }: GatewaySelectorProps) {
  if (gateways.length <= 1) return null;

  return html`
    <div class="gateway-selector">
      <select
        class="gateway-select"
        value=${active}
        onChange=${(e: Event) => onSwitch((e.target as HTMLSelectElement).value)}
        title="Switch gateway profile"
      >
        ${gateways.map((g) => html`
          <option key=${g.name} value=${g.name}>${g.name}</option>
        `)}
      </select>
    </div>
  `;
}
