import type { GraforumApi } from '../shared/ipc'

declare global {
  interface Window {
    graforum: GraforumApi
  }
}
