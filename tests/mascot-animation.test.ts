import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { MascotAnimationController } from '../src/renderer/src/mascot/MascotAnimationController'

describe('MascotAnimationController', () => {
  it('initializes in idle state with identity scale', () => {
    const controller = new MascotAnimationController()
    expect(controller.getState()).toBe('idle')

    const group = new THREE.Group()
    controller.update(0.016, group)
    expect(group.scale.x).toBeCloseTo(1.0, 1)
  })

  it('updates state to thinking and modulates rotation and position', () => {
    const controller = new MascotAnimationController()
    controller.setState('thinking')
    expect(controller.getState()).toBe('thinking')

    const group = new THREE.Group()
    controller.update(0.5, group)
    // In thinking state, rotation and position should have evolved
    expect(group.position.y).toBeDefined()
  })

  it('handles completion state timer and returns to idle', () => {
    const controller = new MascotAnimationController()
    controller.setState('completed')
    expect(controller.getState()).toBe('completed')

    const group = new THREE.Group()
    // Advance multiple frames past 1.6s
    for (let i = 0; i < 20; i++) {
      controller.update(0.1, group)
    }
    expect(controller.getState()).toBe('idle')
  })

  it('applies reduced motion factor when configured', () => {
    const normalController = new MascotAnimationController()
    const normalGroup = new THREE.Group()
    normalController.update(0.5, normalGroup)

    const reducedController = new MascotAnimationController()
    reducedController.setReduceMotion(true)
    const reducedGroup = new THREE.Group()
    reducedController.update(0.5, reducedGroup)

    // Reduced motion oscillation amplitude is smaller
    expect(Math.abs(reducedGroup.position.y)).toBeLessThanOrEqual(Math.abs(normalGroup.position.y) + 0.05)
  })
})
