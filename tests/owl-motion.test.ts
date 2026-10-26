import { describe, it, expect } from 'vitest'
import { OwlMotion } from '../src/renderer/src/mascot/OwlMotion'

describe('OwlMotion', () => {
  it('hop lifts, flaps and puffs, then lands and ends', () => {
    const motion = new OwlMotion()
    motion.update(0.2)
    expect(motion.trigger('hop')).toBe(true)
    expect(motion.trigger('stretch')).toBe(false) // busy

    let peak = 0
    let maxFlap = 0
    let maxPuff = 0
    let pose = motion.update(0)
    for (let i = 0; i < 170; i++) {
      pose = motion.update(1 / 60)
      peak = Math.max(peak, pose.hopY)
      maxFlap = Math.max(maxFlap, pose.wingFlap)
      maxPuff = Math.max(maxPuff, pose.puff)
    }
    expect(peak).toBeGreaterThan(0.07)
    expect(maxFlap).toBeGreaterThan(0.8)
    expect(maxPuff).toBeGreaterThan(0.3)
    expect(motion.getAction()).toBeNull()
    expect(pose.hopY).toBeCloseTo(0, 5)
  })

  it('squints (not a hard close) during the stretch and ends', () => {
    const motion = new OwlMotion()
    motion.trigger('stretch')
    let maxLid = 0
    for (let i = 0; i < 380; i++) maxLid = Math.max(maxLid, motion.update(1 / 60).lid)
    expect(maxLid).toBeGreaterThan(0.5)
    expect(motion.getAction()).toBeNull()
  })

  it('hops on the first hover, then every third', () => {
    const motion = new OwlMotion()
    const hopped: boolean[] = []
    for (let i = 0; i < 6; i++) {
      hopped.push(motion.hover())
      for (let f = 0; f < 170; f++) motion.update(1 / 60) // let each hop finish
    }
    expect(hopped).toEqual([true, false, false, true, false, false])
  })

  it('reduce motion blocks actions', () => {
    const motion = new OwlMotion()
    motion.setReduceMotion(true)
    expect(motion.trigger('hop')).toBe(false)
  })
})
