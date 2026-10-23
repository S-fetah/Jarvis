import * as THREE from 'three'
import { MascotState } from '../../../shared/types'

export class MascotAnimationController {
  private state: MascotState = 'idle'
  private elapsedTime: number = 0
  private targetPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
  private currentPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
  private targetRotation: THREE.Euler = new THREE.Euler(0, 0, 0)
  private currentRotation: THREE.Euler = new THREE.Euler(0, 0, 0)
  private targetScale: THREE.Vector3 = new THREE.Vector3(0.65, 0.65, 0.65)
  private currentScale: THREE.Vector3 = new THREE.Vector3(0.65, 0.65, 0.65)
  private baseScale: number = 0.65

  private mouseTarget: THREE.Vector2 = new THREE.Vector2(0, 0)
  private currentMouse: THREE.Vector2 = new THREE.Vector2(0, 0)
  private completionTimer: number = 0
  private reduceMotion: boolean = false

  constructor() {
    this.reset()
  }

  public setReduceMotion(reduce: boolean): void {
    this.reduceMotion = reduce
  }

  public setBaseScale(scale: number): void {
    this.baseScale = Math.max(0.25, Math.min(1.8, scale))
  }

  public getBaseScale(): number {
    return this.baseScale
  }

  public setState(state: MascotState): void {
    if (this.state === state) return
    this.state = state

    if (state === 'completed') {
      this.completionTimer = 1.6 // Play celebration acknowledgment for 1.6s then return to idle
    }
  }

  public getState(): MascotState {
    return this.state
  }

  public setMousePosition(normX: number, normY: number): void {
    // normX, normY in [-1, 1]
    this.mouseTarget.set(
      THREE.MathUtils.clamp(normX, -1, 1),
      THREE.MathUtils.clamp(normY, -1, 1)
    )
  }

  public update(delta: number, rootGroup: THREE.Group): void {
    const dt = Math.min(delta, 0.1)
    this.elapsedTime += dt

    if (this.completionTimer > 0) {
      this.completionTimer -= dt
      if (this.completionTimer <= 0) {
        this.state = 'idle'
      }
    }

    // Smoothly track mouse target
    this.currentMouse.lerp(this.mouseTarget, dt * 4.0)

    const motionFactor = this.reduceMotion ? 0.2 : 1.0
    const t = this.elapsedTime

    // Base procedural resting posture
    let hoverY = Math.sin(t * 1.6) * 0.04 * motionFactor
    let breathePitch = Math.sin(t * 0.8) * 0.02 * motionFactor
    let breatheYaw = Math.cos(t * 0.4) * 0.03 * motionFactor
    let breatheRoll = 0
    let scaleMultiplier = 1.0

    switch (this.state) {
      case 'idle':
        // Gentle, calm floating
        break

      case 'attention':
        // Alert, upright posture, leans forward slightly
        hoverY = (Math.sin(t * 2.0) * 0.02 + 0.02) * motionFactor
        breathePitch = 0.06 * motionFactor
        scaleMultiplier = 1.04
        break

      case 'thinking':
        // Contemplative subtle rhythmic pacing & head tilt
        hoverY = Math.sin(t * 2.5) * 0.03 * motionFactor
        breathePitch = Math.sin(t * 3.0) * 0.03 * motionFactor
        breatheRoll = (Math.sin(t * 1.2) * 0.04 + 0.05) * motionFactor
        breatheYaw = Math.cos(t * 1.0) * 0.06 * motionFactor
        break

      case 'working':
        // Focused steady micro-hovering
        hoverY = Math.sin(t * 3.2) * 0.025 * motionFactor
        breathePitch = 0.04 * motionFactor
        break

      case 'needsApproval':
        // Attentive pulse, looking alert
        hoverY = (Math.sin(t * 4.0) * 0.03 + 0.03) * motionFactor
        breathePitch = 0.08 * motionFactor
        scaleMultiplier = 1.05
        break

      case 'completed': {
        // Celebratory dip and cheerful upright nod
        const phase = 1.6 - this.completionTimer
        if (phase < 0.4) {
          hoverY = -0.06 * (phase / 0.4)
          breathePitch = 0.12
        } else if (phase < 1.0) {
          hoverY = 0.06 * (1 - (phase - 0.4) / 0.6)
          breathePitch = -0.04
          scaleMultiplier = 1.06
        }
        break
      }

      case 'error':
        // Restrained confused head tilt
        breatheRoll = -0.08 * motionFactor
        breathePitch = -0.04 * motionFactor
        break

      case 'loading':
      case 'hidden':
        scaleMultiplier = 0.001
        break
    }

    // Combine procedural motion with extended full-screen desktop cursor tracking
    const lookYaw = this.currentMouse.x * 0.55 * motionFactor
    const lookPitch = -this.currentMouse.y * 0.40 * motionFactor

    this.targetPosition.set(0, hoverY, 0)
    this.targetRotation.set(
      breathePitch + lookPitch,
      breatheYaw + lookYaw,
      breatheRoll
    )
    const effectiveScale = this.baseScale * scaleMultiplier
    this.targetScale.set(effectiveScale, effectiveScale, effectiveScale)

    // Smooth critically-damped interpolation
    const lerpSpeed = dt * 6.0
    this.currentPosition.lerp(this.targetPosition, lerpSpeed)
    this.currentScale.lerp(this.targetScale, lerpSpeed)

    // Euler rotation interpolation
    this.currentRotation.x = THREE.MathUtils.lerp(this.currentRotation.x, this.targetRotation.x, lerpSpeed)
    this.currentRotation.y = THREE.MathUtils.lerp(this.currentRotation.y, this.targetRotation.y, lerpSpeed)
    this.currentRotation.z = THREE.MathUtils.lerp(this.currentRotation.z, this.targetRotation.z, lerpSpeed)

    rootGroup.position.copy(this.currentPosition)
    rootGroup.rotation.copy(this.currentRotation)
    rootGroup.scale.copy(this.currentScale)
  }

  public reset(): void {
    this.elapsedTime = 0
    this.targetPosition.set(0, 0, 0)
    this.currentPosition.set(0, 0, 0)
    this.targetRotation.set(0, 0, 0)
    this.currentRotation.set(0, 0, 0)
    this.targetScale.set(this.baseScale, this.baseScale, this.baseScale)
    this.currentScale.set(this.baseScale, this.baseScale, this.baseScale)
  }
}
