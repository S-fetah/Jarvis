import * as THREE from 'three'
import { OwlPose } from './OwlMotion'

/**
 * Runtime rig for the single-mesh mascot GLB (no bones/morphs in the file).
 * Builds a 4-bone skeleton (base, head, two wings) with weights derived from vertex
 * position + texture colour, a "puff" morph target that fluffs the feathers, and
 * eyelids placed over the painted eyes (found by their mint iris texels).
 * ponytail: tuned for left-facing-jarvis.glb; a different model needs RIG constants re-tuned.
 */
const RIG = {
  headPivot: new THREE.Vector3(0.28, 0.18, 0.15),
  headFrom: 0.1, // head weight ramps in over this y range
  headTo: 0.3,
  // Front wing (model's right, viewer's left) and back wing
  wings: [
    { pivot: new THREE.Vector3(-0.2, 0.18, 0.2), axis: new THREE.Vector3(0.15, 0.35, 1), side: -1 },
    { pivot: new THREE.Vector3(0.58, 0.16, -0.05), axis: new THREE.Vector3(-0.3, 0.35, 1), side: 1 }
  ],
  flapAngle: 0.22, // radians at wingFlap = 1
  puffDistance: 0.02,
  lidScale: 1.32 // lid radius relative to the mint iris radius (covers the dark ring)
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

interface Lid {
  mesh: THREE.Mesh
  radius: number
}

const LID_COLS = 24
// Rows of the lid strip from the top arc down to the lash line
const LID_ROWS = 4

export class GlbOwlRig {
  private readonly mesh: THREE.SkinnedMesh
  private readonly bones: THREE.Bone[]
  private readonly wingAxes: THREE.Vector3[]
  private readonly lids: Lid[] = []

  constructor(scene: THREE.Object3D, debugWeights = false) {
    const source = scene.getObjectByProperty('isMesh', true) as THREE.Mesh | undefined
    if (!source) throw new Error('GLB has no mesh')
    const geometry = source.geometry
    const material = source.material as THREE.MeshStandardMaterial
    const pos = geometry.getAttribute('position')
    const nrm = geometry.getAttribute('normal')
    const color = sampleVertexColors(geometry, material.map)

    // --- Skeleton ---
    const base = new THREE.Bone()
    const head = new THREE.Bone()
    head.position.copy(RIG.headPivot)
    base.add(head)
    const wings = RIG.wings.map((w) => {
      const b = new THREE.Bone()
      b.position.copy(w.pivot)
      base.add(b)
      return b
    })
    this.bones = [base, head, ...wings]
    this.wingAxes = RIG.wings.map((w) => w.axis.clone().normalize())

    // --- Weights + puff deltas ---
    const skinIndex = new Uint16Array(pos.count * 4)
    const skinWeight = new Float32Array(pos.count * 4)
    const puff = new Float32Array(pos.count * 3)
    const debug = debugWeights ? new Float32Array(pos.count * 3) : null
    const p = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i)
      const [r, g, b] = [color[i * 3], color[i * 3 + 1], color[i * 3 + 2]]
      const lum = 0.3 * r + 0.59 * g + 0.11 * b
      const ivory = smoothstep(0.55, 0.75, lum) // chest/face stay put on wing flaps

      const wHead = smoothstep(RIG.headFrom, RIG.headTo, p.y)
      const wWing = RIG.wings.map((w) => {
        const outward = (p.x - w.pivot.x) * w.side
        const reach = smoothstep(0.02, 0.3, outward + Math.max(0, w.pivot.y - p.y) * 0.5)
        const below = smoothstep(w.pivot.y + 0.08, w.pivot.y - 0.12, p.y)
        // Legs and talons stand under the front wing: keep them planted
        const legs = smoothstep(-0.5, -0.62, p.y) * smoothstep(-0.4, -0.28, p.x)
        // Ivory belly tucked under the wing tips travels with them (no stretched white seam); the chest stays
        const pinned = ivory * smoothstep(-0.5, -0.3, p.x * -w.side)
        return reach * below * (1 - pinned) * (1 - wHead) * (1 - legs)
      })
      const wBase = Math.max(0, 1 - wHead - wWing[0] - wWing[1])
      const ws = [wBase, wHead, wWing[0], wWing[1]]
      const sum = ws.reduce((a, c) => a + c, 0)
      for (let k = 0; k < 4; k++) {
        skinIndex[i * 4 + k] = k
        skinWeight[i * 4 + k] = ws[k] / sum
      }

      // Fluff the green plumage most, the chest a little, never the eyes/beak/talons (dark or mint)
      const mint = g - r > 0.23 ? 1 : 0
      const fluff =
        (1 - mint) * smoothstep(0.08, 0.2, lum) * (ivory > 0.5 ? 0.4 : 1) * (1 - 0.8 * wHead)
      const jitter = 0.8 + 0.2 * hash3(p.x, p.y, p.z) // same position => same jitter, so no seams crack
      const d = RIG.puffDistance * fluff * jitter
      puff[i * 3] = nrm.getX(i) * d
      puff[i * 3 + 1] = nrm.getY(i) * d
      puff[i * 3 + 2] = nrm.getZ(i) * d

      if (debug) {
        debug[i * 3] = wWing[0] + wHead * 0.2
        debug[i * 3 + 1] = wHead
        debug[i * 3 + 2] = wWing[1] + wHead * 0.2
      }
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4))
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4))
    geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(puff, 3)]
    geometry.morphTargetsRelative = true

    let meshMaterial: THREE.Material = material
    if (debug) {
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(debug, 3))
      meshMaterial = new THREE.MeshBasicMaterial({ vertexColors: true })
    }

    // --- Swap in a SkinnedMesh ---
    this.mesh = new THREE.SkinnedMesh(geometry, meshMaterial)
    this.mesh.name = source.name
    this.mesh.position.copy(source.position)
    this.mesh.quaternion.copy(source.quaternion)
    this.mesh.scale.copy(source.scale)
    this.mesh.frustumCulled = false
    source.parent!.add(this.mesh)
    source.removeFromParent()
    this.mesh.add(base)
    this.mesh.updateMatrixWorld(true)
    this.mesh.bind(new THREE.Skeleton(this.bones))
    this.mesh.updateMorphTargets()

    this.buildLids(geometry, color, head)
  }

  public apply(pose: OwlPose): void {
    const [, head, ...wings] = this.bones
    head.rotation.set(pose.headPitch, 0, pose.headRoll)
    const angle = pose.wingFlap * RIG.flapAngle
    wings.forEach((w, k) =>
      w.quaternion.setFromAxisAngle(this.wingAxes[k], angle * RIG.wings[k].side)
    )
    this.mesh.morphTargetInfluences![0] = pose.puff
    for (const lid of this.lids) updateLid(lid, pose.lid)
  }

  public dispose(): void {
    for (const lid of this.lids) {
      lid.mesh.geometry.dispose()
      ;(lid.mesh.material as THREE.Material).dispose()
    }
  }

  private buildLids(geometry: THREE.BufferGeometry, color: Float32Array, head: THREE.Bone): void {
    const pos = geometry.getAttribute('position')
    const nrm = geometry.getAttribute('normal')
    // Iris texels: strongly mint, on the face (excludes mint highlights on the wing edges)
    const iris: number[] = []
    for (let i = 0; i < pos.count; i++) {
      const [r, g, b] = [color[i * 3], color[i * 3 + 1], color[i * 3 + 2]]
      if (g - r > 0.23 && g > 0.55 && b > 0.4 && pos.getY(i) > RIG.headTo) iris.push(i)
    }
    if (iris.length < 20) return // eyes not found: skip lids rather than float them in the wrong place

    // Two clusters split at the mean x (2-means, a few iterations)
    let split = iris.reduce((a, i) => a + pos.getX(i), 0) / iris.length
    let groups: number[][] = []
    for (let it = 0; it < 5; it++) {
      groups = [iris.filter((i) => pos.getX(i) < split), iris.filter((i) => pos.getX(i) >= split)]
      if (!groups[0].length || !groups[1].length) return
      const mean = (g: number[]): number => g.reduce((a, i) => a + pos.getX(i), 0) / g.length
      split = (mean(groups[0]) + mean(groups[1])) / 2
    }

    const lidColor = new THREE.Color(0x2a5e4f) // head-feather green

    const v = new THREE.Vector3()
    for (const group of groups) {
      const center = new THREE.Vector3()
      const normal = new THREE.Vector3()
      for (const i of group) {
        center.add(v.fromBufferAttribute(pos, i))
        normal.add(v.fromBufferAttribute(nrm, i))
      }
      center.divideScalar(group.length)
      normal.normalize()
      let radius = 0
      for (const i of group) {
        v.fromBufferAttribute(pos, i).sub(center)
        radius = Math.max(radius, v.addScaledVector(normal, -v.dot(normal)).length())
      }
      // The lid must clear everything under it, including the bulging pupil/highlight
      let front = 0
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).sub(center)
        const depth = v.dot(normal)
        if (v.addScaledVector(normal, -depth).length() < radius * RIG.lidScale)
          front = Math.max(front, depth)
      }

      const lidGeo = new THREE.BufferGeometry()
      const verts = (LID_COLS + 1) * LID_ROWS
      lidGeo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(new Float32Array(verts * 3), 3)
      )
      const colors = new Float32Array(verts * 3)
      const lash = new THREE.Color(0x0b1311)
      for (let row = 0; row < LID_ROWS; row++) {
        const c = row < 2 ? lidColor : lash
        for (let col = 0; col <= LID_COLS; col++)
          c.toArray(colors, (row * (LID_COLS + 1) + col) * 3)
      }
      lidGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
      const index: number[] = []
      // Quads for rows 0-1 (lid) and 2-3 (lash); rows 1 and 2 share positions, so the colour edge is crisp
      for (const row of [0, 2]) {
        for (let col = 0; col < LID_COLS; col++) {
          const a = row * (LID_COLS + 1) + col
          const b = a + LID_COLS + 1
          index.push(a, b, a + 1, a + 1, b, b + 1)
        }
      }
      lidGeo.setIndex(index)

      const lidMesh = new THREE.Mesh(
        lidGeo,
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.6,
          side: THREE.DoubleSide
        })
      )
      lidMesh.frustumCulled = false
      lidMesh.visible = false
      // Orient the lid plane to the eye: +z = eye normal, +y = world up projected onto the eye plane
      const up = new THREE.Vector3(0, 1, 0).addScaledVector(normal, -normal.y).normalize()
      const right = new THREE.Vector3().crossVectors(up, normal)
      lidMesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal))
      lidMesh.position
        .copy(center)
        .addScaledVector(normal, front + 0.012)
        .sub(RIG.headPivot)
      head.add(lidMesh)
      this.lids.push({ mesh: lidMesh, radius: radius * RIG.lidScale })
    }
  }
}

