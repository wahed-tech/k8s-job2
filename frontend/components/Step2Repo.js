import { html }                    from 'htm/preact'
import { useState, useEffect, useRef } from 'preact/hooks'

export default function Step2Repo({ repos, selectedRepo, onSelect, onBack, onNext }) {
  const [filter, setFilter]           = useState(selectedRepo?.name ?? '')
  const [showDropdown, setShowDropdown] = useState(false)
  const [error, setError]             = useState('')
  const wrapRef                       = useRef(null)

  // Close dropdown on outside click.
  useEffect(() => {
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = filter
    ? repos.filter(r =>
        r.name.toLowerCase().includes(filter.toLowerCase()) ||
        (r.description ?? '').toLowerCase().includes(filter.toLowerCase())
      )
    : repos

  function handleSelect(repo) {
    onSelect(repo)
    setFilter(repo.name)
    setShowDropdown(false)
    setError('')
  }

  function handleNext() {
    if (!selectedRepo) {
      setError('Please select a repository.')
      return
    }
    setError('')
    onNext()
  }

  return html`
    <div class="card">
      <div class="card-title">Select Repository</div>
      <div class="card-desc">
        Choose a repository from wahed-tech. The app will read
        <code>.kube/base/deployment.yaml</code> to inherit the correct image, env vars, and volumes.
      </div>

      ${error && html`<div class="alert alert-error">${error}</div>`}

      ${repos.length === 0 && html`
        <div class="alert alert-info">
          <span class="spinner" /> Loading repositories…
        </div>
      `}

      <div class="form-group">
        <label class="form-label">Repository</label>
        <div class="repo-search-wrap" ref=${wrapRef}>
          <input
            class="form-input"
            type="text"
            placeholder="Search repositories…"
            value=${filter}
            autocomplete="off"
            onInput=${e => { setFilter(e.target.value); setShowDropdown(true) }}
            onFocus=${() => setShowDropdown(true)}
          />
          ${showDropdown && repos.length > 0 && html`
            <div class="repo-dropdown">
              ${filtered.length === 0
                ? html`<div class="repo-no-results">No repositories found.</div>`
                : filtered.slice(0, 50).map(repo => html`
                    <div
                      key=${repo.name}
                      class="repo-item ${selectedRepo?.name === repo.name ? 'selected' : ''}"
                      onMouseDown=${() => handleSelect(repo)}
                    >
                      <div class="repo-item-name">${repo.name}</div>
                      ${repo.description && html`
                        <div class="repo-item-desc">${repo.description}</div>
                      `}
                    </div>
                  `)
              }
            </div>
          `}
        </div>
        ${selectedRepo && html`
          <div class="selected-repo-badge">✓ wahed-tech / ${selectedRepo.name}</div>
        `}
      </div>

      <div class="step-footer">
        <button class="btn btn-secondary" onClick=${onBack}>← Back</button>
        <button class="btn btn-primary" onClick=${handleNext}>Next →</button>
      </div>
    </div>
  `
}
