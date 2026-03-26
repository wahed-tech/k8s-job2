import jsyaml from 'js-yaml'

/**
 * Derives a k8s-safe job name from a command path and its arguments.
 * e.g. "/app/bin/migrate --env=production" → "migrate-env-production"
 */
export function generateJobName(command, args) {
  const cmd = command.split('/').pop().replace(/[^a-z0-9]/gi, '-')
  const argParts = args
    .filter(a => a.trim())
    .slice(0, 3)
    .map(a => a.replace(/^-+/, '').replace(/=/g, '-').replace(/[^a-z0-9-]/gi, '-'))
  return [cmd, ...argParts]
    .join('-')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 52) || 'job'
}

/**
 * Returns an error message if the name is invalid, or an empty string if valid.
 */
export function validateJobName(name) {
  if (!name) return 'Job name is required.'
  if (name.length > 52) return 'Job name must be 52 characters or fewer.'
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) {
    return 'Must start and end with a lowercase letter or digit and contain only lowercase letters, digits, and hyphens.'
  }
  return ''
}

/**
 * Builds a Kubernetes Job manifest YAML string from user input and
 * the first Deployment document found in the repo's deployment.yaml.
 */
export function generateManifest(jobName, command, args, deploymentYAML) {
  const docs = []
  jsyaml.loadAll(deploymentYAML, doc => { if (doc) docs.push(doc) })
  const deployment = docs.find(d => d.kind === 'Deployment') ?? docs[0] ?? {}

  const podSpec = deployment?.spec?.template?.spec ?? {}
  const container = (podSpec.containers ?? [])[0] ?? {}

  const jobContainer = { name: jobName, image: container.image }
  jobContainer.command = [command]

  const filteredArgs = args.filter(a => a.trim())
  if (filteredArgs.length > 0) jobContainer.args = filteredArgs
  if (container.env)          jobContainer.env = container.env
  if (container.envFrom)      jobContainer.envFrom = container.envFrom
  if (container.volumeMounts) jobContainer.volumeMounts = container.volumeMounts

  const templateSpec = { restartPolicy: 'Never', containers: [jobContainer] }
  if (podSpec.serviceAccountName) templateSpec.serviceAccountName = podSpec.serviceAccountName
  if (podSpec.imagePullSecrets)   templateSpec.imagePullSecrets = podSpec.imagePullSecrets
  if (podSpec.volumes)            templateSpec.volumes = podSpec.volumes

  const job = {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: { name: jobName, namespace: 'wahed' },
    spec: {
      backoffLimit: 0,
      template: { spec: templateSpec },
    },
  }

  return jsyaml.dump(job, { noRefs: true, lineWidth: -1 })
}
