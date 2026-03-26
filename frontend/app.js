import { render }           from 'preact'
import { useState, useEffect } from 'preact/hooks'
import { html }              from 'htm/preact'

import Header          from './components/Header.js'
import Login           from './components/Login.js'
import StepsIndicator  from './components/StepsIndicator.js'
import Step1Command    from './components/Step1Command.js'
import Step2Repo       from './components/Step2Repo.js'
import Step3JobName    from './components/Step3JobName.js'
import Step4Manifest   from './components/Step4Manifest.js'
import { generateJobName } from './utils/manifest.js'

function App() {
  // Auth
  const [user, setUser]           = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Wizard navigation
  const [step, setStep]           = useState(1)

  // Step 1
  const [command, setCommand]     = useState('')
  const [args, setArgs]           = useState([''])

  // Step 2
  const [repos, setRepos]         = useState([])
  const [selectedRepo, setSelectedRepo] = useState(null)

  // Step 3 — job name; tracks whether the user manually edited it
  const [jobName, setJobName]           = useState('')
  const [jobNameEdited, setJobNameEdited] = useState(false)

  // Step 4
  const [manifest, setManifest]   = useState('')

  // ── Auth check ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/me')
      .then(r => r.ok ? r.json() : null)
      .then(u => { setUser(u); setAuthLoading(false) })
      .catch(() => setAuthLoading(false))
  }, [])

  // ── Pre-fetch repos once logged in ────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    fetch('/api/repos')
      .then(r => r.ok ? r.json() : [])
      .then(data => setRepos((data ?? []).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => {})
  }, [user])

  // ── Auto-generate job name from command + args ────────────────────────────
  // Resets whenever command or args change; respects manual edits in Step 3.
  useEffect(() => {
    if (!jobNameEdited) {
      setJobName(generateJobName(command, args))
    }
  }, [command, args])

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleCommandChange(cmd) {
    setCommand(cmd)
    setJobNameEdited(false)  // new command → fresh suggestion
  }

  function handleArgsChange(newArgs) {
    setArgs(newArgs)
    setJobNameEdited(false)  // new args → fresh suggestion
  }

  function handleJobNameChange(name) {
    setJobName(name)
    setJobNameEdited(true)
  }

  function startOver() {
    setStep(1)
    setCommand('')
    setArgs([''])
    setSelectedRepo(null)
    setJobName('')
    setJobNameEdited(false)
    setManifest('')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (authLoading) return null
  if (!user)       return html`<${Login} />`

  const stepContent = {
    1: html`<${Step1Command}
              command=${command}
              args=${args}
              onCommandChange=${handleCommandChange}
              onArgsChange=${handleArgsChange}
              onNext=${() => setStep(2)}
            />`,
    2: html`<${Step2Repo}
              repos=${repos}
              selectedRepo=${selectedRepo}
              onSelect=${setSelectedRepo}
              onBack=${() => setStep(1)}
              onNext=${() => setStep(3)}
            />`,
    3: html`<${Step3JobName}
              jobName=${jobName}
              selectedRepo=${selectedRepo}
              command=${command}
              args=${args}
              onJobNameChange=${handleJobNameChange}
              onBack=${() => setStep(2)}
              onGenerated=${m => { setManifest(m); setStep(4) }}
            />`,
    4: html`<${Step4Manifest}
              manifest=${manifest}
              jobName=${jobName}
              onStartOver=${startOver}
            />`,
  }

  return html`
    <div>
      <${Header} user=${user} />
      <div class="wizard-page">
        <${StepsIndicator} current=${step} />
        ${stepContent[step]}
      </div>
    </div>
  `
}

render(html`<${App} />`, document.getElementById('app'))
