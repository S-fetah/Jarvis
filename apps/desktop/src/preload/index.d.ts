import { JarvisAPI } from '@jarvis/protocol'

declare global {
  interface Window {
    jarvisAPI: JarvisAPI
  }
}
