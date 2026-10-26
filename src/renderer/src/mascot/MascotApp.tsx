import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MascotAnimationController } from './MascotAnimationController'
import { OwlMotion } from './OwlMotion'
import { GlbOwlRig } from './GlbOwlRig'
import { MascotState } from '../../../shared/types'
import { Sparkles, RefreshCw } from 'lucide-react'

export function MascotApp(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [currentState, setCurrentState] = useState<MascotState>('idle')

  // Model scale (default 0.65x of current size)
  const [scale, setScale] = useState<number>(() => {
    const saved = localStorage.getItem('jarvis_mascot_scale')
    return saved ? parseFloat(saved) : 0.65
  })

  const controllerRef = useRef<MascotAnimationController>(new MascotAnimationController())
  const motionRef = useRef<OwlMotion>(new OwlMotion())
  const isMouseDownRef = useRef<boolean>(false)
  const isResizingRef = useRef<boolean>(false)
  const startPosRef = useRef<{ screenX: number; screenY: number }>({ screenX: 0, screenY: 0 })
  const lastPosRef = useRef<{ screenX: number; screenY: number }>({ screenX: 0, screenY: 0 })
  const hasDraggedRef = useRef<boolean>(false)

  useEffect(() => {
    controllerRef.current.setBaseScale(scale)
  }, [scale])

  useEffect(() => {
    // Ensure document and body are transparent for the frameless mascot window
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    document.body.style.overflow = 'hidden'

    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth || 200
    const height = container.clientHeight || 230

    // 1. Scene & Transparent WebGL Renderer
    const scene = new THREE.Scene()
    scene.background = null // Transparent scene background

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.01, 100)
    camera.position.set(0, 0, 3.25)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'low-power'
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1

    container.appendChild(renderer.domElement)

    // 2. Controlled Studio Lighting matching Brand Palette
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1)
    keyLight.position.set(2.5, 3.0, 3.5)
    scene.add(keyLight)

    // Mint rim light extracted from owl iris highlights (#52c48e)
    const mintRimLight = new THREE.DirectionalLight(0x52c48e, 0.55)
    mintRimLight.position.set(-2.5, 1.2, 2.0)
    scene.add(mintRimLight)

    // Warm ivory bounce light extracted from breast plumage (#f5f1ee)
    const ivoryBounceLight = new THREE.DirectionalLight(0xf5f1ee, 0.35)
    ivoryBounceLight.position.set(0, -2.0, -2.5)
    scene.add(ivoryBounceLight)

    // Parent group for non-destructive procedural transforms
    const parentGroup = new THREE.Group()
    scene.add(parentGroup)
    // Inner group for the owl body pose (hop, squash, shake) under the controller transform
    const poseGroup = new THREE.Group()
    parentGroup.add(poseGroup)

    let rig: GlbOwlRig | null = null
    let feetY = 0

    let isDisposed = false
    let loadedModel: THREE.Group | null = null

    // 3. Load Approved Mascot GLB
    const loader = new GLTFLoader()
    const glbUrl = './assets/mascot/left-facing-jarvis.glb'

    const configureModel = (sceneGroup: THREE.Group): void => {
      // Center model bounds precisely at (0, 0, 0)
      const box = new THREE.Box3().setFromObject(sceneGroup)
      const center = box.getCenter(new THREE.Vector3())
      sceneGroup.position.sub(center)

      // Prevent model from ever disappearing/being hidden when rotated, scaled, or overlapping frame edges
      sceneGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.frustumCulled = false
          const mesh = child as THREE.Mesh
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => {
                m.depthWrite = true
              })
            } else {
              mesh.material.depthWrite = true
            }
          }
        }
      })
    }

    // Bones, puff morph and eyelids on the static GLB; a failure leaves the owl static instead of broken
    const rigModel = (model: THREE.Group): void => {
      feetY = new THREE.Box3().setFromObject(model).min.y
      try {
        rig = new GlbOwlRig(model)
      } catch (err) {
        console.error('[MascotApp] Owl rig failed, showing static model:', err)
      }
    }

    loader.load(
      glbUrl,
      (gltf) => {
        if (isDisposed) return
        loadedModel = gltf.scene
        configureModel(loadedModel)

        rigModel(loadedModel) // before parenting, so feetY is in model space
        poseGroup.add(loadedModel)
        setIsLoading(false)
        controllerRef.current.setState('idle')
      },
      undefined,
      (err) => {
        console.error('[MascotApp] Failed to load GLB from primary path, trying absolute fallback:', err)
        loader.load(
          '/assets/mascot/left-facing-jarvis.glb',
          (gltf) => {
            if (isDisposed) return
            loadedModel = gltf.scene
            configureModel(loadedModel)
            rigModel(loadedModel) // before parenting, so feetY is in model space
            poseGroup.add(loadedModel)
            setIsLoading(false)
            controllerRef.current.setState('idle')
          },
          undefined,
          (fatalErr) => {
            console.error('[MascotApp] Fatal GLB load failure:', fatalErr)
            setIsLoading(false)
            setLoadError('Failed to load mascot 3D model')
          }
        )
      }
    )

    // 4. Animation Loop
    let animationFrameId: number
    let lastTime = performance.now()

    const animate = (): void => {
      animationFrameId = requestAnimationFrame(animate)

      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now

      controllerRef.current.update(delta, parentGroup)

      const pose = motionRef.current.update(delta)
      rig?.apply(pose)
      // Squash/stretch around the feet so the owl stays planted
      const sy = pose.squashY + pose.breathe
      const sxz = 1 / Math.sqrt(pose.squashY)
      poseGroup.scale.set(sxz, sy, sxz)
      poseGroup.position.y = pose.hopY + feetY * (1 - sy)
      poseGroup.rotation.z = pose.shake

      renderer.render(scene, camera)
    }

    animate()

    // 5. Handle Window Resize
    const handleResize = (): void => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth || 180
      const h = containerRef.current.clientHeight || 200
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    window.addEventListener('resize', handleResize)

    // 6. Listen to Mascot State & Full-Screen Cursor Tracking from IPC
    let unsubState: (() => void) | undefined
    let unsubCursor: (() => void) | undefined

    if (window.jarvisAPI) {
      unsubState = window.jarvisAPI.onMascotStateChanged((state) => {
        setCurrentState(state)
        controllerRef.current.setState(state)
        motionRef.current.setState(state)
      })

      if (window.jarvisAPI.onMascotCursorTracking) {
        unsubCursor = window.jarvisAPI.onMascotCursorTracking((offset) => {
          // Track desktop cursor unless locally dragging window
          if (!isMouseDownRef.current && !isResizingRef.current) {
            controllerRef.current.setMousePosition(offset.nx, -offset.ny)
          }
        })
      }

      window.jarvisAPI.getSettings().then((s) => {
        if (s.reduceMotion) {
          controllerRef.current.setReduceMotion(true)
          motionRef.current.setReduceMotion(true)
        }
      })
    }

    // Cleanup
    return () => {
      isDisposed = true
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
      if (unsubState) unsubState()
      if (unsubCursor) unsubCursor()

      // Dispose GPU resources
      renderer.dispose()
      rig?.dispose()
      if (loadedModel) {
        loadedModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh
            mesh.geometry?.dispose()
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => m.dispose())
            } else {
              mesh.material?.dispose()
            }
          }
        })
      }
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement)
      }
    }
  }, [])

  // Desktop drag and click handling
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return // Left click only
    if ((e.target as HTMLElement).closest('button')) return // Don't drag if clicking buttons

    isMouseDownRef.current = true
    hasDraggedRef.current = false
    startPosRef.current = { screenX: e.screenX, screenY: e.screenY }
    lastPosRef.current = { screenX: e.screenX, screenY: e.screenY }

    const onPointerMove = (ev: PointerEvent): void => {
      if (!isMouseDownRef.current) return
      const dx = ev.screenX - lastPosRef.current.screenX
      const dy = ev.screenY - lastPosRef.current.screenY
      const dist = Math.hypot(
        ev.screenX - startPosRef.current.screenX,
        ev.screenY - startPosRef.current.screenY
      )

      if (dist > 5) {
        hasDraggedRef.current = true
        if (window.jarvisAPI) {
          window.jarvisAPI.moveMascotBy(dx, dy)
        }
        lastPosRef.current = { screenX: ev.screenX, screenY: ev.screenY }
      }
    }

    const onPointerUp = (): void => {
      isMouseDownRef.current = false
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)

      if (hasDraggedRef.current) {
        if (window.jarvisAPI) {
          window.jarvisAPI.saveMascotPosition()
        }
      } else {
        // Clean click without drag -> Toggle Quick Chat
        controllerRef.current.setState('attention')
        if (window.jarvisAPI) {
          window.jarvisAPI.toggleQuickChat()
        }
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  // Interactive Resizer Handle (<>)
  const handleResizeStart = (e: React.PointerEvent<HTMLButtonElement>): void => {
    e.stopPropagation()
    e.preventDefault()
    isResizingRef.current = true
    const startX = e.clientX
    const startY = e.clientY
    const startScale = scale

    const onPointerMove = (ev: PointerEvent): void => {
      const deltaX = ev.clientX - startX
      const deltaY = ev.clientY - startY
      // Outward drag increases size, inward decreases size
      const delta = (deltaX + deltaY) * 0.005
      const newScale = Math.min(1.4, Math.max(0.35, startScale + delta))
      setScale(newScale)
      controllerRef.current.setBaseScale(newScale)
      localStorage.setItem('jarvis_mascot_scale', newScale.toFixed(2))
    }

    const onPointerUp = (): void => {
      isResizingRef.current = false
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerEnter={() => motionRef.current.hover()}
      className="group relative w-full h-full select-none cursor-grab active:cursor-grabbing overflow-hidden"
      style={{ background: 'transparent' }}
      title="Jarvis Owl Companion — Click for Quick Chat, Drag to Move"
    >
      {/* Friendly Transparent Holographic Lazy Loader */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none animate-in fade-in duration-300">
          {/* Luminous Pulsing Owl Silhouette */}
          <div className="relative flex items-center justify-center">
            {/* Ambient soft mint aura */}
            <div className="absolute w-20 h-20 rounded-full bg-[#52c48e]/20 blur-xl animate-pulse" />

            {/* Cute holographic glass owl icon */}
            <div className="relative w-14 h-14 rounded-2xl bg-black/25 border border-[#52c48e]/50 backdrop-blur-sm flex items-center justify-center shadow-[0_0_25px_rgba(82,196,142,0.4)] animate-pulse">
              <svg
                viewBox="0 0 48 48"
                className="w-9 h-9 text-[#52c48e] drop-shadow-[0_0_8px_rgba(82,196,142,0.8)]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Owl Head & Body Silhouette */}
                <path
                  d="M13 18 L16 11 L24 15 L32 11 L35 18 C38 24 38 32 34 37 C30 41 18 41 14 37 C10 32 10 24 13 18 Z"
                  fill="rgba(82,196,142,0.18)"
                />
                {/* Friendly Eyes */}
                <circle cx="19" cy="24" r="3.5" fill="#f5f1ee" stroke="none" />
                <circle cx="29" cy="24" r="3.5" fill="#f5f1ee" stroke="none" />
                <circle cx="20" cy="24" r="1.5" fill="#0a1114" stroke="none" />
                <circle cx="30" cy="24" r="1.5" fill="#0a1114" stroke="none" />
                {/* Cute Beak */}
                <polygon points="24,27.5 22,31 26,31" fill="#f59e0b" stroke="#f59e0b" />
              </svg>
            </div>
          </div>

          {/* Friendly Minimalist Status Badge */}
          <div className="mt-2.5 flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-black/35 border border-[#52c48e]/35 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-[#52c48e] animate-ping" />
            <span className="text-[10px] font-medium tracking-wide text-[#52c48e] drop-shadow-[0_0_6px_rgba(82,196,142,0.6)]">
              Jarvis is waking up...
            </span>
          </div>
        </div>
      )}

      {/* Error Fallback */}
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-[#0a1114]/90 rounded-2xl text-xs border border-red-500/40">
          <p className="text-red-300 font-semibold text-[11px] mb-1">Mascot 3D Offline</p>
          <p className="text-[#8a9992] text-[10px] mb-2">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#3ba172] text-[#f5f1ee] font-medium text-[10px]"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Interactive Size Resizer Handle (<>) */}
      {!isLoading && !loadError && (
        <button
          onPointerDown={handleResizeStart}
          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 hover:bg-[#3ba172] text-[#f5f1ee] hover:text-black border border-[#1f3832] px-1.5 py-0.5 rounded-md cursor-nwse-resize shadow-xl flex items-center justify-center select-none z-30 pointer-events-auto"
          title="Drag outward to enlarge, inward to shrink"
        >
          <span className="font-mono text-[9px] font-bold tracking-tighter select-none">&lt;&gt;</span>
        </button>
      )}

      {/* Subtle State Badge (Only when active state occurs) */}
      {!isLoading && !loadError && currentState !== 'idle' && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#0a1114]/90 border border-[#1f3832] text-[#f5f1ee] shadow-md flex items-center space-x-1 animate-in fade-in duration-150">
            {currentState === 'thinking' && (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-[#3ba172] animate-ping"></span>
                <span className="text-[#52c48e]">Thinking</span>
              </>
            )}
            {currentState === 'attention' && <span className="text-[#52c48e]">Ready</span>}
            {currentState === 'working' && <span className="text-[#3ba172]">Working</span>}
            {currentState === 'needsApproval' && (
              <span className="text-amber-300 font-semibold">Approval Needed</span>
            )}
            {currentState === 'completed' && <span className="text-[#3ba172]">Done</span>}
          </span>
        </div>
      )}
    </div>
  )
}
