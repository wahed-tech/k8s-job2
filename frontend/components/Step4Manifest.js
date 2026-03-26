import { html }              from 'htm/preact'
import { useState, useEffect, useRef } from 'preact/hooks'

export default function Step4Manifest({ manifest, jobName, onStartOver }) {
  const [copied, setCopied] = useState(false)
  const codeRef             = useRef(null)

  // Syntax highlight once the code element is mounted.
  useEffect(() => {
    if (codeRef.current && window.hljs) {
      window.hljs.highlightElement(codeRef.current)
    }
  }, [manifest])

  function download() {
    const blob = new Blob([manifest], { type: 'text/yaml' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${jobName}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }

  function copy() {
    navigator.clipboard.writeText(manifest).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return html`
    <div class="card">
      <div class="card-title">Generated Manifest</div>
      <div class="card-desc">Your Kubernetes Job manifest is ready.</div>

      <div class="yaml-preview">
        <pre><code class="language-yaml" ref=${codeRef}>${manifest}</code></pre>
      </div>

      <div class="yaml-actions">
        <button class="btn btn-primary" onClick=${download}>
          Download ${jobName}.yaml
        </button>
        <button class="btn btn-secondary" onClick=${copy}>
          ${copied ? '✓ Copied!' : 'Copy to clipboard'}
        </button>
      </div>

      <div class="kubectl-hint">
        <code>kubectl apply -f ${jobName}.yaml</code>
      </div>

      <div class="step-footer" style="margin-top: 16px">
        <span />
        <button class="btn btn-secondary" onClick=${onStartOver}>Start over</button>
      </div>
    </div>
  `
}
