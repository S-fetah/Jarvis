import * as THREE from 'three'
import { MascotState } from '../../../shared/types'

export type OwlAction = 'hop' | 'stretch'

/** Everything a rig needs to pose the owl for one frame. */
export interface OwlPose {
  hopY: number // vertical lift in model units
  squashY: number // 1 = rest, <1 squashed, >1 stretched (volume preserved on x/z)
  breathe: number
  wingFlap: number // 0 folded .. 1 fully raised
  headPitch: number // radians, negative tips the head back
  headRoll: number
  shake: number // body roll during the stretch shake-out
  puff: number // 0 sleek .. 1 feathers fully fluffed
  lid: number // 0 open .. 1 closed
}

// Hop phases in seconds: crouch, airborne, then a landing that rings down until `total`
const HOP = { crouch: 0.42, air: 0.95, total: 2.6 }
const HOP_EVERY = 3 // hops on the 1st hover, then every 3rd
const STRETCH_DURATION = 6.0
const STRETCH_EVERY = 30 // seconds (+/- 4) between idle stretches
const DOZE_AFTER = 35 // seconds without interaction before the owl gets sleepy

const smooth = (x: number): number => {
  const t = THREE.MathUtils.clamp(x, 0, 1)
  return t * t * (3 - 2 * t)
}
// Rises 0 -> 1 over [a, b], holds, falls 1 -> 0 over [c, d]
const envelope = (p: number, a: number, b: number, c: number, d: number): number =>
  smooth((p - a) / (b - a)) * (1 - smooth((p - c) / (d - c)))

/** Timing brain for the owl: hover hop, idle blink/stretch/doze, state moods. Rig-agnostic. */
export class OwlMotion {
  private state: MascotState = 'idle'
  private action: OwlAction | null = null
  private actionTime = 0
  private time = 0
  private idleTime = 0
  private nextBlink = 2.5
  private blinkTime = -1
  private doubleBlink = false
  private nextStretch = STRETCH_EVERY + (Math.random() - 0.5) * 8
  private hovers = 0
  private lidLevel = 0
  private reduceMotion = false

  public setState(state: MascotState): void {
    if (state === this.state) return
    this.state = state
    this.idleTime = 0
    if (state === 'completed') this.trigger('hop')
  }

  public setReduceMotion(reduce: boolean): void {
    this.reduceMotion = reduce
  }

  /** Plays a one-shot action unless another one is still running. */
  public trigger(action: OwlAction): boolean {
    this.idleTime = 0
    if (this.action || this.reduceMotion) return false
    this.action = action
    this.actionTime = 0
    return true
  }

  /** Pointer entered the owl: hop on the first hover, then only every few, so it never feels twitchy. */
  public hover(): boolean {
    const due = this.hovers % HOP_EVERY === 0
    this.hovers++
    this.idleTime = 0
    return due && this.trigger('hop')
  }

  public getAction(): OwlAction | null {
    return this.action
  }

