import { html }     from 'htm/preact'
import { useState } from 'preact/hooks'
import { validateJobName, generateManifest } from '../utils/manifest.js'

export default function Step3JobName({ jobName, onJobNameChange, selectedRepo, command, args, onBack, onGenerated }) {
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [apiError, setApiError] = useState('')

  function handleNameInput(e) {
    const val = e.target.value
    onJobNameChange(val)
    setError(validateJobName(val))
  }

  async function handleGenerate() {
    const nameError = validateJobName(jobName)
    if (nameError) {
      setError(nameError)
      return
    }

    setLoading(true)
    setApiError('')
    try {
      const res = await fetch(`/api/repos/${encodeURIComponent(selectedRepo.name)}/deployment`)
      if (res.status === 404) {
        throw new Error(`No .kube/base/deployment.yaml found in ${selectedRepo.name}.`)
      }
      if (!res.ok) throw new Error(await res.text())

      const { content } = await res.json()
      const manifest = generateManifest(jobName, command, args, content)
      onGenerated(manifest)
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return html`
    <div class="card">
      <div class="card-title">Job Name</div>
      <div class="card-desc">
        Review and edit the suggested name. Must be lowercase alphanumeric + hyphens, max 52 characters.
      </div>

      ${apiError && html`<div class="alert alert-error">${apiError}</div>`}

      <div class="form-group">
        <label class="form-label">Job name</label>
        <input
          class="form-input mono ${error ? 'error' : ''}"
          type="text"
          maxlength="52"
          value=${jobName}
          onInput=${handleNameInput}
        />
        ${error && html`<div class="form-error">${error}</div>`}
        <div class="form-hint">Namespace: wahed</div>
      </div>

      <div class="step-footer">
        <button class="btn btn-secondary" onClick=${onBack} disabled=${loading}>← Back</button>
        <button class="btn btn-primary" onClick=${handleGenerate} disabled=${loading}>
          ${loading && html`<span class="spinner" /> `}
          Generate manifest
        </button>
      </div>
    </div>
  `
}
