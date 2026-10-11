import { createServerFn } from '@tanstack/react-start'

export type Service = {
  project: string
  title: string
  host: string
  alias: string
  versions: string[]
  mark: string
  category: string
  description: string
  hue: string
}

export type ActivityLog = {
  time: string
  method: string
  path: string
  status: string
  kind: 'request' | 'error'
}

export type ServiceTelemetry = {
  activity: { requests: number; errors: number; logs: ActivityLog[] }[]
  resources: {
    cpu: number
    memory: number
    memoryLimit: number
    storage: number
    storageLimit: number
  }
}

const services: Service[] = [
  { project: 'llmbenchmarking', title: 'LLM Benchmarking', host: 'llmbenchmarking.dev.lan', alias: 'llmbenchmarking.lan', versions: ['v0.8.llmbenchmarking.dev.lan', 'v0.9.llmbenchmarking.dev.lan'], mark: 'LB', category: 'Research', description: 'Compare model runs, datasets, and evaluation results.', hue: 'tomato' },
  { project: 'paperless', title: 'Paperless', host: 'paperless.dev.lan', alias: 'docs.dev.lan', versions: ['stable.paperless.dev.lan', 'testing.paperless.dev.lan'], mark: 'P', category: 'Home', description: 'A searchable home for household documents.', hue: 'blue' },
  { project: 'grafana', title: 'Grafana', host: 'grafana.dev.lan', alias: 'metrics.dev.lan', versions: ['11.grafana.dev.lan'], mark: 'G', category: 'Operations', description: 'Dashboards for the systems that keep things running.', hue: 'gold' },
  { project: 'forgejo', title: 'Forgejo', host: 'forgejo.dev.lan', alias: 'git.dev.lan', versions: ['preview.forgejo.dev.lan'], mark: 'F', category: 'Development', description: 'Code, issues, and collaboration on the home network.', hue: 'leaf' },
]

const idleHours = new Set([0, 1, 2, 3, 4, 5, 6, 11, 17, 23])
const resourceProfiles: ServiceTelemetry['resources'][] = [
  { cpu: 24, memory: 1.8, memoryLimit: 4, storage: 6.2, storageLimit: 20 },
  { cpu: 13, memory: 0.9, memoryLimit: 3, storage: 12.4, storageLimit: 30 },
  { cpu: 31, memory: 2.2, memoryLimit: 4, storage: 4.7, storageLimit: 16 },
  { cpu: 9, memory: 1.1, memoryLimit: 2, storage: 8.3, storageLimit: 24 },
]

export const getServices = createServerFn({ method: 'GET' }).handler(() => services)

export const getServiceTelemetry = createServerFn({ method: 'GET' })
  .validator((data: { project: string }) => data)
  .handler(({ data }): ServiceTelemetry => {
    const serviceIndex = services.findIndex(service => service.project === data.project)
    if (serviceIndex < 0) throw new Error(`Unknown service project: ${data.project}`)

    const activity = Array.from({ length: 24 }, (_, hour) => {
      if (idleHours.has(hour)) return { requests: 0, errors: 0, logs: [] }
      const seed = (serviceIndex + 3) * (hour + 7)
      const requests = 7 + ((seed * 11) % 48)
      const errors = Math.min(seed % 6 === 0 ? 1 + (seed % 3) : seed % 11 === 0 ? 1 : 0, requests)
      const prefix = `${String(hour).padStart(2, '0')}`
      const logs: ActivityLog[] = [
        { time: `${prefix}:08`, method: 'GET', path: '/api/health', status: '200', kind: 'request' },
        { time: `${prefix}:21`, method: 'GET', path: '/api/projects', status: '200', kind: 'request' },
      ]
      if (errors > 0) logs.push({ time: `${prefix}:43`, method: 'POST', path: '/api/run', status: '503', kind: 'error' })
      return { requests, errors, logs }
    })

    return { activity, resources: resourceProfiles[serviceIndex] }
  })
