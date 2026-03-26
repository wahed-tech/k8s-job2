import { html }              from 'htm/preact'
import { useState }          from 'preact/hooks'

export default function Step1Command({ command, args, onCommandChange, onArgsChange, onNext }) {
  const [error, setError] = useState('')

  function handleNext() {
    if (!command.trim()) {
      setError('Command is required.')
      return
    }
    setError('')
    onNext()
  }

  function updateArg(index, value) {
    const next = [...args]
    next[index] = value
    onArgsChange(next)
  }

  function addArg() {
    onArgsChange([...args, ''])
  }

  function removeArg(index) {
    if (args.length === 1) {
      onArgsChange([''])
    } else {
      onArgsChange(args.filter((_, i) => i !== index))
    }
  }

  return html`
    <div class="card">
      <div class="card-title">Command &amp; Arguments</div>
      <div class="card-desc">Enter the command and arguments to run inside the job container.</div>

      ${error && html`<div class="alert alert-error">${error}</div>`}

      <div class="form-group">
        <label class="form-label">Command</label>
        <input
          class="form-input mono"
          type="text"
          placeholder="/app/bin/migrate"
          value=${command}
          onInput=${e => { onCommandChange(e.target.value.trim()); setError('') }}
        />
        <div class="form-hint">Full path to the executable inside the container.</div>
      </div>

      <div class="form-group">
        <label class="form-label">Arguments</label>
        <div class="args-list">
          ${args.map((arg, i) => html`
            <div class="arg-row" key=${i}>
              <input
                class="form-input mono"
                type="text"
                placeholder=${i === 0 ? '--env=production' : '--dry-run'}
                value=${arg}
                onInput=${e => updateArg(i, e.target.value)}
              />
              <button class="btn btn-ghost" type="button" title="Remove" onClick=${() => removeArg(i)}>✕</button>
            </div>
          `)}
        </div>
        <button class="btn btn-secondary" type="button" onClick=${addArg}>+ Add argument</button>
      </div>

      <div class="step-footer">
        <span />
        <button class="btn btn-primary" onClick=${handleNext}>Next →</button>
      </div>
    </div>
  `
}
