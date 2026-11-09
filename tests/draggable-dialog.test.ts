import { describe, it, expect } from 'vitest'
import { clampDialogCoordinates } from '../src/renderer/src/components/ui/Dialog'

describe('clampDialogCoordinates (Modal & Mini Windows Drag Clamping Engine)', () => {
  it('returns exact offset when within safe viewport bounds', () => {
    // 1920x1080 screen, 800x600 modal
    // maxOffsetX = (1920 - 800) / 2 - 12 = 560 - 12 = 548
    // maxOffsetY = (1080 - 600) / 2 - 12 = 240 - 12 = 228
    const clamped = clampDialogCoordinates(100, -50, 800, 600, 1920, 1080)
    expect(clamped.x).toBe(100)
    expect(clamped.y).toBe(-50)
  })

  it('clamps positive horizontal and vertical drag when exceeding viewport limits', () => {
    // Desired drag is way too far right (+1000px) and down (+800px)
    const clamped = clampDialogCoordinates(1000, 800, 800, 600, 1920, 1080)
    expect(clamped.x).toBe(548) // Clamped to 548px max offset
    expect(clamped.y).toBe(228) // Clamped to 228px max offset
  })

  it('clamps negative horizontal and vertical drag when dragged off top-left edges', () => {
    // Desired drag is way too far left (-1200px) and up (-900px)
    const clamped = clampDialogCoordinates(-1200, -900, 800, 600, 1920, 1080)
    expect(clamped.x).toBe(-548)
    expect(clamped.y).toBe(-228)
  })

  it('locks offset to 0 when viewport is smaller than modal dimensions', () => {
    // 600x500 small window, 800x600 modal
    // In this case (viewport - modal) <= 0, so maxOffset is 0.
    // The dialog remains centered at (0, 0) and relies on internal flexbox scrollbars
    const clamped = clampDialogCoordinates(150, 100, 800, 600, 600, 500)
    expect(clamped.x).toBe(0)
    expect(clamped.y).toBe(0)
  })

  it('preserves center coordinate (0, 0) as valid resting position', () => {
    const clamped = clampDialogCoordinates(0, 0, 800, 600, 1920, 1080)
    expect(clamped.x).toBe(0)
    expect(clamped.y).toBe(0)
  })

  it('handles square and ultra-wide aspect ratios gracefully', () => {
    // Ultra-wide 3440x1440
    const clampedWide = clampDialogCoordinates(1000, 200, 900, 700, 3440, 1440)
    // maxOffsetX = (3440 - 900) / 2 - 12 = 1270 - 12 = 1258
    // maxOffsetY = (1440 - 700) / 2 - 12 = 370 - 12 = 358
    expect(clampedWide.x).toBe(1000)
    expect(clampedWide.y).toBe(200)

    // Ultra-wide drag overflow
    const clampedWideOverflow = clampDialogCoordinates(2000, -500, 900, 700, 3440, 1440)
    expect(clampedWideOverflow.x).toBe(1258)
    expect(clampedWideOverflow.y).toBe(-358)
  })
})
