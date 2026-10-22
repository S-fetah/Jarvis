import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MascotAnimationController } from './MascotAnimationController'
import { MascotState } from '../../../shared/types'
import { Sparkles, RefreshCw } from 'lucide-react'

export function MascotApp(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [currentState, setCurrentState] = useState<MascotState>('idle')

  const controllerRef = useRef<MascotAnimationController>(new MascotAnimationController())
  const isMouseDownRef = useRef<boolean>(false)
  const startPosRef = useRef<{ screenX: number; screenY: number }>({ screenX: 0, screenY: 0 })
  const lastPosRef = useRef<{ screenX: number; screenY: number }>({ screenX: 0, screenY: 0 })
  const hasDraggedRef = useRef<boolean>(false)

  useEffect(() => {
    // Ensure document and body are transparent for the frameless mascot window
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    document.body.style.overflow = 'hidden'

    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth || 180
    const height = container.clientHeight || 200

    // 1. Scene & Transparent WebGL Renderer
    const scene = new THREE.Scene()
    scene.background = null // Transparent scene background

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50)
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

    // 2. Controlled Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1)
    keyLight.position.set(2.5, 3.0, 3.5)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0x818cf8, 0.6)
    fillLight.position.set(-2.5, 1.2, 2.0)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xfcd34d, 0.4)
    rimLight.position.set(0, -2.0, -2.5)
    scene.add(rimLight)

    // Parent group for non-destructive procedural transforms
    const parentGroup = new THREE.Group()
    scene.add(parentGroup)

    let isDisposed = false
    let loadedModel: THREE.Group | null = null

    // 3. Load Approved Mascot GLB
    const loader = new GLTFLoader()
    const glbUrl = './assets/mascot/left-facing-jarvis.glb'

    loader.load(
      glbUrl,
      (gltf) => {
        if (isDisposed) return
        loadedModel = gltf.scene

        // Center model bounds precisely at (0, 0, 0)
        const box = new THREE.Box3().setFromObject(loadedModel)
        const center = box.getCenter(new THREE.Vector3())
        loadedModel.position.sub(center)

        parentGroup.add(loadedModel)
        setIsLoading(false)
        controllerRef.current.setState('idle')
      },
      undefined,
      (err) => {
        console.error('[MascotApp] Failed to load GLB from primary path, trying absolute fallback:', err)
        // Fallback relative path
        loader.load(
          '/assets/mascot/left-facing-jarvis.glb',
          (gltf) => {
            if (isDisposed) return
            loadedModel = gltf.scene
            const box = new THREE.Box3().setFromObject(loadedModel)
            const center = box.getCenter(new THREE.Vector3())
            loadedModel.position.sub(center)
            parentGroup.add(loadedModel)
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

    // 6. Listen to Mascot State from IPC
    let unsubState: (() => void) | undefined
    if (window.jarvisAPI) {
      unsubState = window.jarvisAPI.onMascotStateChanged((state) => {
        setCurrentState(state)
        controllerRef.current.setState(state)
      })

      window.jarvisAPI.getSettings().then((s) => {
        if (s.reduceMotion) {
          controllerRef.current.setReduceMotion(true)
        }
      })
    }

    // Cleanup
    return () => {
      isDisposed = true
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
      if (unsubState) unsubState()

      // Dispose GPU resources
      renderer.dispose()
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

  // Mouse hover tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const normY = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
    controllerRef.current.setMousePosition(normX, normY)

    // Handle Window Dragging
    if (isMouseDownRef.current && window.jarvisAPI) {
      const dx = e.screenX - lastPosRef.current.screenX
      const dy = e.screenY - lastPosRef.current.screenY
      const totalDist = Math.hypot(
        e.screenX - startPosRef.current.screenX,
        e.screenY - startPosRef.current.screenY
      )

      if (totalDist > 4) {
        hasDraggedRef.current = true
        window.jarvisAPI.moveMascotBy(dx, dy)
        lastPosRef.current = { screenX: e.screenX, screenY: e.screenY }
      }
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return // Left click only
    isMouseDownRef.current = true
    hasDraggedRef.current = false
    startPosRef.current = { screenX: e.screenX, screenY: e.screenY }
    lastPosRef.current = { screenX: e.screenX, screenY: e.screenY }
  }

  const handleMouseUp = (): void => {
    if (!isMouseDownRef.current) return
    isMouseDownRef.current = false

    if (!hasDraggedRef.current) {
      // User clicked without dragging -> Open Quick Chat!
      controllerRef.current.setState('attention')
      if (window.jarvisAPI) {
        window.jarvisAPI.toggleQuickChat()
      }
    } else {
      // Finished dragging -> Save position
      if (window.jarvisAPI) {
        window.jarvisAPI.saveMascotPosition()
      }
    }
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        isMouseDownRef.current = false
        controllerRef.current.setMousePosition(0, 0)
      }}
      className="relative w-full h-full select-none cursor-grab active:cursor-grabbing overflow-hidden"
      style={{ background: 'transparent' }}
      title="Jarvis Owl Companion — Click for Quick Chat, Drag to Move"
    >
      {/* Loading Indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400">
          <div className="relative">
            <Sparkles className="w-6 h-6 text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <span className="text-[10px] mt-1.5 font-mono text-indigo-300/80 bg-black/60 px-2 py-0.5 rounded-full">
            Awakening Owl...
          </span>
        </div>
      )}

      {/* Error Fallback */}
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-black/80 rounded-2xl text-xs border border-red-500/40">
          <p className="text-red-300 font-semibold text-[11px] mb-1">Mascot 3D Offline</p>
          <p className="text-slate-400 text-[10px] mb-2">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-600 text-white text-[10px]"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Subtle State Badge (Only when active state occurs) */}
      {!isLoading && !loadError && currentState !== 'idle' && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-black/75 border border-indigo-500/40 text-indigo-200 shadow-md flex items-center space-x-1 animate-in fade-in duration-150">
            {currentState === 'thinking' && (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping"></span>
                <span>Thinking</span>
              </>
            )}
            {currentState === 'attention' && <span>Ready</span>}
            {currentState === 'working' && <span>Working</span>}
            {currentState === 'needsApproval' && (
              <span className="text-amber-300 font-semibold">Approval Needed</span>
            )}
            {currentState === 'completed' && <span className="text-emerald-300">Done</span>}
          </span>
        </div>
      )}
    </div>
  )
}
