import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettingsWindowManager } from '../src/main/windows/settings-window-manager'

// Mock Electron
const mockWebContents = {
  send: vi.fn(),
  setWindowOpenHandler: vi.fn(),
  on: vi.fn()
}

const mockWindowInstance = {
  isDestroyed: vi.fn().mockReturnValue(false),
  isMinimized: vi.fn().mockReturnValue(false),
  restore: vi.fn(),
  show: vi.fn(),
  focus: vi.fn(),
  close: vi.fn(),
  setBackgroundColor: vi.fn(),
  setTitleBarOverlay: vi.fn(),
  loadURL: vi.fn(),
  loadFile: vi.fn(),
  once: vi.fn((event, cb) => {
    if (event === 'ready-to-show') cb()
  }),
  on: vi.fn(),
  webContents: mockWebContents
}

vi.mock('electron', () => {
  return {
    app: {
      isPackaged: false
    },
    BrowserWindow: vi.fn().mockImplementation(() => mockWindowInstance),
    shell: {
      openExternal: vi.fn()
    },
    nativeImage: {
      createFromPath: vi.fn().mockReturnValue({ isEmpty: () => false }),
      createEmpty: vi.fn().mockReturnValue({ isEmpty: () => true })
    },
    nativeTheme: {
      shouldUseDarkColors: true
    }
  }
})

describe('SettingsWindowManager (Standalone Configuration Window)', () => {
  let mockDb: any
  let manager: SettingsWindowManager

  beforeEach(() => {
    vi.clearAllMocks()
    mockWindowInstance.isDestroyed.mockReturnValue(false)
    mockWindowInstance.isMinimized.mockReturnValue(false)

    mockDb = {
      getSetting: vi.fn().mockImplementation((key) => {
        if (key === 'theme') return 'dark'
        return null
      })
    }

    manager = new SettingsWindowManager(
      'C:/work/softwares/jarvis/out/preload/index.cjs',
      'http://localhost:5173',
      true,
      mockDb
    )
  })

  it('initializes with null window', () => {
    expect(manager.getSettingsWindow()).toBeNull()
  })

  it('opens new window with hash #settings on dev server', () => {
    const win = manager.openSettingsWindow()
    expect(win).toBeDefined()
    expect(mockWindowInstance.loadURL).toHaveBeenCalledWith('http://localhost:5173#settings')
    expect(mockWindowInstance.show).toHaveBeenCalled()
    expect(mockWindowInstance.focus).toHaveBeenCalled()
  })

  it('navigates to specific initialTab if requested', () => {
    const win = manager.openSettingsWindow('prompts')
    expect(win).toBeDefined()
    expect(mockWindowInstance.loadURL).toHaveBeenCalledWith('http://localhost:5173#settings?tab=prompts')
  })

  it('restores, focuses, and sends navigate event if window already exists', () => {
    manager.openSettingsWindow('providers')
    mockWindowInstance.isMinimized.mockReturnValue(true)

    // Second call to open
    manager.openSettingsWindow('models')

    expect(mockWindowInstance.restore).toHaveBeenCalled()
    expect(mockWindowInstance.show).toHaveBeenCalled()
    expect(mockWindowInstance.focus).toHaveBeenCalled()
    expect(mockWebContents.send).toHaveBeenCalledWith('settings:navigate-tab', 'models')
  })

  it('updates titlebar overlay and background when theme switches', () => {
    manager.openSettingsWindow()

    manager.setSettingsTheme('light')
    expect(mockWindowInstance.setBackgroundColor).toHaveBeenCalledWith('#f2eee5')
    expect(mockWindowInstance.setTitleBarOverlay).toHaveBeenCalledWith({
      color: '#f2eee5',
      symbolColor: '#121212',
      height: 38
    })

    manager.setSettingsTheme('dark')
    expect(mockWindowInstance.setBackgroundColor).toHaveBeenCalledWith('#0d1411')
    expect(mockWindowInstance.setTitleBarOverlay).toHaveBeenCalledWith({
      color: '#0d1411',
      symbolColor: '#f3eee3',
      height: 38
    })
  })

  it('closes window cleanly and nulls reference', () => {
    manager.openSettingsWindow()
    expect(manager.getSettingsWindow()).not.toBeNull()

    manager.closeSettingsWindow()
    expect(mockWindowInstance.close).toHaveBeenCalled()
    expect(manager.getSettingsWindow()).toBeNull()
  })
})
