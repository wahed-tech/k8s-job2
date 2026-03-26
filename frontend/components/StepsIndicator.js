import { html } from 'htm/preact'

const STEPS = ['Command', 'Repository', 'Job Name', 'Manifest']

export default function StepsIndicator({ current }) {
  return html`
    <div class="wizard-steps">
      ${STEPS.flatMap((label, i) => {
        const num = i + 1
        const done   = num < current
        const active = num === current
        const items = [html`
          <div class="wizard-step" key=${label}>
            <div class="step-bubble ${done ? 'done' : active ? 'active' : ''}">
              ${done ? '✓' : String(num)}
            </div>
            <span class="step-label ${active ? 'active' : ''}">${label}</span>
          </div>
        `]
        if (i < STEPS.length - 1) {
          items.push(html`<div key=${'c' + i} class="step-connector ${done ? 'done' : ''}" />`)
        }
        return items
      })}
    </div>
  `
}
