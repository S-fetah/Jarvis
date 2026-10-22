import { JarvisAPI } from '../shared/types'

declare global {
  interface Window {
    jarvisAPI: JarvisAPI
  }
}