/** Rebuilds the lid strip: circle cap above a lower edge that sweeps down with `level`. */
function updateLid(lid: Lid, level: number): void {
  lid.mesh.visible = level > 0.02
  if (!lid.mesh.visible) return
  const R = lid.radius
  // Lower edge sweeps down to below the centre; a sliver of the ring stays visible under the lash when shut
  const edge = R - 1.75 * R * Math.min(level, 1)
  const sag = 0.28 * R * Math.min(level, 1) // lash curves down like a closed eye
  const lashWidth = 0.08 * R
  const attr = lid.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
  for (let col = 0; col <= LID_COLS; col++) {
    const x = -R + (2 * R * col) / LID_COLS
    const half = Math.sqrt(Math.max(0, R * R - x * x))
    const top = half
    const bottom = Math.max(-half, Math.min(top, edge - sag * (1 - (x / R) ** 2)))
    const lashTop = Math.min(top, bottom + lashWidth)
    const ys = [top, lashTop, lashTop, bottom]
    for (let row = 0; row < LID_ROWS; row++) attr.setXYZ(row * (LID_COLS + 1) + col, x, ys[row], 0)
  }
  attr.needsUpdate = true
}

function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** Per-vertex texture colour (0..1 RGB). Falls back to mid-grey when the texture is unreadable. */
function sampleVertexColors(
  geometry: THREE.BufferGeometry,
  map: THREE.Texture | null
): Float32Array {
  const uv = geometry.getAttribute('uv')
  const count = geometry.getAttribute('position').count
  const out = new Float32Array(count * 3).fill(0.3)
  const image = map?.image as CanvasImageSource & { width: number; height: number }
  if (!uv || !image?.width || typeof document === 'undefined') return out
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return out
  ctx.drawImage(image, 0, 0)
  const px = ctx.getImageData(0, 0, image.width, image.height).data
  const flip = map!.flipY
  for (let i = 0; i < count; i++) {
    const u = THREE.MathUtils.euclideanModulo(uv.getX(i), 1)
    const v = THREE.MathUtils.euclideanModulo(uv.getY(i), 1)
    const x = Math.min(image.width - 1, Math.floor(u * image.width))
    const y = Math.min(image.height - 1, Math.floor((flip ? 1 - v : v) * image.height))
    const o = (y * image.width + x) * 4
    out[i * 3] = px[o] / 255
    out[i * 3 + 1] = px[o + 1] / 255
    out[i * 3 + 2] = px[o + 2] / 255
  }
  return out
}