  public update(delta: number): OwlPose {
    const dt = Math.min(delta, 0.1)
    this.time += dt
    this.idleTime += dt

    // Ambient idle stretch every so often
    if (this.state === 'idle' && !this.action) {
      this.nextStretch -= dt
      if (this.nextStretch <= 0) {
        this.nextStretch = STRETCH_EVERY + (Math.random() - 0.5) * 8
        this.trigger('stretch')
      }
    }

    let hopY = 0
    let squashY = 1
    let wingFlap = 0
    let headPitch = 0
    let headRoll = 0
    let shake = 0
    let puff = 0
    let actionLid = 0
    let eyeWide = 0

    if (this.action) {
      this.actionTime += dt
      const t = this.actionTime

      if (this.action === 'hop') {
        if (t < HOP.crouch) {
          // Anticipation: a soft sink and head dip, feathers start to lift
          const c = smooth(t / HOP.crouch)
          squashY = 1 - 0.07 * c
          headPitch = 0.05 * c
          puff = 0.25 * c
        } else if (t < HOP.crouch + HOP.air) {
          // Airborne: small, floaty arc with one slow, full wing flop
          const air = (t - HOP.crouch) / HOP.air
          hopY = Math.sin(air * Math.PI) * 0.085
          squashY = 1 + 0.03 * Math.sin(air * Math.PI) - 0.07 * (1 - smooth(air / 0.25))
          wingFlap = envelope(air, 0, 0.2, 0.75, 1) * (0.5 - 0.5 * Math.cos(air * Math.PI * 2))
          headPitch = 0.05 * (1 - smooth(air / 0.35)) - 0.05 * Math.sin(air * Math.PI)
          puff = 0.25 * (1 - smooth(air / 0.6))
          eyeWide = 1
        } else {
          // Landing: gentle cushion that settles in one slow bounce, feathers puff then smooth down
          const l = t - HOP.crouch - HOP.air
          squashY = 1 - 0.07 * Math.exp(-3.2 * l) * Math.sin(l * Math.PI * 2 * 1.3)
          headPitch = 0.05 * Math.exp(-3 * l) * Math.sin(l * Math.PI * 2 * 1.1)
          puff = 0.7 * (1 - Math.exp(-10 * l)) * Math.exp(-2 * l) * (1 - smooth((t - 2.3) / 0.3))
          eyeWide = 1 - smooth(l / 0.8)
        }
        if (t >= HOP.total) this.action = null
      } else {
        // Inhale: slowly rise, tip the head back, sleepy squint, wings ease open with a lazy sway
        const reach = envelope(t, 0.4, 2.0, 3.0, 4.0)
        squashY = 1 + 0.06 * reach
        headPitch = -0.18 * reach
        headRoll = 0.05 * Math.sin(t * Math.PI * 2 * 0.3) * reach
        wingFlap = reach * (0.55 + 0.06 * Math.sin(t * Math.PI * 2 * 0.5))
        actionLid = 0.6 * envelope(t, 0.3, 1.6, 3.0, 3.8)
        // Exhale into an unhurried ruffle: feathers bloom and settle with two slow rocks
        if (t > 3.8) {
          const r = t - 3.8
          const fadeOut = 1 - smooth((t - 5.4) / 0.6)
          puff = 0.7 * (1 - Math.exp(-6 * r)) * Math.exp(-1.3 * r) * fadeOut
          shake = 0.022 * Math.exp(-1.6 * r) * Math.sin(r * Math.PI * 2 * 1.2) * fadeOut
        }
        if (t >= STRETCH_DURATION) this.action = null
      }
    }

    // Eyelids: state baseline + doze + blink + action
    let baseLid = 0
    if (this.state === 'thinking') baseLid = 0.38
    if (this.state === 'working') baseLid = 0.22
    if (this.state === 'error') baseLid = 0.3

    const dozing = this.state === 'idle' && this.idleTime > DOZE_AFTER && !this.action
    if (dozing) baseLid = 0.62 + 0.25 * (0.5 + 0.5 * Math.sin(this.time * 0.6))

    this.nextBlink -= dt
    if (this.nextBlink <= 0 && this.blinkTime < 0) {
      this.blinkTime = 0
      this.doubleBlink = Math.random() < 0.2
      this.nextBlink = 2.2 + Math.random() * 4
    }
    let blink = 0
    if (this.blinkTime >= 0) {
      this.blinkTime += dt
      const span = this.doubleBlink ? 0.42 : 0.16
      const local = this.doubleBlink ? (this.blinkTime % 0.21) / 0.21 : this.blinkTime / 0.16
      blink = Math.sin(Math.min(local, 1) * Math.PI)
      if (this.blinkTime >= span) this.blinkTime = -1
    }

    const targetLid = Math.max(baseLid * (1 - eyeWide), actionLid, blink)
    // Blinks snap, slow lid changes ease
    this.lidLevel =
      blink > this.lidLevel
        ? targetLid
        : THREE.MathUtils.lerp(this.lidLevel, targetLid, Math.min(1, dt * 6))

    return {
      hopY,
      squashY,
      breathe: this.reduceMotion ? 0 : Math.sin(this.time * 1.8) * 0.012,
      wingFlap,
      headPitch: headPitch + (dozing ? Math.sin(this.time * 0.6) * 0.06 + 0.08 : 0),
      headRoll: headRoll + (this.state === 'thinking' ? 0.12 : 0),
      shake,
      puff,
      lid: this.lidLevel
    }
  }
}
