import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const workspaceAliases = {
  '@jarvis/protocol': resolve(__dirname, '../../packages/protocol/src/index.ts'),
  '@jarvis/core': resolve(__dirname, '../../packages/core/src/index.ts'),
  '@jarvis/voice': resolve(__dirname, '../../packages/voice/src/index.ts'),
  '@shared': resolve(__dirname, '../../packages/protocol/src')
}

const internalWorkspaces = ['@jarvis/core', '@jarvis/protocol', '@jarvis/voice']

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: internalWorkspaces })],
    resolve: {
      alias: workspaceAliases
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: internalWorkspaces })],
    resolve: {
      alias: workspaceAliases
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs'
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        ...workspaceAliases
      }
    },
    plugins: [react()]
  }
})
