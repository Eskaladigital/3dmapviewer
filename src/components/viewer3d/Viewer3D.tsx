import React, { useRef, useMemo, useState, useCallback, useEffect, memo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  OrbitControls,
  Environment,
  GradientTexture,
  Sky,
  Html,
} from '@react-three/drei'
import { EffectComposer, SSAO, Bloom, DepthOfField, BrightnessContrast, HueSaturation } from '@react-three/postprocessing'
import * as THREE from 'three'
import { useStore } from '@/store/useStore'
import { THEMES } from '@/types'
import type { Wall, FurnitureItem, WallOpening, SceneMaterials, DoorSubtype } from '@/types'

/* ─── Texturas procedurales por material (vetas, puntos, patrones) ─── */
const TEX_SIZE = 256
const textureCache = new Map<string, THREE.CanvasTexture>()

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return { r, g, b }
}

function darken(hex: string, f: number) {
  const r = Math.floor(parseInt(hex.slice(1, 3), 16) * (1 - f))
  const g = Math.floor(parseInt(hex.slice(3, 5), 16) * (1 - f))
  const b = Math.floor(parseInt(hex.slice(5, 7), 16) * (1 - f))
  return `rgb(${r},${g},${b})`
}

function getMaterialTexture(materialId: string, color: string): THREE.Texture | null {
  const key = `${materialId}-${color}`
  if (textureCache.has(key)) return textureCache.get(key)!
  const canvas = document.createElement('canvas')
  canvas.width = TEX_SIZE
  canvas.height = TEX_SIZE
  const ctx = canvas.getContext('2d')!
  const rgb = hexToRgb(color)

  if (['wood', 'parquet', 'doorPanel', 'doorFrame', 'baseboard'].includes(materialId)) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)
    for (let i = 0; i < 120; i++) {
      const y = Math.random() * TEX_SIZE
      const w = 1.5 + Math.random() * 4
      const alpha = 0.05 + Math.random() * 0.12
      ctx.fillStyle = `rgba(0,0,0,${alpha})`
      ctx.fillRect(0, y, TEX_SIZE, w)
    }
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * TEX_SIZE
      const w = 1 + Math.random() * 3
      ctx.strokeStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.1})`
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + (Math.random() - 0.5) * 30, TEX_SIZE)
      ctx.stroke()
    }
  } else if (['furnitureWood'].includes(materialId)) {
    // Madera de muebles (mesas, etc.): grano horizontal tipo tablero, distinto al parquet del suelo
    ctx.fillStyle = color
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)
    for (let i = 0; i < 35; i++) {
      const y = Math.random() * TEX_SIZE
      const w = 2 + Math.random() * 6
      const alpha = 0.03 + Math.random() * 0.08
      ctx.fillStyle = `rgba(0,0,0,${alpha})`
      ctx.fillRect(0, y, TEX_SIZE, w)
    }
    for (let i = 0; i < 25; i++) {
      const x = Math.random() * TEX_SIZE
      ctx.strokeStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + (Math.random() - 0.5) * 20, TEX_SIZE)
      ctx.stroke()
    }
  } else if (['metal', 'iron', 'windowFrame'].includes(materialId)) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)
    for (let i = 0; i < 600; i++) {
      const x = Math.random() * TEX_SIZE
      const y = Math.random() * TEX_SIZE
      const r = 0.5 + Math.random() * 2
      const bright = 0.25 + Math.random() * 0.5
      ctx.fillStyle = `rgba(255,255,255,${bright})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let y = 0; y < TEX_SIZE; y += 3) {
      ctx.strokeStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.06})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(TEX_SIZE, y + (Math.random() - 0.5) * 4)
      ctx.stroke()
    }
  } else if (['concrete', 'marble', 'countertop'].includes(materialId)) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)
    for (let i = 0; i < 600; i++) {
      const x = Math.random() * TEX_SIZE
      const y = Math.random() * TEX_SIZE
      const g = 0.5 + Math.random() * 0.5
      ctx.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.06})`
      ctx.fillRect(x, y, 2, 2)
    }
    if (materialId === 'marble') {
      for (let i = 0; i < 15; i++) {
        const x = Math.random() * TEX_SIZE
        ctx.strokeStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.08})`
        ctx.lineWidth = 1 + Math.random() * 2
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.bezierCurveTo(x + 30, 80, x - 20, 180, x + 10, TEX_SIZE)
        ctx.stroke()
      }
    }
  } else if (['tile', 'tile_metro', 'tile_arabic', 'ceramic'].includes(materialId)) {
    const grid = materialId === 'tile_arabic' ? 32 : 16
    ctx.fillStyle = color
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)
    ctx.strokeStyle = darken(color, 0.15)
    ctx.lineWidth = 1
    for (let x = 0; x <= TEX_SIZE; x += grid) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, TEX_SIZE)
      ctx.stroke()
    }
    for (let y = 0; y <= TEX_SIZE; y += grid) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(TEX_SIZE, y)
      ctx.stroke()
    }
  } else if (['fabric'].includes(materialId)) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)
    const step = 8
    for (let y = 0; y < TEX_SIZE; y += step) {
      for (let x = (y / step) % 2 === 0 ? 0 : step / 2; x < TEX_SIZE; x += step) {
        ctx.fillStyle = darken(color, 0.08)
        ctx.fillRect(x, y, step / 2, step)
      }
    }
  } else if (['paint'].includes(materialId)) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE)
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * TEX_SIZE
      const y = Math.random() * TEX_SIZE
      ctx.fillStyle = `rgba(0,0,0,${0.01 + Math.random() * 0.03})`
      ctx.fillRect(x, y, 2, 2)
    }
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * TEX_SIZE
      const y = Math.random() * TEX_SIZE
      ctx.strokeStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.04})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40)
      ctx.stroke()
    }
  } else {
    return null
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(4, 4)
  textureCache.set(key, tex)
  return tex
}

function useSlotTexture(slot: { material: string; color: string }) {
  return useMemo(() => getMaterialTexture(slot.material, slot.color), [slot.material, slot.color])
}

/* ─── Pintura procedural para cuadros ─── */
const paintingCache = new Map<string, THREE.CanvasTexture>()

function generatePaintingTexture(seed: string): THREE.CanvasTexture {
  if (paintingCache.has(seed)) return paintingCache.get(seed)!

  const SIZE = 512
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!

  let s = 0
  for (let i = 0; i < seed.length; i++) s = ((s << 5) - s + seed.charCodeAt(i)) | 0
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }

  const palettes = [
    ['#2C3E50', '#E74C3C', '#ECF0F1', '#3498DB', '#F39C12'],
    ['#1A1A2E', '#16213E', '#0F3460', '#E94560', '#F5E6CC'],
    ['#264653', '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51'],
    ['#606C38', '#283618', '#FEFAE0', '#DDA15E', '#BC6C25'],
    ['#F8F9FA', '#E9ECEF', '#DEE2E6', '#ADB5BD', '#6C757D'],
    ['#003049', '#D62828', '#F77F00', '#FCBF49', '#EAE2B7'],
    ['#582F0E', '#7F4F24', '#936639', '#A68A64', '#B6AD90'],
    ['#10002B', '#240046', '#3C096C', '#5A189A', '#9D4EDD'],
  ]
  const pal = palettes[Math.abs(s) % palettes.length]

  // Fondo
  ctx.fillStyle = pal[rand() > 0.5 ? 0 : 4]
  ctx.fillRect(0, 0, SIZE, SIZE)

  const style = rand()

  if (style < 0.3) {
    // Bloques abstractos tipo Rothko
    const blocks = 2 + Math.floor(rand() * 3)
    const blockH = SIZE / blocks
    for (let i = 0; i < blocks; i++) {
      ctx.fillStyle = pal[Math.floor(rand() * pal.length)]
      const margin = 20 + rand() * 40
      ctx.fillRect(margin, i * blockH + 8, SIZE - margin * 2, blockH - 16)
    }
    // Ligera textura
    for (let i = 0; i < 2000; i++) {
      ctx.fillStyle = `rgba(${rand() > 0.5 ? 255 : 0},${rand() > 0.5 ? 255 : 0},${rand() > 0.5 ? 255 : 0},${rand() * 0.03})`
      ctx.fillRect(rand() * SIZE, rand() * SIZE, rand() * 6, rand() * 6)
    }
  } else if (style < 0.6) {
    // Paisaje abstracto
    ctx.fillStyle = pal[0]
    ctx.fillRect(0, 0, SIZE, SIZE)
    // Cielo
    const grd = ctx.createLinearGradient(0, 0, 0, SIZE * 0.6)
    grd.addColorStop(0, pal[3])
    grd.addColorStop(1, pal[4])
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, SIZE, SIZE * 0.6)
    // Colinas
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = pal[layer % pal.length]
      ctx.beginPath()
      ctx.moveTo(0, SIZE * (0.45 + layer * 0.15))
      for (let x = 0; x <= SIZE; x += 20) {
        const y = SIZE * (0.45 + layer * 0.15) + Math.sin(x * 0.015 + layer * 2 + rand() * 0.5) * (30 + rand() * 20)
        ctx.lineTo(x, y)
      }
      ctx.lineTo(SIZE, SIZE)
      ctx.lineTo(0, SIZE)
      ctx.closePath()
      ctx.fill()
    }
  } else {
    // Composición geométrica
    for (let i = 0; i < 8 + Math.floor(rand() * 12); i++) {
      ctx.fillStyle = pal[Math.floor(rand() * pal.length)]
      ctx.globalAlpha = 0.4 + rand() * 0.6
      const shape = rand()
      if (shape < 0.4) {
        ctx.fillRect(rand() * SIZE, rand() * SIZE, 30 + rand() * 180, 30 + rand() * 180)
      } else if (shape < 0.7) {
        ctx.beginPath()
        ctx.arc(rand() * SIZE, rand() * SIZE, 20 + rand() * 100, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.moveTo(rand() * SIZE, rand() * SIZE)
        ctx.lineTo(rand() * SIZE, rand() * SIZE)
        ctx.lineTo(rand() * SIZE, rand() * SIZE)
        ctx.closePath()
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
    // Líneas
    for (let i = 0; i < 3 + Math.floor(rand() * 5); i++) {
      ctx.strokeStyle = pal[Math.floor(rand() * pal.length)]
      ctx.lineWidth = 1 + rand() * 4
      ctx.globalAlpha = 0.3 + rand() * 0.5
      ctx.beginPath()
      ctx.moveTo(rand() * SIZE, rand() * SIZE)
      ctx.quadraticCurveTo(rand() * SIZE, rand() * SIZE, rand() * SIZE, rand() * SIZE)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  paintingCache.set(seed, tex)
  return tex
}

function PaintingCanvas({ w, h, seed }: { w: number; h: number; seed: string }) {
  const texture = useMemo(() => generatePaintingTexture(seed), [seed])
  return (
    <mesh position={[0, 0, 0.016]}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={texture} roughness={0.7} metalness={0.0} />
    </mesh>
  )
}

const joystickInput = { x: 0, z: 0 }
const fpLookInput = { yaw: 0, pitch: 0 }
const fpMoveInput = { x: 0, y: 0 }
const lookPadSensitivity = 0.004

/* ─── Wall Mesh — pared lisa con huecos para ventanas/puertas ─── */
const WallMesh = memo(function WallMesh({ wall, openings }: { wall: Wall; openings: WallOpening[] }) {
  const sm = useStore((s) => s.sceneMaterials)
  const wallTex = useSlotTexture(sm.walls)
  const dx = wall.end.x - wall.start.x
  const dy = wall.end.y - wall.start.y
  const length = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx)
  const cx = (wall.start.x + wall.end.x) / 2
  const cy = (wall.start.y + wall.end.y) / 2

  if (length === 0) return null

  const wallColor = sm.walls.color
  const t = wall.thickness
  const frameDepth = t
  const frameThick = 0.04

  // Crear geometría con huecos usando Shape + ExtrudeGeometry
  const wallGeometry = useMemo(() => {
    // Forma exterior de la pared
    const shape = new THREE.Shape()
    shape.moveTo(-length / 2, 0)
    shape.lineTo(length / 2, 0)
    shape.lineTo(length / 2, wall.height)
    shape.lineTo(-length / 2, wall.height)
    shape.closePath()

    // Añadir huecos para cada ventana/puerta
    const sortedOpenings = [...openings].sort((a, b) => a.position - b.position)
    for (const op of sortedOpenings) {
      const ox = (op.position - 0.5) * length
      const halfW = op.width / 2
      
      // Hueco con sentido contrario (counter-clockwise)
      const hole = new THREE.Path()
      hole.moveTo(ox - halfW, op.elevation)
      hole.lineTo(ox - halfW, op.elevation + op.height)
      hole.lineTo(ox + halfW, op.elevation + op.height)
      hole.lineTo(ox + halfW, op.elevation)
      hole.closePath()
      shape.holes.push(hole)
    }

    // Extruir para darle grosor
    const extrudeSettings = {
      depth: t,
      bevelEnabled: false
    }
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings)
    geo.translate(0, 0, -t / 2)
    geo.computeVertexNormals()
    return geo
  }, [wall.height, length, t, openings])

  useEffect(() => () => wallGeometry.dispose(), [wallGeometry])

  return (
    <group position={[cx, 0, cy]} rotation={[0, -angle, 0]}>
      {/* Pared continua con huecos transparentes */}
      <mesh geometry={wallGeometry} castShadow receiveShadow>
        <meshStandardMaterial 
          color={wallColor} 
          map={wallTex || undefined} 
          roughness={sm.walls.roughness} 
          metalness={sm.walls.metalness}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Windows & Doors */}
      {openings.map((op) => {
        const ox = (op.position - 0.5) * length
        const oy = op.elevation + op.height / 2

        return (
          <group key={op.id} position={[ox, oy, 0]} rotation={[0, op.flip ? Math.PI : 0, 0]}>
            {op.type === 'window' ? (
              <WindowMesh3D op={op} frameDepth={frameDepth} frameThick={frameThick} sm={sm} />
            ) : (
              <DoorMesh3D op={op} wallHeight={wall.height} frameDepth={frameDepth} frameThick={frameThick} sm={sm} oy={oy - wall.height / 2} />
            )}
          </group>
        )
      })}
    </group>
  )
})

/* ─── Window 3D ─── */
function WindowMesh3D({ op, frameDepth, frameThick, sm }: {
  op: WallOpening; frameDepth: number; frameThick: number; sm: SceneMaterials
}) {
  const hw = op.width / 2
  const hh = op.height / 2
  const fd = frameDepth
  const ft = frameThick
  const frameColor = op.color || sm.windowFrame.color
  const frameMat = <meshStandardMaterial color={frameColor} roughness={sm.windowFrame.roughness} metalness={sm.windowFrame.metalness} />
  const glassColor = sm.windowGlass.color
  const glassOpacity = sm.windowGlass.opacity

  return (
    <group>
      {/* Frame — 4 bars */}
      <mesh castShadow position={[0, hh - ft / 2, 0]}>
        <boxGeometry args={[op.width, ft, fd]} />
        {frameMat}
      </mesh>
      <mesh castShadow position={[0, -hh + ft / 2, 0]}>
        <boxGeometry args={[op.width, ft, fd]} />
        {frameMat}
      </mesh>
      <mesh castShadow position={[-hw + ft / 2, 0, 0]}>
        <boxGeometry args={[ft, op.height, fd]} />
        {frameMat}
      </mesh>
      <mesh castShadow position={[hw - ft / 2, 0, 0]}>
        <boxGeometry args={[ft, op.height, fd]} />
        {frameMat}
      </mesh>

      {/* Middle bar for double_hung, sliding, casement */}
      {(op.subtype === 'double_hung' || op.subtype === 'sliding') && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[op.width - ft * 2, ft * 0.6, fd]} />
          {frameMat}
        </mesh>
      )}
      {op.subtype === 'sliding' && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[ft * 0.6, op.height - ft * 2, fd]} />
          {frameMat}
        </mesh>
      )}
      {(op.subtype === 'casement' || op.subtype === 'single_hung') && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[ft * 0.6, op.height - ft * 2, fd]} />
          {frameMat}
        </mesh>
      )}

      {/* Bay window: angled side panels */}
      {op.subtype === 'bay' && (
        <>
          <mesh castShadow position={[-hw + 0.08, 0, -0.12]} rotation={[0, 0.5, 0]}>
            <boxGeometry args={[0.25, op.height - ft, ft * 0.5]} />
            {frameMat}
          </mesh>
          <mesh castShadow position={[hw - 0.08, 0, -0.12]} rotation={[0, -0.5, 0]}>
            <boxGeometry args={[0.25, op.height - ft, ft * 0.5]} />
            {frameMat}
          </mesh>
          {/* Bay side glass */}
          <mesh position={[-hw + 0.08, 0, -0.12]} rotation={[0, 0.5, 0]}>
            <boxGeometry args={[0.22, op.height - ft * 2, 0.005]} />
            <meshPhysicalMaterial color={glassColor} transparent opacity={glassOpacity} roughness={sm.windowGlass.roughness} metalness={sm.windowGlass.metalness} transmission={0.92} thickness={0.4} />
          </mesh>
          <mesh position={[hw - 0.08, 0, -0.12]} rotation={[0, -0.5, 0]}>
            <boxGeometry args={[0.22, op.height - ft * 2, 0.005]} />
            <meshPhysicalMaterial color={glassColor} transparent opacity={glassOpacity} roughness={sm.windowGlass.roughness} metalness={sm.windowGlass.metalness} transmission={0.92} thickness={0.4} />
          </mesh>
        </>
      )}

      {/* Glass pane */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[op.width - ft * 2, op.height - ft * 2, 0.005]} />
        <meshPhysicalMaterial
          color={glassColor}
          transparent
          opacity={glassOpacity}
          roughness={sm.windowGlass.roughness}
          metalness={sm.windowGlass.metalness}
          transmission={0.92}
          thickness={0.4}
        />
      </mesh>

      {/* Sill (ledge at bottom, exterior side) */}
      <mesh castShadow position={[0, -hh - 0.015, fd / 2 - 0.01]}>
        <boxGeometry args={[op.width + 0.06, 0.03, fd * 0.7]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.1} />
      </mesh>
    </group>
  )
}

/* ─── Door 3D ─── */
function DoorMesh3D({ op, wallHeight, frameDepth, frameThick, sm, oy }: {
  op: WallOpening; wallHeight: number; frameDepth: number; frameThick: number; sm: SceneMaterials; oy: number
}) {
  const hw = op.width / 2
  const hh = op.height / 2
  const fd = frameDepth
  const ft = frameThick
  const subtype = op.subtype as DoorSubtype
  const isDbl = subtype === 'double' || subtype === 'french'
  const isCorredera = subtype === 'sliding'
  const isPocket = subtype === 'pocket' || subtype === 'pocket_pladur'
  const isFrench = subtype === 'french'
  const isFullGlass = subtype === 'glass'
  const isBifold = subtype === 'bifold'
  const frameColor = op.color || sm.doorFrame.color
  const panelColor = op.color || sm.doorPanel.color
  const frameMat = <meshStandardMaterial color={frameColor} roughness={sm.doorFrame.roughness} metalness={sm.doorFrame.metalness} />

  const panelW = isDbl ? (op.width - ft * 3) / 2 : (op.width - ft * 2)
  const panelH = op.height - ft

  return (
    <group>
      {/* Door frame — 3 bars (no bottom for doors). Omitir en empotradas (frameless) */}
      {!isPocket && (
        <>
          <mesh castShadow position={[0, hh - ft / 2, 0]}>
            <boxGeometry args={[op.width + ft, ft, fd]} />
            {frameMat}
          </mesh>
          <mesh castShadow position={[-hw - ft / 2 + ft / 2, -ft / 2, 0]}>
            <boxGeometry args={[ft, op.height - ft, fd]} />
            {frameMat}
          </mesh>
          <mesh castShadow position={[hw + ft / 2 - ft / 2, -ft / 2, 0]}>
            <boxGeometry args={[ft, op.height - ft, fd]} />
            {frameMat}
          </mesh>
        </>
      )}

      {/* Middle divider for double doors */}
      {isDbl && (
        <mesh castShadow position={[0, -ft / 2, 0]}>
          <boxGeometry args={[ft * 0.7, op.height - ft, fd]} />
          {frameMat}
        </mesh>
      )}

      {/* ─── Abatibles (single, double, entry, french, glass) ─── */}
      {(subtype === 'single' || subtype === 'entry' || subtype === 'double' || subtype === 'french' || subtype === 'glass') && (
        isDbl ? (
          <>
            <DoorPanel x={-panelW / 2 - ft * 0.35} w={panelW} h={panelH} fd={fd} sm={sm} panelColor={panelColor} french={isFrench} fullGlass={isFullGlass} hinge="left" openAmount={0.3} />
            <DoorPanel x={panelW / 2 + ft * 0.35} w={panelW} h={panelH} fd={fd} sm={sm} panelColor={panelColor} french={isFrench} fullGlass={isFullGlass} hinge="right" openAmount={0.3} />
          </>
        ) : (
          <DoorPanel x={0} w={panelW} h={panelH} fd={fd} sm={sm} panelColor={panelColor} french={isFrench} fullGlass={isFullGlass} hinge={op.openDirection === 'right' ? 'right' : 'left'} openAmount={0.3} />
        )
      )}

      {/* ─── Corredera: panel deslizante por fuera, rail visible ─── */}
      {isCorredera && (
        <SlidingDoorPanel w={panelW} h={panelH} fd={fd} sm={sm} panelColor={panelColor} variant="exterior" slideAmount={0.75} />
      )}

      {/* ─── Empotrada / Empotrada pladur: panel dentro del muro ─── */}
      {isPocket && (
        <SlidingDoorPanel w={panelW} h={panelH} fd={fd} sm={sm} panelColor={panelColor} variant={subtype === 'pocket_pladur' ? 'pocket_pladur' : 'pocket'} slideAmount={0.85} />
      )}

      {/* ─── Plegable (bifold): dos paneles que se pliegan ─── */}
      {isBifold && (
        <BifoldDoorPanel w={panelW} h={panelH} fd={fd} sm={sm} panelColor={panelColor} hinge={op.openDirection === 'right' ? 'right' : 'left'} foldAmount={0.4} />
      )}

      {/* Sin umbral/threshold: el suelo de las habitaciones es continuo; evita artefacto visible bajo puertas abatibles */}

      {/* Rail visible para corredera (por fuera) */}
      {isCorredera && (
        <>
          <mesh position={[0, hh - 0.01, fd / 2 + 0.008]} castShadow>
            <boxGeometry args={[op.width + 0.15, 0.025, 0.04]} />
            <meshStandardMaterial color="#555" roughness={0.2} metalness={0.7} />
          </mesh>
          <mesh position={[0, hh + 0.02, fd / 2 + 0.01]}>
            <boxGeometry args={[op.width + 0.2, 0.015, 0.02]} />
            <meshStandardMaterial color="#666" roughness={0.3} metalness={0.6} />
          </mesh>
        </>
      )}
    </group>
  )
}

/* Corredera: panel deslizado lateralmente por fuera. Empotrada: panel dentro del muro. */
function SlidingDoorPanel({ w, h, fd, sm, panelColor, variant, slideAmount }: {
  w: number; h: number; fd: number; sm: SceneMaterials; panelColor: string; variant: 'exterior' | 'pocket' | 'pocket_pladur'; slideAmount: number
}) {
  const panelThick = 0.035
  const isExterior = variant === 'exterior'
  // Corredera: panel desplazado a un lado, visible. Empotrada: panel mayormente dentro del muro
  const offsetX = isExterior ? (w * 0.5) * slideAmount : -(w * 0.6) * slideAmount
  const visibleW = isExterior ? w : w * 0.35

  return (
    <group position={[offsetX, -0.02, fd * (isExterior ? 0.25 : 0.08)]}>
      <mesh castShadow>
        <boxGeometry args={[isExterior ? w : visibleW, h, panelThick]} />
        <meshStandardMaterial color={panelColor} roughness={sm.doorPanel.roughness} metalness={sm.doorPanel.metalness} />
      </mesh>
      {!isExterior && variant === 'pocket_pladur' && (
        <mesh position={[0, 0, panelThick / 2 + 0.002]}>
          <boxGeometry args={[visibleW - 0.06, h * 0.5, 0.006]} />
          <meshStandardMaterial color={panelColor} roughness={0.6} metalness={0.02} />
        </mesh>
      )}
      {isExterior && (
        <>
          <mesh position={[0, h * 0.22, panelThick / 2 + 0.002]}>
            <boxGeometry args={[w - 0.1, h * 0.35, 0.008]} />
            <meshStandardMaterial color={panelColor} roughness={0.6} metalness={0.02} />
          </mesh>
          <mesh position={[w * 0.35, 0, panelThick / 2 + 0.015]}>
            <boxGeometry args={[0.02, 0.1, 0.03]} />
            <meshStandardMaterial color="#B8860B" roughness={0.2} metalness={0.8} />
          </mesh>
        </>
      )}
    </group>
  )
}

/* Plegable: dos paneles que se pliegan hacia un lado */
function BifoldDoorPanel({ w, h, fd, sm, panelColor, hinge, foldAmount }: {
  w: number; h: number; fd: number; sm: SceneMaterials; panelColor: string; hinge: 'left' | 'right'; foldAmount: number
}) {
  const panelThick = 0.03
  const halfW = w / 2
  const foldAngle = (Math.PI / 2) * foldAmount
  const dir = hinge === 'right' ? 1 : -1
  const angle1 = dir * foldAngle * 0.5
  const angle2 = dir * foldAngle

  return (
    <>
      <group position={[-halfW / 2, -0.02, fd * 0.15]} rotation={[0, angle1, 0]}>
        <group position={[halfW / 4, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[halfW, h, panelThick]} />
            <meshStandardMaterial color={panelColor} roughness={sm.doorPanel.roughness} metalness={sm.doorPanel.metalness} />
          </mesh>
          <mesh position={[0, h * 0.2, panelThick / 2 + 0.002]}>
            <boxGeometry args={[halfW - 0.06, h * 0.3, 0.006]} />
            <meshStandardMaterial color={panelColor} roughness={0.6} metalness={0.02} />
          </mesh>
        </group>
      </group>
      <group position={[halfW / 2, -0.02, fd * 0.15]} rotation={[0, angle2, 0]}>
        <group position={[-halfW / 4, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[halfW, h, panelThick]} />
            <meshStandardMaterial color={panelColor} roughness={sm.doorPanel.roughness} metalness={sm.doorPanel.metalness} />
          </mesh>
          <mesh position={[0, h * 0.2, panelThick / 2 + 0.002]}>
            <boxGeometry args={[halfW - 0.06, h * 0.3, 0.006]} />
            <meshStandardMaterial color={panelColor} roughness={0.6} metalness={0.02} />
          </mesh>
        </group>
      </group>
    </>
  )
}

function DoorPanel({ x, w, h, fd, sm, panelColor, french, fullGlass = false, hinge = 'left', openAmount = 0.3 }: {
  x: number; w: number; h: number; fd: number; sm: SceneMaterials; panelColor: string; french: boolean; fullGlass?: boolean; hinge?: 'left' | 'right'; openAmount?: number
}) {
  const panelThick = 0.035
  const glassColor = sm.windowGlass.color
  const glassOpacity = sm.windowGlass.opacity
  const openAngle = (Math.PI / 2) * openAmount
  const rotY = hinge === 'left' ? -openAngle : openAngle
  const pivotOffset = hinge === 'left' ? -w / 2 : w / 2

  return (
    <group position={[x + pivotOffset, -0.02, fd * 0.15]} rotation={[0, rotY, 0]}>
      <group position={[-pivotOffset, 0, 0]}>
      {/* Main panel — en fullGlass es marco fino + cristal */}
      {!fullGlass && (
      <mesh castShadow>
        <boxGeometry args={[w, h, panelThick]} />
        <meshStandardMaterial color={panelColor} roughness={sm.doorPanel.roughness} metalness={sm.doorPanel.metalness} />
      </mesh>
      )}

      {fullGlass ? (
        <>
          {/* Puerta de cristal: marco fino + panel de cristal completo */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[w, h, panelThick + 0.002]} />
            <meshPhysicalMaterial
              color={glassColor}
              transparent
              opacity={glassOpacity}
              roughness={sm.windowGlass.roughness}
              metalness={sm.windowGlass.metalness}
              transmission={0.92}
              thickness={0.3}
            />
          </mesh>
          <mesh position={[-w / 2 + 0.03, 0, 0]} castShadow>
            <boxGeometry args={[0.04, h, panelThick]} />
            <meshStandardMaterial color={panelColor} roughness={0.4} metalness={0.2} />
          </mesh>
          <mesh position={[w / 2 - 0.03, 0, 0]} castShadow>
            <boxGeometry args={[0.04, h, panelThick]} />
            <meshStandardMaterial color={panelColor} roughness={0.4} metalness={0.2} />
          </mesh>
          <mesh position={[w * 0.35, 0, panelThick / 2 + 0.015]}>
            <boxGeometry args={[0.015, 0.12, 0.025]} />
            <meshStandardMaterial color="#B8860B" roughness={0.2} metalness={0.8} />
          </mesh>
        </>
      ) : french ? (
        <>
          {/* Glass inset for french door */}
          <mesh position={[0, h * 0.1, 0]}>
            <boxGeometry args={[w - 0.08, h * 0.7, panelThick + 0.002]} />
            <meshPhysicalMaterial
              color={glassColor}
              transparent
              opacity={glassOpacity}
              roughness={sm.windowGlass.roughness}
              metalness={sm.windowGlass.metalness}
              transmission={0.92}
              thickness={0.3}
            />
          </mesh>
          {/* Glazing bars */}
          <mesh position={[0, h * 0.1, panelThick / 2 + 0.001]}>
            <boxGeometry args={[0.015, h * 0.7, 0.008]} />
            <meshStandardMaterial color={panelColor} roughness={0.3} />
          </mesh>
          <mesh position={[0, h * 0.1, panelThick / 2 + 0.001]}>
            <boxGeometry args={[w - 0.08, 0.015, 0.008]} />
            <meshStandardMaterial color={panelColor} roughness={0.3} />
          </mesh>
        </>
      ) : (
        <>
          {/* Raised panel detail (2 rectangles) */}
          <mesh position={[0, h * 0.22, panelThick / 2 + 0.002]}>
            <boxGeometry args={[w - 0.1, h * 0.35, 0.008]} />
            <meshStandardMaterial color={panelColor} roughness={0.6} metalness={0.02} />
          </mesh>
          <mesh position={[0, -h * 0.2, panelThick / 2 + 0.002]}>
            <boxGeometry args={[w - 0.1, h * 0.3, 0.008]} />
            <meshStandardMaterial color={panelColor} roughness={0.6} metalness={0.02} />
          </mesh>
        </>
      )}

      {/* Handle */}
      <mesh position={[w * 0.38, 0, panelThick / 2 + 0.015]}>
        <boxGeometry args={[0.015, 0.12, 0.025]} />
        <meshStandardMaterial color="#B8860B" roughness={0.2} metalness={0.8} />
      </mesh>
      </group>
    </group>
  )
}

/* ─── Furniture Mesh ─── */
const FurnitureMesh = memo(function FurnitureMesh({ item, onSelect, ceilingHeight = 2.7 }: { item: FurnitureItem; onSelect: (id: string) => void; ceilingHeight?: number }) {
  const isSelected = useStore((s) => s.editor.selectedFurnitureIds?.includes(item.id) || s.editor.selectedItemId === item.id)
  const smCountertop = useStore((s) => s.sceneMaterials.countertop)

  const color = useMemo(() => isSelected ? '#5B8DEF' : (item.color || '#b0a090'), [item.color, isSelected])

  const handleClick = useCallback((e: any) => { e.stopPropagation(); onSelect(item.id) }, [item.id, onSelect])

  const mat = useMemo(() => <meshStandardMaterial color={color} roughness={item.material === 'metal' ? 0.2 : item.material === 'ceramic' ? 0.15 : item.material === 'glass' ? 0.05 : item.material === 'marble' ? 0.3 : 0.65} metalness={item.material === 'metal' ? 0.8 : item.material === 'ceramic' ? 0.1 : 0.05} />, [color, item.material])
  const matDark = useMemo(() => {
    const c = new THREE.Color(color).multiplyScalar(0.7)
    return <meshStandardMaterial color={c} roughness={0.7} metalness={0.05} />
  }, [color])
  const cushionMat = useMemo(() => <meshStandardMaterial color={color} roughness={0.92} metalness={0} />, [color])
  const glassMat = <meshPhysicalMaterial color="#c8e0f0" transparent opacity={0.18} roughness={0.05} transmission={0.7} />
  const ceramicWhite = <meshStandardMaterial color="#FFFFFF" roughness={0.15} metalness={0.1} />
  const chromeMat = <meshStandardMaterial color="#d0d0d0" roughness={0.1} metalness={0.9} />
  const woodDark = <meshStandardMaterial color="#3A2818" roughness={0.75} metalness={0.02} />

  const effectiveItem = item.type === 'tv' ? { ...item, type: 'tv_stand_55' as const, width: 1.8, depth: 0.45, height: 1.3 } :
    item.type === 'tv_large' ? { ...item, type: 'tv_stand_75' as const, width: 1.8, depth: 0.45, height: 1.55 } :
    item.type === 'table_lamp' ? { ...item, type: 'side_table_lamp' as const, width: 0.45, depth: 0.45, height: 1.05 } :
    item.type === 'microwave' ? { ...item, type: 'kitchen_counter_microwave' as const, width: 1.2, depth: 0.6, height: 1.2 } :
    item.type === 'kitchen_cabinet_upper' ? { ...item, type: 'kitchen_counter_upper' as const, width: 1.2, depth: 0.6, height: 1.65 } :
    item.type === 'plant_small' ? { ...item, type: 'side_table_plant' as const, width: 0.45, depth: 0.45, height: 0.9 } : item
  const w = effectiveItem.width, d = effectiveItem.depth, h = effectiveItem.height

  const renderShape = () => {
    switch (effectiveItem.type) {

      // ═══════════ CAMAS ═══════════
      case 'bed_double':
      case 'bed_single':
      case 'bed_king': {
        const frameH = 0.12, legH = 0.10
        const mattressH = 0.22, pillowH = 0.08
        return (
          <group>
            {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([lx, lz], i) => (
              <mesh key={i} castShadow position={[lx * (w / 2 - 0.06), legH / 2, lz * (d / 2 - 0.06)]}>
                <boxGeometry args={[0.06, legH, 0.06]} />
                {woodDark}
              </mesh>
            ))}
            <mesh castShadow receiveShadow position={[0, legH + frameH / 2, 0]}>
              <boxGeometry args={[w, frameH, d]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, legH + frameH + mattressH / 2, 0.02]}>
              <boxGeometry args={[w - 0.06, mattressH, d - 0.06]} />
              <meshStandardMaterial color="#f0ece4" roughness={0.95} />
            </mesh>
            {[-1, 1].map((s, i) => (
              <mesh key={i} castShadow position={[s * (w / 4), legH + frameH + mattressH + pillowH / 2, -d / 2 + 0.22]}>
                <boxGeometry args={[w / 2.5, pillowH, 0.32]} />
                <meshStandardMaterial color="#e8e4dc" roughness={0.95} />
              </mesh>
            ))}
            <mesh castShadow position={[0, legH + frameH + mattressH * 0.7, -d / 2 + 0.04]}>
              <boxGeometry args={[w + 0.04, mattressH * 1.8, 0.06]} />
              {mat}
            </mesh>
          </group>
        )
      }

      case 'bunk_bed':
        return (
          <group>
            {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([lx, lz], i) => (
              <mesh key={i} castShadow position={[lx * (w / 2 - 0.03), h / 2, lz * (d / 2 - 0.03)]}>
                <boxGeometry args={[0.06, h, 0.06]} />
                {mat}
              </mesh>
            ))}
            <mesh castShadow position={[0, 0.28, 0]}>
              <boxGeometry args={[w - 0.08, 0.06, d - 0.08]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, 0.38, 0]}>
              <boxGeometry args={[w - 0.12, 0.14, d - 0.10]} />
              <meshStandardMaterial color="#f0ece4" roughness={0.95} />
            </mesh>
            <mesh castShadow position={[0, h * 0.56, 0]}>
              <boxGeometry args={[w - 0.08, 0.06, d - 0.08]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, h * 0.56 + 0.10, 0]}>
              <boxGeometry args={[w - 0.12, 0.14, d - 0.10]} />
              <meshStandardMaterial color="#f0ece4" roughness={0.95} />
            </mesh>
            <mesh castShadow position={[w / 2 - 0.03, h * 0.38, d / 2 - 0.03]}>
              <boxGeometry args={[0.04, h * 0.32, 0.04]} />
              {mat}
            </mesh>
          </group>
        )

      case 'crib':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, 0.35, 0]}>
              <boxGeometry args={[w - 0.04, 0.05, d - 0.04]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, 0.42, 0]}>
              <boxGeometry args={[w - 0.10, 0.10, d - 0.10]} />
              <meshStandardMaterial color="#f8f6f2" roughness={0.95} />
            </mesh>
            {[[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sz], i) => (
              <mesh key={i} castShadow position={[sx * (w / 2 - 0.02), h / 2, sz * (d / 2 - 0.02)]}>
                <boxGeometry args={[0.04, h, 0.04]} />
                {mat}
              </mesh>
            ))}
            {[-1, 1].map((s, i) => (
              <mesh key={`rail-${i}`} castShadow position={[s * (w / 2 - 0.02), h * 0.7, 0]}>
                <boxGeometry args={[0.03, 0.03, d - 0.04]} />
                {mat}
              </mesh>
            ))}
            {[-1, 1].map((s, i) => (
              <mesh key={`rail2-${i}`} castShadow position={[0, h * 0.7, s * (d / 2 - 0.02)]}>
                <boxGeometry args={[w - 0.04, 0.03, 0.03]} />
                {mat}
              </mesh>
            ))}
          </group>
        )

      // ═══════════ SOFÁS ═══════════
      case 'sofa_2':
      case 'sofa_3':
      case 'sofa_bed':
      case 'chaise_longue': {
        const seatH = 0.18, baseH = 0.08, backH = 0.38, armW = 0.12
        return (
          <group>
            {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([lx, lz], i) => (
              <mesh key={i} castShadow position={[lx * (w / 2 - 0.08), 0.03, lz * (d / 2 - 0.08)]}>
                <cylinderGeometry args={[0.025, 0.025, 0.06, 8]} />
                {woodDark}
              </mesh>
            ))}
            <mesh castShadow receiveShadow position={[0, baseH + seatH / 2, 0.04]}>
              <boxGeometry args={[w - armW * 2, seatH, d - 0.16]} />
              {cushionMat}
            </mesh>
            <mesh castShadow position={[0, baseH + seatH + backH / 2, -d / 2 + 0.10]}>
              <boxGeometry args={[w - armW * 2, backH, 0.16]} />
              {cushionMat}
            </mesh>
            <mesh castShadow position={[-w / 2 + armW / 2, baseH + (seatH + 0.08) / 2, 0]}>
              <boxGeometry args={[armW, seatH + 0.08, d]} />
              {mat}
            </mesh>
            <mesh castShadow position={[w / 2 - armW / 2, baseH + (seatH + 0.08) / 2, 0]}>
              <boxGeometry args={[armW, seatH + 0.08, d]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, baseH / 2, 0]}>
              <boxGeometry args={[w, baseH, d]} />
              {matDark}
            </mesh>
          </group>
        )
      }

      case 'sofa_L': {
        const sH = 0.18, bH = 0.08
        return (
          <group>
            <mesh castShadow position={[0, bH / 2, 0]}>
              <boxGeometry args={[w, bH, d * 0.45]} />
              {matDark}
            </mesh>
            <mesh castShadow position={[0, bH + sH / 2, 0]}>
              <boxGeometry args={[w - 0.24, sH, d * 0.45 - 0.12]} />
              {cushionMat}
            </mesh>
            <mesh castShadow position={[0, bH + sH + 0.18, -(d * 0.45) / 2 + 0.08]}>
              <boxGeometry args={[w - 0.24, 0.34, 0.14]} />
              {cushionMat}
            </mesh>
            <mesh castShadow position={[w / 2 - d * 0.3, bH / 2, d * 0.1]}>
              <boxGeometry args={[d * 0.55, bH, d * 0.55]} />
              {matDark}
            </mesh>
            <mesh castShadow position={[w / 2 - d * 0.3, bH + sH / 2, d * 0.1]}>
              <boxGeometry args={[d * 0.55 - 0.12, sH, d * 0.55 - 0.12]} />
              {cushionMat}
            </mesh>
          </group>
        )
      }

      case 'armchair': {
        return (
          <group>
            {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([lx, lz], i) => (
              <mesh key={i} castShadow position={[lx * (w / 2 - 0.06), 0.04, lz * (d / 2 - 0.06)]}>
                <cylinderGeometry args={[0.03, 0.025, 0.08, 8]} />
                {woodDark}
              </mesh>
            ))}
            <mesh castShadow receiveShadow position={[0, 0.22, 0.02]}>
              <boxGeometry args={[w - 0.18, 0.16, d - 0.14]} />
              {cushionMat}
            </mesh>
            <mesh castShadow position={[0, 0.42, -d / 2 + 0.10]}>
              <boxGeometry args={[w - 0.18, 0.30, 0.14]} />
              {cushionMat}
            </mesh>
            <mesh castShadow position={[-w / 2 + 0.06, 0.24, 0]}>
              <boxGeometry args={[0.10, 0.20, d]} />
              {mat}
            </mesh>
            <mesh castShadow position={[w / 2 - 0.06, 0.24, 0]}>
              <boxGeometry args={[0.10, 0.20, d]} />
              {mat}
            </mesh>
          </group>
        )
      }

      case 'recliner':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, 0.06, 0]}>
              <boxGeometry args={[w, 0.12, d]} />
              {matDark}
            </mesh>
            <mesh castShadow position={[0, 0.24, 0.04]}>
              <boxGeometry args={[w - 0.16, 0.18, d - 0.14]} />
              {cushionMat}
            </mesh>
            <mesh castShadow position={[0, 0.48, -d / 2 + 0.12]}>
              <boxGeometry args={[w - 0.16, 0.40, 0.18]} />
              {cushionMat}
            </mesh>
            <mesh castShadow position={[-w / 2 + 0.07, 0.30, 0]}>
              <boxGeometry args={[0.12, 0.28, d]} />
              {mat}
            </mesh>
            <mesh castShadow position={[w / 2 - 0.07, 0.30, 0]}>
              <boxGeometry args={[0.12, 0.28, d]} />
              {mat}
            </mesh>
          </group>
        )

      case 'pouf':
        return (
          <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
            <cylinderGeometry args={[w / 2, w / 2 * 0.9, h, 24]} />
            {cushionMat}
          </mesh>
        )

      // ═══════════ MESAS ═══════════
      case 'dining_table':
      case 'dining_table_6':
      case 'desk': {
        const legH2 = h - 0.04
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h - 0.02, 0]}>
              <boxGeometry args={[w, 0.04, d]} />
              {mat}
            </mesh>
            {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([lx, lz], i) => (
              <mesh key={i} castShadow position={[lx * (w / 2 - 0.06), legH2 / 2, lz * (d / 2 - 0.06)]}>
                <boxGeometry args={[0.05, legH2, 0.05]} />
                {mat}
              </mesh>
            ))}
            <mesh castShadow position={[0, legH2 * 0.25, 0]}>
              <boxGeometry args={[w - 0.2, 0.03, 0.03]} />
              {mat}
            </mesh>
          </group>
        )
      }

      case 'desk_L': {
        const legH2 = h - 0.04
        const flipL = effectiveItem.flipL
        const lExtX = flipL ? -w / 2 + d * 0.25 : w / 2 - d * 0.25
        const legs = flipL
          ? [[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05]]
          : [[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [w / 2 - 0.05, d / 2 - 0.05]]
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h - 0.02, -d * 0.2]}>
              <boxGeometry args={[w, 0.04, d * 0.5]} />
              {mat}
            </mesh>
            <mesh castShadow receiveShadow position={[lExtX, h - 0.02, d * 0.15]}>
              <boxGeometry args={[d * 0.5, 0.04, d * 0.55]} />
              {mat}
            </mesh>
            {legs.map(([lx, lz], i) => (
              <mesh key={i} castShadow position={[lx, legH2 / 2, lz]}>
                <cylinderGeometry args={[0.025, 0.025, legH2, 8]} />
                {chromeMat}
              </mesh>
            ))}
          </group>
        )
      }

      case 'coffee_table': {
        const legH2 = h - 0.035
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h - 0.018, 0]}>
              <boxGeometry args={[w, 0.035, d]} />
              {mat}
            </mesh>
            {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([lx, lz], i) => (
              <mesh key={i} castShadow position={[lx * (w / 2 - 0.05), legH2 / 2, lz * (d / 2 - 0.05)]}>
                <cylinderGeometry args={[0.02, 0.02, legH2, 8]} />
                {mat}
              </mesh>
            ))}
            <mesh castShadow position={[0, legH2 * 0.35, 0]}>
              <boxGeometry args={[w - 0.12, 0.02, d - 0.12]} />
              {matDark}
            </mesh>
          </group>
        )
      }

      case 'coffee_table_round':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h - 0.02, 0]}>
              <cylinderGeometry args={[w / 2, w / 2, 0.035, 32]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, (h - 0.04) / 2, 0]}>
              <cylinderGeometry args={[0.04, 0.12, h - 0.04, 16]} />
              {chromeMat}
            </mesh>
          </group>
        )

      case 'dining_table_round':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h - 0.02, 0]}>
              <cylinderGeometry args={[w / 2, w / 2, 0.04, 32]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, (h - 0.04) / 2, 0]}>
              <cylinderGeometry args={[0.05, 0.18, h - 0.04, 16]} />
              {mat}
            </mesh>
          </group>
        )

      case 'side_table':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h - 0.015, 0]}>
              <cylinderGeometry args={[w / 2, w / 2, 0.03, 24]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, h / 2, 0]}>
              <cylinderGeometry args={[0.015, 0.015, h - 0.06, 8]} />
              {chromeMat}
            </mesh>
            <mesh castShadow position={[0, 0.01, 0]}>
              <cylinderGeometry args={[w * 0.35, w * 0.35, 0.02, 24]} />
              {chromeMat}
            </mesh>
          </group>
        )

      case 'console_table':
      case 'breakfast_bar':
      case 'kitchen_trolley': {
        const lh = h - 0.04
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h - 0.02, 0]}>
              <boxGeometry args={[w, 0.04, d]} />
              {mat}
            </mesh>
            {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([lx, lz], i) => (
              <mesh key={i} castShadow position={[lx * (w / 2 - 0.04), lh / 2, lz * (d / 2 - 0.04)]}>
                <boxGeometry args={[0.04, lh, 0.04]} />
                {mat}
              </mesh>
            ))}
          </group>
        )
      }

      // ═══════════ SILLAS ═══════════
      case 'dining_chair': {
        const seatH2 = 0.46
        return (
          <group>
            {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([lx, lz], i) => (
              <mesh key={i} castShadow position={[lx * (w / 2 - 0.04), seatH2 / 2, lz * (d / 2 - 0.04)]}>
                <boxGeometry args={[0.035, seatH2, 0.035]} />
                {mat}
              </mesh>
            ))}
            <mesh castShadow receiveShadow position={[0, seatH2 + 0.015, 0]}>
              <boxGeometry args={[w - 0.02, 0.03, d - 0.02]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, seatH2 + 0.22, -d / 2 + 0.025]}>
              <boxGeometry args={[w - 0.06, 0.40, 0.02]} />
              {mat}
            </mesh>
          </group>
        )
      }

      case 'bar_stool':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h - 0.02, 0]}>
              <cylinderGeometry args={[w * 0.42, w * 0.42, 0.04, 16]} />
              {cushionMat}
            </mesh>
            <mesh castShadow position={[0, h / 2, 0]}>
              <cylinderGeometry args={[0.02, 0.02, h - 0.04, 8]} />
              {chromeMat}
            </mesh>
            <mesh castShadow position={[0, 0.01, 0]}>
              <cylinderGeometry args={[w * 0.38, w * 0.38, 0.02, 16]} />
              {chromeMat}
            </mesh>
            <mesh castShadow position={[0, 0.25, 0]}>
              <torusGeometry args={[w * 0.28, 0.012, 8, 24]} />
              {chromeMat}
            </mesh>
          </group>
        )

      case 'desk_chair':
        return (
          <group>
            <mesh castShadow position={[0, 0.01, 0]}>
              <cylinderGeometry args={[0.28, 0.28, 0.02, 24]} />
              {chromeMat}
            </mesh>
            <mesh castShadow position={[0, 0.26, 0]}>
              <cylinderGeometry args={[0.025, 0.035, 0.46, 8]} />
              {chromeMat}
            </mesh>
            <mesh castShadow position={[0, 0.51, 0.02]}>
              <boxGeometry args={[w - 0.06, 0.06, d - 0.10]} />
              {cushionMat}
            </mesh>
            <mesh castShadow position={[0, 0.78, -d / 2 + 0.06]}>
              <boxGeometry args={[w - 0.08, 0.42, 0.06]} />
              {cushionMat}
            </mesh>
          </group>
        )

      // ═══════════ TV & ESTANTERÍAS ═══════════
      case 'tv_stand':
      case 'tv_wall':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh position={[0, h / 2, d / 2 + 0.003]}>
              <boxGeometry args={[w - 0.06, 0.012, 0.001]} />
              <meshStandardMaterial color="#555" />
            </mesh>
            <mesh position={[-w * 0.22, h / 2, d / 2 + 0.003]}>
              <planeGeometry args={[0.008, h - 0.06]} />
              <meshStandardMaterial color="#555" />
            </mesh>
            <mesh position={[w * 0.22, h / 2, d / 2 + 0.003]}>
              <planeGeometry args={[0.008, h - 0.06]} />
              <meshStandardMaterial color="#555" />
            </mesh>
          </group>
        )

      case 'tv_stand_55':
      case 'tv_stand_75': {
        const standH = 0.55
        const tvH = effectiveItem.type === 'tv_stand_55' ? 0.72 : 0.96
        const tvW = effectiveItem.type === 'tv_stand_55' ? 1.22 : 1.66
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, standH / 2, 0]}>
              <boxGeometry args={[w, standH, d]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, standH + tvH / 2 + 0.02, 0]}>
              <boxGeometry args={[tvW, tvH, 0.03]} />
              <meshStandardMaterial color="#111" roughness={0.4} metalness={0.3} />
            </mesh>
            <mesh position={[0, standH + tvH / 2 + 0.02, 0.016]}>
              <planeGeometry args={[tvW - 0.04, tvH - 0.04]} />
              <meshStandardMaterial color="#0a0a1a" roughness={0.05} metalness={0.2} />
            </mesh>
            <mesh castShadow position={[0, standH + 0.01, -0.06]}>
              <boxGeometry args={[tvW * 0.35, 0.02, 0.14]} />
              <meshStandardMaterial color="#222" roughness={0.3} metalness={0.5} />
            </mesh>
            <mesh castShadow position={[0, standH + 0.05, -0.06]}>
              <boxGeometry args={[0.04, 0.06, 0.04]} />
              <meshStandardMaterial color="#222" roughness={0.3} metalness={0.5} />
            </mesh>
          </group>
        )
      }

      case 'bookshelf':
      case 'bookshelf_wide':
      case 'bookshelf_modular': {
        const shelves = 5
        const shelfGap = (h - 0.04) / shelves
        return (
          <group>
            <mesh castShadow position={[-w / 2 + 0.015, h / 2, 0]}>
              <boxGeometry args={[0.03, h, d]} />
              {mat}
            </mesh>
            <mesh castShadow position={[w / 2 - 0.015, h / 2, 0]}>
              <boxGeometry args={[0.03, h, d]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, h - 0.015, 0]}>
              <boxGeometry args={[w, 0.03, d]} />
              {mat}
            </mesh>
            {Array.from({ length: shelves }).map((_, i) => (
              <mesh key={i} castShadow receiveShadow position={[0, 0.015 + i * shelfGap, 0]}>
                <boxGeometry args={[w - 0.04, 0.025, d]} />
                {mat}
              </mesh>
            ))}
            {Array.from({ length: shelves - 1 }).map((_, i) => {
              const colors = ['#8B4513', '#CD853F', '#A0522D', '#D2691E']
              return (
                <mesh key={`b-${i}`} castShadow position={[Math.sin(i * 1.5) * (w * 0.2), 0.03 + i * shelfGap + shelfGap * 0.35, 0]}>
                  <boxGeometry args={[w * 0.65, shelfGap * 0.6, d * 0.85]} />
                  <meshStandardMaterial color={colors[i % colors.length]} roughness={0.8} />
                </mesh>
              )
            })}
          </group>
        )
      }

      // ═══════════ ARMARIOS ═══════════
      case 'wardrobe':
      case 'wardrobe_large':
      case 'wardrobe_small':
      case 'murphy_bed': {
        const doors = Math.round(w / 0.6)
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh position={[0, h - 0.02, 0]}>
              <boxGeometry args={[w + 0.01, 0.035, d + 0.01]} />
              {matDark}
            </mesh>
            <mesh position={[0, 0.02, 0]}>
              <boxGeometry args={[w + 0.01, 0.035, d + 0.01]} />
              {matDark}
            </mesh>
            {Array.from({ length: doors - 1 }).map((_, i) => (
              <mesh key={i} position={[-w / 2 + (i + 1) * (w / doors), h / 2, d / 2 + 0.004]}>
                <planeGeometry args={[0.008, h - 0.1]} />
                <meshStandardMaterial color="#444" />
              </mesh>
            ))}
            {Array.from({ length: doors }).map((_, i) => (
              <mesh key={`h-${i}`} castShadow position={[-w / 2 + (i + 0.5) * (w / doors) + 0.06, h / 2, d / 2 + 0.008]}>
                <boxGeometry args={[0.02, 0.10, 0.015]} />
                {chromeMat}
              </mesh>
            ))}
          </group>
        )
      }

      case 'wardrobe_sliding':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh castShadow position={[-w * 0.25, h / 2, d / 2 + 0.005]}>
              <boxGeometry args={[w * 0.52, h - 0.08, 0.018]} />
              {matDark}
            </mesh>
            <mesh castShadow position={[w * 0.25, h / 2, d / 2 + 0.012]}>
              <boxGeometry args={[w * 0.52, h - 0.08, 0.018]} />
              {mat}
            </mesh>
            <mesh castShadow position={[w * 0.25 - w * 0.24, h / 2, d / 2 + 0.024]}>
              <boxGeometry args={[0.02, 0.10, 0.015]} />
              {chromeMat}
            </mesh>
          </group>
        )

      case 'dresser':
      case 'nightstand': {
        const drawers = item.type === 'nightstand' ? 2 : 4
        const drawerH = (h - 0.06) / drawers
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh position={[0, h, 0]}>
              <boxGeometry args={[w + 0.01, 0.02, d + 0.01]} />
              {matDark}
            </mesh>
            {Array.from({ length: drawers }).map((_, i) => (
              <group key={i}>
                <mesh position={[0, 0.03 + (i + 0.5) * drawerH, d / 2 + 0.004]}>
                  <planeGeometry args={[w - 0.06, drawerH - 0.01]} />
                  {matDark}
                </mesh>
                <mesh castShadow position={[0, 0.03 + (i + 0.5) * drawerH, d / 2 + 0.008]}>
                  <boxGeometry args={[0.06, 0.015, 0.015]} />
                  {chromeMat}
                </mesh>
              </group>
            ))}
          </group>
        )
      }

      case 'vanity': {
        const lh = h - 0.035
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h - 0.018, 0]}>
              <boxGeometry args={[w, 0.035, d]} />
              {mat}
            </mesh>
            {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([lx, lz], i) => (
              <mesh key={i} castShadow position={[lx * (w / 2 - 0.04), lh / 2, lz * (d / 2 - 0.04)]}>
                <boxGeometry args={[0.04, lh, 0.04]} />
                {mat}
              </mesh>
            ))}
            <mesh castShadow position={[0, h + 0.25, -d / 2 + 0.025]}>
              <boxGeometry args={[w * 0.6, 0.45, 0.03]} />
              <meshPhysicalMaterial color="#c8d8e8" roughness={0.05} metalness={0.5} />
            </mesh>
          </group>
        )
      }

      case 'mirror_standing':
        return (
          <group>
            <mesh castShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, 0.04]} />
              {mat}
            </mesh>
            <mesh position={[0, h / 2, 0.022]}>
              <planeGeometry args={[w - 0.06, h - 0.08]} />
              <meshPhysicalMaterial color="#c8d8e8" roughness={0.02} metalness={0.7} />
            </mesh>
          </group>
        )

      // ═══════════ COCINA ═══════════
      case 'kitchen_counter':
      case 'kitchen_counter_short':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, (h - 0.04) / 2, 0]}>
              <boxGeometry args={[w, h - 0.04, d]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, h - 0.02, 0]}>
              <boxGeometry args={[w + 0.02, 0.04, d + 0.02]} />
              <meshStandardMaterial color={isSelected ? '#5B8DEF' : smCountertop.color} roughness={smCountertop.roughness} metalness={smCountertop.metalness} />
            </mesh>
            <mesh position={[0, h * 0.4, d / 2 + 0.004]}>
              <boxGeometry args={[0.06, 0.015, 0.015]} />
              {chromeMat}
            </mesh>
          </group>
        )

      case 'kitchen_island':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, (h - 0.04) / 2, 0]}>
              <boxGeometry args={[w, h - 0.04, d]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, h - 0.02, 0]}>
              <boxGeometry args={[w + 0.04, 0.04, d + 0.04]} />
              <meshStandardMaterial color={isSelected ? '#5B8DEF' : smCountertop.color} roughness={smCountertop.roughness} metalness={smCountertop.metalness} />
            </mesh>
          </group>
        )

      case 'kitchen_counter_upper': {
        const counterH = 0.9
        const upperH = 0.7
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, (counterH - 0.04) / 2, 0]}>
              <boxGeometry args={[w, counterH - 0.04, d]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, counterH - 0.02, 0]}>
              <boxGeometry args={[w + 0.02, 0.04, d + 0.02]} />
              <meshStandardMaterial color="#e8e0d8" roughness={0.3} metalness={0.05} />
            </mesh>
            <mesh castShadow receiveShadow position={[0, counterH + upperH / 2, 0]}>
              <boxGeometry args={[w, upperH, d * 0.58]} />
              {mat}
            </mesh>
            {Array.from({ length: Math.round(w / 0.6) }).map((_, i) => {
              const doorW = w / Math.round(w / 0.6)
              return (
                <mesh key={i} castShadow position={[-w / 2 + (i + 0.5) * doorW, counterH + upperH / 2, d * 0.29 + 0.008]}>
                  <boxGeometry args={[0.02, 0.10, 0.015]} />
                  {chromeMat}
                </mesh>
              )
            })}
          </group>
        )
      }

      case 'kitchen_counter_microwave': {
        const counterH = 0.9
        const mwW = 0.5
        const mwD = 0.38
        const mwH = 0.30
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, (counterH - 0.04) / 2, 0]}>
              <boxGeometry args={[w, counterH - 0.04, d]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, counterH - 0.02, 0]}>
              <boxGeometry args={[w + 0.02, 0.04, d + 0.02]} />
              <meshStandardMaterial color="#e8e0d8" roughness={0.3} metalness={0.05} />
            </mesh>
            <mesh castShadow receiveShadow position={[0, counterH + mwH / 2, 0]}>
              <boxGeometry args={[mwW, mwH, mwD]} />
              <meshStandardMaterial color="#2F2F2F" roughness={0.2} metalness={0.3} />
            </mesh>
            <mesh position={[-mwW * 0.1, counterH + mwH / 2, mwD / 2 + 0.003]}>
              <planeGeometry args={[mwW * 0.55, mwH - 0.06]} />
              <meshStandardMaterial color="#111" roughness={0.1} />
            </mesh>
            <mesh position={[mwW * 0.33, counterH + mwH / 2, mwD / 2 + 0.005]}>
              <cylinderGeometry args={[0.02, 0.02, 0.005, 16]} />
              {chromeMat}
            </mesh>
          </group>
        )
      }

      case 'fridge':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh position={[w * 0.3, h * 0.72, d / 2 + 0.008]}>
              <boxGeometry args={[0.02, 0.15, 0.02]} />
              {chromeMat}
            </mesh>
            <mesh position={[w * 0.3, h * 0.32, d / 2 + 0.008]}>
              <boxGeometry args={[0.02, 0.12, 0.02]} />
              {chromeMat}
            </mesh>
            <mesh position={[0, h * 0.52, d / 2 + 0.003]}>
              <planeGeometry args={[w - 0.04, 0.006]} />
              <meshStandardMaterial color="#555" />
            </mesh>
          </group>
        )

      case 'fridge_double':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh position={[0, h * 0.66, d / 2 + 0.003]}>
              <planeGeometry args={[0.006, h * 0.58]} />
              <meshStandardMaterial color="#555" />
            </mesh>
            <mesh position={[-w * 0.18, h * 0.66, d / 2 + 0.008]}>
              <boxGeometry args={[0.02, 0.20, 0.02]} />
              {chromeMat}
            </mesh>
            <mesh position={[w * 0.18, h * 0.66, d / 2 + 0.008]}>
              <boxGeometry args={[0.02, 0.20, 0.02]} />
              {chromeMat}
            </mesh>
            <mesh position={[0, h * 0.18, d / 2 + 0.008]}>
              <boxGeometry args={[0.14, 0.02, 0.02]} />
              {chromeMat}
            </mesh>
          </group>
        )

      case 'stove':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh position={[0, h + 0.001, 0]}>
              <boxGeometry args={[w - 0.02, 0.005, d - 0.02]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.1} />
            </mesh>
            {[[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]].map(([bx, bz], i) => (
              <mesh key={i} position={[bx, h + 0.005, bz]}>
                <cylinderGeometry args={[0.06, 0.06, 0.005, 16]} />
                <meshStandardMaterial color="#333" roughness={0.15} metalness={0.4} />
              </mesh>
            ))}
          </group>
        )

      case 'induction_cooktop':
      case 'induction_cooktop_90': {
        const baseH = 0.02
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, baseH / 2, 0]}>
              <boxGeometry args={[w + 0.04, baseH, d + 0.04]} />
              <meshStandardMaterial color="#E8E4E0" roughness={0.3} metalness={0.02} />
            </mesh>
            <mesh castShadow receiveShadow position={[0, baseH + h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color="#0d0d0d" roughness={0.05} metalness={0.1} />
            </mesh>
            {[[-0.18, -0.12], [0.18, -0.12], [-0.18, 0.12], [0.18, 0.12]].map(([bx, bz], i) => (
              <mesh key={i} position={[bx * (w / 0.6), baseH + h + 0.002, bz * (d / 0.52)]}>
                <cylinderGeometry args={[0.08, 0.08, 0.003, 24]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.1} metalness={0.2} />
              </mesh>
            ))}
          </group>
        )
      }

      case 'gas_cooktop':
      case 'gas_cooktop_90': {
        const baseH = 0.02
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, baseH / 2, 0]}>
              <boxGeometry args={[w + 0.04, baseH, d + 0.04]} />
              <meshStandardMaterial color="#E8E4E0" roughness={0.3} metalness={0.02} />
            </mesh>
            <mesh castShadow receiveShadow position={[0, baseH + h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            {[[-0.18, -0.12], [0.18, -0.12], [-0.18, 0.12], [0.18, 0.12]].map(([bx, bz], i) => (
              <mesh key={i} position={[bx * (w / 0.6), baseH + h + 0.003, bz * (d / 0.55)]}>
                <cylinderGeometry args={[0.07, 0.07, 0.008, 16]} />
                <meshStandardMaterial color="#2a2a2a" roughness={0.2} metalness={0.5} />
              </mesh>
            ))}
          </group>
        )
      }

      case 'oven_builtin':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh position={[0, h * 0.85, d / 2 + 0.01]}>
              <boxGeometry args={[w - 0.04, 0.02, 0.02]} />
              {chromeMat}
            </mesh>
            <mesh position={[0, h * 0.5, d / 2 + 0.003]}>
              <boxGeometry args={[w - 0.1, h * 0.55, 0.008]} />
              <meshPhysicalMaterial color="#1a1a1a" roughness={0.2} metalness={0.15} transmission={0.3} thickness={0.5} />
            </mesh>
            <mesh position={[0, h * 0.2, d / 2 + 0.006]}>
              <boxGeometry args={[w - 0.12, 0.02, 0.01]} />
              <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.2} />
            </mesh>
          </group>
        )

      case 'range_hood':
      case 'range_hood_90':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, h * 0.3, d / 2 + 0.08]}>
              <boxGeometry args={[w - 0.06, h * 0.5, 0.12]} />
              <meshStandardMaterial color="#e0e0e0" roughness={0.25} metalness={0.3} />
            </mesh>
            <mesh position={[0, h * 0.75, d / 2 + 0.02]}>
              <boxGeometry args={[w * 0.15, 0.03, 0.02]} />
              <meshStandardMaterial color="#333" roughness={0.2} metalness={0.6} />
            </mesh>
          </group>
        )

      case 'dishwasher':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh position={[0, h * 0.75, d / 2 + 0.006]}>
              <boxGeometry args={[0.14, 0.02, 0.015]} />
              {chromeMat}
            </mesh>
          </group>
        )

      // ═══════════ BAÑO ═══════════
      case 'toilet':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, 0.18, 0.05]}>
              <boxGeometry args={[0.36, 0.36, 0.44]} />
              {ceramicWhite}
            </mesh>
            <mesh castShadow position={[0, 0.05, 0.05]}>
              <boxGeometry args={[0.32, 0.10, 0.42]} />
              {ceramicWhite}
            </mesh>
            <mesh castShadow position={[0, 0.37, 0.05]}>
              <boxGeometry args={[0.34, 0.02, 0.42]} />
              {ceramicWhite}
            </mesh>
            <mesh castShadow position={[0, 0.30, -0.18]}>
              <boxGeometry args={[0.34, 0.30, 0.14]} />
              {ceramicWhite}
            </mesh>
            <mesh castShadow position={[0, 0.47, -0.18]}>
              <boxGeometry args={[0.28, 0.04, 0.12]} />
              {chromeMat}
            </mesh>
          </group>
        )

      case 'toilet_wall':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, 0.22, 0.06]}>
              <boxGeometry args={[0.36, 0.20, 0.44]} />
              {ceramicWhite}
            </mesh>
            <mesh castShadow position={[0, 0.33, 0.06]}>
              <boxGeometry args={[0.34, 0.02, 0.42]} />
              {ceramicWhite}
            </mesh>
            <mesh castShadow position={[0, 0.30, -0.20]}>
              <boxGeometry args={[0.50, 0.50, 0.10]} />
              <meshStandardMaterial color="#e0e0e0" roughness={0.5} />
            </mesh>
            <mesh castShadow position={[0, 0.58, -0.16]}>
              <boxGeometry args={[0.22, 0.06, 0.06]} />
              {chromeMat}
            </mesh>
          </group>
        )

      case 'bidet':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, 0.20, 0]}>
              <boxGeometry args={[0.36, 0.20, 0.50]} />
              {ceramicWhite}
            </mesh>
            <mesh castShadow position={[0, 0.08, 0]}>
              <boxGeometry args={[0.30, 0.08, 0.44]} />
              {ceramicWhite}
            </mesh>
            <mesh position={[0, 0.32, -0.12]}>
              <cylinderGeometry args={[0.015, 0.015, 0.06, 8]} />
              {chromeMat}
            </mesh>
          </group>
        )

      case 'sink':
      case 'sink_double':
      case 'bathroom_vanity': {
        const bowls = item.type === 'sink_double' ? 2 : 1
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, (h - 0.06) / 2, 0]}>
              <boxGeometry args={[w, h - 0.06, d]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, h - 0.03, 0]}>
              <boxGeometry args={[w, 0.06, d]} />
              {ceramicWhite}
            </mesh>
            {Array.from({ length: bowls }).map((_, i) => {
              const xOff = bowls === 2 ? (i === 0 ? -w / 4 : w / 4) : 0
              return (
                <group key={i}>
                  <mesh position={[xOff, h - 0.01, 0.02]}>
                    <boxGeometry args={[w / bowls - 0.12, 0.06, d - 0.14]} />
                    <meshStandardMaterial color="#dde8f0" roughness={0.2} />
                  </mesh>
                  <mesh position={[xOff, h + 0.06, -d / 2 + 0.06]}>
                    <cylinderGeometry args={[0.012, 0.012, 0.12, 8]} />
                    {chromeMat}
                  </mesh>
                </group>
              )
            })}
          </group>
        )
      }

      case 'sink_pedestal':
        return (
          <group>
            <mesh castShadow position={[0, h / 2, 0]}>
              <cylinderGeometry args={[0.08, 0.12, h - 0.12, 12]} />
              {ceramicWhite}
            </mesh>
            <mesh castShadow receiveShadow position={[0, h - 0.04, 0]}>
              <boxGeometry args={[w, 0.08, d]} />
              {ceramicWhite}
            </mesh>
            <mesh position={[0, h + 0.06, -d / 2 + 0.05]}>
              <cylinderGeometry args={[0.012, 0.012, 0.12, 8]} />
              {chromeMat}
            </mesh>
          </group>
        )

      case 'bathtub':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {ceramicWhite}
            </mesh>
            <mesh position={[0, h / 2 + 0.02, 0]}>
              <boxGeometry args={[w - 0.08, h - 0.08, d - 0.08]} />
              <meshStandardMaterial color="#d8e8f0" roughness={0.2} />
            </mesh>
            <mesh position={[0, h + 0.005, -d / 2 + 0.08]}>
              <cylinderGeometry args={[0.015, 0.015, 0.06, 8]} />
              {chromeMat}
            </mesh>
          </group>
        )

      case 'bathtub_freestanding':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h * 0.45, 0]}>
              <boxGeometry args={[w, h * 0.7, d]} />
              {ceramicWhite}
            </mesh>
            <mesh position={[0, h * 0.45, 0]}>
              <boxGeometry args={[w - 0.08, h * 0.7 - 0.06, d - 0.08]} />
              <meshStandardMaterial color="#d8e8f0" roughness={0.2} />
            </mesh>
            {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([lx, lz], i) => (
              <mesh key={i} castShadow position={[lx * (w / 2 - 0.06), 0.04, lz * (d / 2 - 0.08)]}>
                <sphereGeometry args={[0.04, 8, 8]} />
                {chromeMat}
              </mesh>
            ))}
          </group>
        )

      case 'shower':
      case 'shower_rect':
      case 'shower_walkin':
        return (
          <group>
            <mesh receiveShadow position={[0, 0.03, 0]}>
              <boxGeometry args={[w, 0.06, d]} />
              <meshStandardMaterial color="#e0e0e0" roughness={0.2} />
            </mesh>
            <mesh castShadow position={[w / 2, 1.05, 0]}>
              <boxGeometry args={[0.015, 2.1, d]} />
              {glassMat}
            </mesh>
            <mesh castShadow position={[0, 1.05, d / 2]}>
              <boxGeometry args={[w, 2.1, 0.015]} />
              {glassMat}
            </mesh>
            <mesh position={[w / 2, 2.1, 0]}>
              <boxGeometry args={[0.025, 0.025, d]} />
              {chromeMat}
            </mesh>
            <mesh position={[0, 2.1, d / 2]}>
              <boxGeometry args={[w, 0.025, 0.025]} />
              {chromeMat}
            </mesh>
            <mesh position={[-w / 3, 1.9, -d / 3]}>
              <cylinderGeometry args={[0.06, 0.06, 0.02, 16]} />
              {chromeMat}
            </mesh>
            <mesh position={[-w / 3, 1.45, -d / 2 + 0.02]}>
              <boxGeometry args={[0.02, 0.9, 0.02]} />
              {chromeMat}
            </mesh>
          </group>
        )

      case 'towel_rack':
        return (
          <group position={[0, 0, -d / 2]}>
            {[-1, 1].map((s, i) => (
              <mesh key={i} castShadow position={[s * (w / 2 - 0.04), h / 2, 0.02]}>
                <boxGeometry args={[0.02, h, 0.02]} />
                {chromeMat}
              </mesh>
            ))}
            {[0.3, 0.55, 0.75].map((frac, i) => (
              <mesh key={i} castShadow position={[0, h * frac, 0.05]}>
                <boxGeometry args={[w - 0.06, 0.015, 0.015]} />
                {chromeMat}
              </mesh>
            ))}
          </group>
        )

      case 'bathroom_cabinet':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh position={[0, h / 2, d / 2 + 0.004]}>
              <planeGeometry args={[0.008, h - 0.06]} />
              <meshStandardMaterial color="#555" />
            </mesh>
            {[-0.25, 0.25].map((frac, i) => (
              <mesh key={i} castShadow position={[w * 0.12 * (i === 0 ? -1 : 1), h * (0.5 + frac * 0.3), d / 2 + 0.008]}>
                <boxGeometry args={[0.02, 0.03, 0.015]} />
                {chromeMat}
              </mesh>
            ))}
          </group>
        )

      case 'washing_machine':
      case 'dryer':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh position={[0, h * 0.52, d / 2 + 0.005]}>
              <cylinderGeometry args={[w * 0.28, w * 0.28, 0.01, 24]} />
              <meshStandardMaterial color="#333" roughness={0.1} metalness={0.3} />
            </mesh>
            <mesh position={[0, h * 0.52, d / 2 + 0.012]}>
              <cylinderGeometry args={[w * 0.22, w * 0.22, 0.008, 24]} />
              {glassMat}
            </mesh>
            <mesh position={[w * 0.3, h * 0.85, d / 2 + 0.005]}>
              <boxGeometry args={[0.1, 0.03, 0.01]} />
              <meshStandardMaterial color="#444" roughness={0.2} metalness={0.5} />
            </mesh>
          </group>
        )

      case 'washer_dryer_stack':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 4, 0]}>
              <boxGeometry args={[w, h / 2, d]} />
              {mat}
            </mesh>
            <mesh castShadow receiveShadow position={[0, h * 0.75, 0]}>
              <boxGeometry args={[w, h / 2, d]} />
              {mat}
            </mesh>
            <mesh position={[0, h * 0.25, d / 2 + 0.005]}>
              <cylinderGeometry args={[w * 0.28, w * 0.28, 0.01, 24]} />
              <meshStandardMaterial color="#333" roughness={0.1} metalness={0.3} />
            </mesh>
            <mesh position={[0, h * 0.25, d / 2 + 0.012]}>
              <cylinderGeometry args={[w * 0.22, w * 0.22, 0.008, 24]} />
              {glassMat}
            </mesh>
            <mesh position={[0, h * 0.75, d / 2 + 0.005]}>
              <cylinderGeometry args={[w * 0.2, w * 0.2, 0.01, 24]} />
              <meshStandardMaterial color="#444" roughness={0.2} metalness={0.4} />
            </mesh>
            <mesh position={[w * 0.3, h * 0.9, d / 2 + 0.005]}>
              <boxGeometry args={[0.1, 0.03, 0.01]} />
              <meshStandardMaterial color="#444" roughness={0.2} metalness={0.5} />
            </mesh>
          </group>
        )

      case 'water_heater':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <cylinderGeometry args={[w / 2, w / 2, h, 24]} />
              {mat}
            </mesh>
            <mesh position={[0, h - 0.05, 0]}>
              <boxGeometry args={[w * 0.4, 0.04, d * 0.4]} />
              <meshStandardMaterial color="#333" roughness={0.2} metalness={0.5} />
            </mesh>
            <mesh position={[0, h * 0.15, d / 2 + 0.01]}>
              <cylinderGeometry args={[0.02, 0.02, 0.06, 8]} />
              {chromeMat}
            </mesh>
          </group>
        )

      // ═══════════ ILUMINACIÓN ═══════════
      case 'floor_lamp':
        return (
          <group>
            <mesh castShadow position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.15, 0.18, 0.03, 16]} />
              {chromeMat}
            </mesh>
            <mesh castShadow position={[0, 0.85, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 1.6, 8]} />
              {chromeMat}
            </mesh>
            <mesh position={[0, 1.58, 0]}>
              <coneGeometry args={[0.18, 0.28, 16, 1, true]} />
              <meshStandardMaterial color="#f5e6c8" side={THREE.DoubleSide} roughness={0.85} />
            </mesh>
            <pointLight position={[0, 1.5, 0]} intensity={0.6} distance={5} color="#fff5e0" />
          </group>
        )

      case 'side_table_lamp': {
        const tableH = 0.55
        const lampBaseY = tableH + 0.015
        const lampNeckY = tableH + 0.22
        const lampShadeY = tableH + 0.45
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, tableH - 0.015, 0]}>
              <cylinderGeometry args={[w / 2, w / 2, 0.03, 24]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, tableH / 2, 0]}>
              <cylinderGeometry args={[0.015, 0.015, tableH - 0.06, 8]} />
              {chromeMat}
            </mesh>
            <mesh castShadow position={[0, 0.01, 0]}>
              <cylinderGeometry args={[w * 0.35, w * 0.35, 0.02, 24]} />
              {chromeMat}
            </mesh>
            <mesh castShadow position={[0, lampBaseY, 0]}>
              <cylinderGeometry args={[0.08, 0.09, 0.03, 12]} />
              {chromeMat}
            </mesh>
            <mesh castShadow position={[0, lampNeckY, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 0.35, 8]} />
              {chromeMat}
            </mesh>
            <mesh position={[0, lampShadeY, 0]}>
              <coneGeometry args={[0.11, 0.16, 12, 1, true]} />
              <meshStandardMaterial color="#f5e6c8" side={THREE.DoubleSide} roughness={0.85} />
            </mesh>
            <pointLight position={[0, lampShadeY - 0.05, 0]} intensity={0.3} distance={2.5} color="#fff5e0" />
          </group>
        )
      }

      case 'ceiling_lamp': {
        const yBase = ceilingHeight - 0.02
        return (
          <group position={[0, yBase, 0]}>
            <mesh castShadow position={[0, -h / 2, 0]}>
              <cylinderGeometry args={[w * 0.45, w * 0.5, h, 24]} />
              <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, -h / 2 + 0.01, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.04, 8]} />
              {chromeMat}
            </mesh>
            <pointLight position={[0, -h / 2 - 0.15, 0]} intensity={0.8} distance={6} color="#fff8e8" />
          </group>
        )
      }

      case 'pendant_lamp': {
        const dropLen = 0.35
        const yBase = ceilingHeight - 0.02
        return (
          <group position={[0, yBase, 0]}>
            <mesh position={[0, -dropLen / 2, 0]}>
              <cylinderGeometry args={[0.005, 0.005, dropLen, 4]} />
              {chromeMat}
            </mesh>
            <mesh castShadow position={[0, -dropLen, 0]}>
              <sphereGeometry args={[w / 2, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} side={THREE.DoubleSide} />
            </mesh>
            <pointLight position={[0, -dropLen - 0.1, 0]} intensity={0.6} distance={4} color="#fff8e8" />
          </group>
        )
      }

      case 'ceiling_fan': {
        const yBase = ceilingHeight - 0.03
        const bladeRadius = Math.min(w, d) / 2
        const bladeLength = bladeRadius
        const bladeWidth = Math.min(w, d) * 0.1
        const bladePos = bladeRadius / 2
        return (
          <group position={[0, yBase, 0]}>
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.05, 0.08, 12]} />
              {chromeMat}
            </mesh>
            <mesh castShadow position={[0, -0.12, 0]}>
              <sphereGeometry args={[0.06, 12, 8]} />
              {mat}
            </mesh>
            {[0, 1, 2, 3].map((i) => {
              const a = (i / 4) * Math.PI * 2
              return (
                <mesh key={i} castShadow position={[Math.cos(a) * bladePos, -0.12, Math.sin(a) * bladePos]} rotation={[0, -a, 0]}>
                  <boxGeometry args={[bladeLength, 0.02, bladeWidth]} />
                  {mat}
                </mesh>
              )
            })}
          </group>
        )
      }

      case 'spotlight_ceiling': {
        const yBase = ceilingHeight - h / 2 - 0.01
        return (
          <group position={[0, yBase, 0]}>
            <mesh castShadow position={[0, 0, 0]}>
              <cylinderGeometry args={[w / 2, w / 2 * 1.1, h, 16]} />
              {mat}
            </mesh>
            <pointLight position={[0, -0.05, 0]} intensity={0.5} distance={3} color="#fff8e8" decay={2} />
          </group>
        )
      }

      // ═══════════ PLANTAS ═══════════
      case 'plant':
      case 'plant_small': {
        const potH2 = h * 0.25
        return (
          <group>
            <mesh castShadow position={[0, potH2 / 2, 0]}>
              <cylinderGeometry args={[w * 0.32, w * 0.26, potH2, 12]} />
              <meshStandardMaterial color="#7A4E2D" roughness={0.85} />
            </mesh>
            <mesh castShadow position={[0, potH2 - 0.01, 0]}>
              <cylinderGeometry args={[w * 0.28, w * 0.28, 0.02, 12]} />
              <meshStandardMaterial color="#3A2818" roughness={0.8} />
            </mesh>
            <mesh castShadow position={[0, h * 0.58, 0]}>
              <sphereGeometry args={[w * 0.42, 12, 10]} />
              <meshStandardMaterial color="#2d7a2d" roughness={0.9} />
            </mesh>
            <mesh castShadow position={[w * 0.12, h * 0.72, w * 0.08]}>
              <sphereGeometry args={[w * 0.25, 8, 6]} />
              <meshStandardMaterial color="#3a8a3a" roughness={0.9} />
            </mesh>
          </group>
        )
      }

      case 'side_table_plant': {
        const tableH = h * 0.5
        const potH = h * 0.2
        const legH = tableH * 0.55
        const topH = 0.025
        const legW = 0.025
        return (
          <group>
            {/* Tablero */}
            <mesh castShadow receiveShadow position={[0, tableH - topH / 2, 0]}>
              <boxGeometry args={[w, topH, d]} />
              <meshStandardMaterial color="#C4A882" roughness={0.65} metalness={0.0} />
            </mesh>
            {/* 4 patas */}
            {[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sz], li) => (
              <mesh key={li} castShadow position={[sx * (w/2 - legW), legH / 2, sz * (d/2 - legW)]}>
                <boxGeometry args={[legW, legH, legW]} />
                <meshStandardMaterial color="#A08060" roughness={0.7} />
              </mesh>
            ))}
            {/* Maceta */}
            <mesh castShadow position={[0, tableH + potH / 2, 0]}>
              <cylinderGeometry args={[w * 0.22, w * 0.18, potH, 12]} />
              <meshStandardMaterial color="#7A4E2D" roughness={0.85} />
            </mesh>
            {/* Tierra */}
            <mesh position={[0, tableH + potH - 0.01, 0]}>
              <cylinderGeometry args={[w * 0.20, w * 0.20, 0.02, 12]} />
              <meshStandardMaterial color="#3A2818" roughness={0.8} />
            </mesh>
            {/* Planta — follaje */}
            <mesh castShadow position={[0, tableH + potH + h * 0.18, 0]}>
              <sphereGeometry args={[w * 0.30, 12, 10]} />
              <meshStandardMaterial color="#2d7a2d" roughness={0.9} />
            </mesh>
            <mesh castShadow position={[w * 0.06, tableH + potH + h * 0.26, w * 0.04]}>
              <sphereGeometry args={[w * 0.18, 8, 6]} />
              <meshStandardMaterial color="#3a8a3a" roughness={0.9} />
            </mesh>
          </group>
        )
      }

      case 'plant_tree': {
        const trunkH = h * 0.45
        return (
          <group>
            <mesh castShadow position={[0, 0.06, 0]}>
              <cylinderGeometry args={[w * 0.38, w * 0.32, 0.12, 12]} />
              <meshStandardMaterial color="#7A4E2D" roughness={0.85} />
            </mesh>
            <mesh castShadow position={[0, trunkH / 2 + 0.12, 0]}>
              <cylinderGeometry args={[0.03, 0.04, trunkH, 8]} />
              <meshStandardMaterial color="#5C3D1A" roughness={0.9} />
            </mesh>
            <mesh castShadow position={[0, h * 0.65, 0]}>
              <sphereGeometry args={[w * 0.42, 12, 10]} />
              <meshStandardMaterial color="#1a6b1a" roughness={0.92} />
            </mesh>
            <mesh castShadow position={[-w * 0.15, h * 0.78, w * 0.1]}>
              <sphereGeometry args={[w * 0.3, 8, 6]} />
              <meshStandardMaterial color="#228B22" roughness={0.92} />
            </mesh>
            <mesh castShadow position={[w * 0.1, h * 0.58, -w * 0.08]}>
              <sphereGeometry args={[w * 0.28, 8, 6]} />
              <meshStandardMaterial color="#2d7a2d" roughness={0.92} />
            </mesh>
          </group>
        )
      }

      // ═══════════ DECORACIÓN ═══════════
      case 'wall_art':
      case 'wall_art_small':
        return (
          <group position={[0, 1.5, 0]}>
            {/* Marco */}
            <mesh castShadow>
              <boxGeometry args={[w, h, 0.03]} />
              {mat}
            </mesh>
            {/* Lienzo con pintura procedural */}
            <PaintingCanvas w={w - 0.06} h={h - 0.06} seed={item.id} />
          </group>
        )

      case 'mirror_wall':
        return (
          <group position={[0, 1.3, 0]}>
            <mesh castShadow>
              <boxGeometry args={[w, h, 0.03]} />
              <meshStandardMaterial color="#888" roughness={0.3} metalness={0.5} />
            </mesh>
            <mesh position={[0, 0, 0.016]}>
              <planeGeometry args={[w - 0.04, h - 0.04]} />
              <meshPhysicalMaterial color="#c8d8e8" roughness={0.02} metalness={0.7} />
            </mesh>
          </group>
        )

      case 'fireplace':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh position={[0, h * 0.42, d / 2 + 0.003]}>
              <boxGeometry args={[w * 0.6, h * 0.45, 0.01]} />
              <meshStandardMaterial color="#1a0a00" roughness={0.9} />
            </mesh>
            <mesh position={[0, h - 0.03, 0]}>
              <boxGeometry args={[w + 0.06, 0.06, d + 0.04]} />
              {matDark}
            </mesh>
            <pointLight position={[0, h * 0.35, d / 2 + 0.1]} intensity={0.4} distance={3} color="#ff8833" />
          </group>
        )

      case 'fireplace_modern':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh position={[0, h * 0.5, d / 2 + 0.003]}>
              <boxGeometry args={[w - 0.2, h * 0.5, 0.01]} />
              <meshStandardMaterial color="#1a0a00" roughness={0.9} />
            </mesh>
            <mesh position={[0, h - 0.02, 0]}>
              <boxGeometry args={[w + 0.04, 0.04, d + 0.02]} />
              {mat}
            </mesh>
            <pointLight position={[0, h * 0.45, d / 2 + 0.1]} intensity={0.35} distance={3} color="#ff8833" />
          </group>
        )

      case 'fireplace_bioethanol':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh position={[0, h * 0.55, d / 2 + 0.004]}>
              <boxGeometry args={[w - 0.15, h * 0.35, 0.008]} />
              <meshStandardMaterial color="#1a0a00" roughness={0.9} />
            </mesh>
            <mesh position={[0, h - 0.01, 0]}>
              <boxGeometry args={[w, 0.02, d]} />
              {mat}
            </mesh>
            <pointLight position={[0, h * 0.5, d / 2 + 0.08]} intensity={0.3} distance={2.5} color="#ff8833" />
          </group>
        )

      case 'fireplace_insert':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh position={[0, h * 0.48, d / 2 + 0.003]}>
              <boxGeometry args={[w - 0.12, h * 0.5, 0.01]} />
              <meshStandardMaterial color="#0a0500" roughness={0.95} />
            </mesh>
            <mesh position={[0, h * 0.48, d / 2 + 0.008]}>
              <boxGeometry args={[0.03, h * 0.5, 0.02]} />
              {chromeMat}
            </mesh>
            <pointLight position={[0, h * 0.4, d / 2 + 0.1]} intensity={0.4} distance={3} color="#ff8833" />
          </group>
        )

      case 'pellet_stove':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh position={[0, h * 0.6, d / 2 + 0.004]}>
              <boxGeometry args={[w - 0.1, h * 0.25, 0.01]} />
              <meshStandardMaterial color="#1a0a00" roughness={0.9} />
            </mesh>
            <mesh position={[0, h - 0.02, 0]}>
              <boxGeometry args={[w + 0.04, 0.04, d + 0.02]} />
              {mat}
            </mesh>
            <mesh position={[0, h + 0.08, 0]}>
              <cylinderGeometry args={[0.04, 0.05, 0.15, 8]} />
              {mat}
            </mesh>
            <pointLight position={[0, h * 0.55, d / 2 + 0.08]} intensity={0.35} distance={2.5} color="#ff8833" />
          </group>
        )

      case 'radiator':
        return (
          <group>
            {Array.from({ length: Math.round(w / 0.08) }).map((_, i) => (
              <mesh key={i} castShadow position={[-w / 2 + 0.04 + i * 0.08, h / 2, 0]}>
                <boxGeometry args={[0.05, h, d]} />
                {mat}
              </mesh>
            ))}
          </group>
        )

      case 'air_conditioner':
        return (
          <group position={[0, 2.3, 0]}>
            <mesh castShadow receiveShadow position={[0, 0, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            <mesh position={[0, -h * 0.3, d / 2 + 0.003]}>
              <boxGeometry args={[w - 0.06, h * 0.15, 0.01]} />
              <meshStandardMaterial color="#d0d0d0" roughness={0.3} />
            </mesh>
          </group>
        )

      case 'rug':
        return (
          <mesh receiveShadow position={[0, 0.005, 0]}>
            <boxGeometry args={[w, 0.01, d]} />
            {cushionMat}
          </mesh>
        )

      case 'rug_round':
        return (
          <mesh receiveShadow position={[0, 0.005, 0]}>
            <cylinderGeometry args={[w / 2, w / 2, 0.01, 32]} />
            {cushionMat}
          </mesh>
        )

      case 'shoe_rack': {
        const shelves = 4
        return (
          <group>
            <mesh castShadow position={[-w / 2 + 0.015, h / 2, 0]}>
              <boxGeometry args={[0.03, h, d]} />
              {mat}
            </mesh>
            <mesh castShadow position={[w / 2 - 0.015, h / 2, 0]}>
              <boxGeometry args={[0.03, h, d]} />
              {mat}
            </mesh>
            {Array.from({ length: shelves }).map((_, i) => (
              <mesh key={i} castShadow receiveShadow position={[0, 0.02 + i * (h / shelves), 0]}>
                <boxGeometry args={[w - 0.04, 0.02, d]} />
                {mat}
              </mesh>
            ))}
          </group>
        )
      }

      case 'coat_rack':
      case 'coat_rack_floor':
        return (
          <group>
            <mesh castShadow position={[0, 0.015, 0]}>
              <cylinderGeometry args={[w * 0.4, w * 0.4, 0.03, 12]} />
              {mat}
            </mesh>
            <mesh castShadow position={[0, h / 2, 0]}>
              <cylinderGeometry args={[0.02, 0.025, h - 0.06, 8]} />
              {mat}
            </mesh>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i * Math.PI * 2) / 6
              return (
                <mesh key={i} castShadow position={[Math.cos(a) * 0.12, h - 0.06, Math.sin(a) * 0.12]} rotation={[0, 0, Math.cos(a) * 0.5]}>
                  <cylinderGeometry args={[0.01, 0.01, 0.12, 6]} />
                  {mat}
                </mesh>
              )
            })}
          </group>
        )

      case 'storage_box':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            {/* Tapa */}
            <mesh castShadow position={[0, h + 0.005, 0]}>
              <boxGeometry args={[w + 0.01, 0.01, d + 0.01]} />
              {mat}
            </mesh>
          </group>
        )

      case 'storage_unit': {
        const drawerCount = Math.max(2, Math.round(h / 0.25))
        const drawerH = h / drawerCount
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              {mat}
            </mesh>
            {Array.from({ length: drawerCount }).map((_, i) => (
              <group key={i}>
                {/* Línea de separación */}
                <mesh position={[0, drawerH * (i + 1), d / 2 + 0.001]}>
                  <boxGeometry args={[w - 0.02, 0.005, 0.001]} />
                  <meshStandardMaterial color="#555" roughness={0.5} />
                </mesh>
                {/* Tirador */}
                <mesh position={[0, drawerH * i + drawerH / 2, d / 2 + 0.008]}>
                  <boxGeometry args={[w * 0.2, 0.015, 0.015]} />
                  <meshStandardMaterial color="#888" roughness={0.3} metalness={0.6} />
                </mesh>
              </group>
            ))}
          </group>
        )
      }

      case 'safe':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color="#3a3a3a" roughness={0.4} metalness={0.7} />
            </mesh>
            {/* Dial */}
            <mesh position={[w * 0.15, h * 0.55, d / 2 + 0.005]}>
              <cylinderGeometry args={[0.04, 0.04, 0.01, 16]} />
              <meshStandardMaterial color="#888" roughness={0.2} metalness={0.8} />
            </mesh>
            {/* Tirador */}
            <mesh position={[-w * 0.15, h * 0.55, d / 2 + 0.01]}>
              <boxGeometry args={[0.06, 0.015, 0.02]} />
              <meshStandardMaterial color="#999" roughness={0.2} metalness={0.8} />
            </mesh>
          </group>
        )

      case 'file_cabinet': {
        const drawers = Math.max(2, Math.round(h / 0.35))
        const dh = h / drawers
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color="#7a7a7a" roughness={0.5} metalness={0.4} />
            </mesh>
            {Array.from({ length: drawers }).map((_, i) => (
              <group key={i}>
                <mesh position={[0, dh * (i + 1), d / 2 + 0.001]}>
                  <boxGeometry args={[w - 0.01, 0.004, 0.001]} />
                  <meshStandardMaterial color="#555" roughness={0.5} />
                </mesh>
                <mesh position={[0, dh * i + dh / 2, d / 2 + 0.008]}>
                  <boxGeometry args={[w * 0.25, 0.015, 0.015]} />
                  <meshStandardMaterial color="#aaa" roughness={0.3} metalness={0.5} />
                </mesh>
              </group>
            ))}
          </group>
        )
      }

      case 'whiteboard':
        return (
          <group>
            {/* Marco */}
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <boxGeometry args={[w, h, d]} />
              <meshStandardMaterial color="#c0c0c0" roughness={0.4} metalness={0.3} />
            </mesh>
            {/* Superficie blanca */}
            <mesh position={[0, h / 2, d / 2 + 0.001]}>
              <boxGeometry args={[w - 0.04, h - 0.04, 0.002]} />
              <meshStandardMaterial color="#f8f8f8" roughness={0.1} metalness={0.05} />
            </mesh>
            {/* Bandeja inferior */}
            <mesh castShadow position={[0, h * 0.08, d / 2 + 0.02]}>
              <boxGeometry args={[w * 0.8, 0.02, 0.04]} />
              <meshStandardMaterial color="#c0c0c0" roughness={0.4} metalness={0.3} />
            </mesh>
          </group>
        )

      case 'umbrella_stand':
        return (
          <group>
            <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
              <cylinderGeometry args={[w / 2, w * 0.38, h, 12]} />
              {mat}
            </mesh>
            <mesh position={[0, h / 2, 0]}>
              <cylinderGeometry args={[w / 2 - 0.01, w * 0.38 - 0.01, h - 0.02, 12, 1, true]} />
              <meshStandardMaterial color="#444" roughness={0.4} side={THREE.BackSide} />
            </mesh>
          </group>
        )

      default:
        return (
          <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
            <boxGeometry args={[w, h, d]} />
            {mat}
          </mesh>
        )
    }
  }

  const FLOOR_LEVEL = 0.005
  const baseY = FLOOR_LEVEL + (item.elevation ?? 0)

  return (
    <group
      position={[item.x, baseY, item.y]}
      rotation={[0, -(item.rotation * Math.PI) / 180, 0]}
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = 'auto' }}
    >
      {renderShape()}
      {isSelected && <SelectionGizmo item={item} />}
    </group>
  )
})

/* ─── Selection Gizmo (3D) ─── */
function SelectionGizmo({ item }: { item: FurnitureItem }) {
  const store = useStore()
  const { camera, raycaster, gl } = useThree()
  const ringRef = useRef<THREE.Mesh>(null)
  const planeRef = useRef<THREE.Mesh>(null)
  const isDragging = useRef<'move' | 'rotate' | null>(null)
  const dragStart = useRef(new THREE.Vector3())
  const startPos = useRef({ x: 0, y: 0 })
  const startRot = useRef(0)

  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])

  const getGroundPoint = useCallback((event: any) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)
    const target = new THREE.Vector3()
    raycaster.ray.intersectPlane(groundPlane, target)
    return target
  }, [camera, raycaster, gl, groundPlane])

  useEffect(() => {
    const domEl = gl.domElement

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return
      const point = getGroundPoint(e)
      if (!point) return

      if (isDragging.current === 'move') {
        const dx = point.x - dragStart.current.x
        const dz = point.z - dragStart.current.z
        const newX = Math.round((startPos.current.x + dx) * 4) / 4
        const newY = Math.round((startPos.current.y + dz) * 4) / 4
        store.updateFurniture(item.id, { x: newX, y: newY })
      } else if (isDragging.current === 'rotate') {
        const angle = Math.atan2(point.x - item.x, point.z - item.y)
        const startAngle = Math.atan2(
          dragStart.current.x - item.x,
          dragStart.current.z - item.y
        )
        let deltaDeg = ((angle - startAngle) * 180) / Math.PI
        let newRot = startRot.current - deltaDeg
        newRot = Math.round(newRot / 15) * 15
        newRot = ((newRot % 360) + 360) % 360
        store.updateFurniture(item.id, { rotation: newRot })
      }
    }

    const onPointerUp = () => {
      isDragging.current = null
      document.body.style.cursor = 'auto'
    }

    domEl.addEventListener('pointermove', onPointerMove)
    domEl.addEventListener('pointerup', onPointerUp)
    return () => {
      domEl.removeEventListener('pointermove', onPointerMove)
      domEl.removeEventListener('pointerup', onPointerUp)
    }
  }, [gl, getGroundPoint, item.id, item.x, item.y, store])

  const handleMoveStart = useCallback((e: any) => {
    e.stopPropagation()
    const point = getGroundPoint(e.nativeEvent || e)
    if (!point) return
    isDragging.current = 'move'
    dragStart.current.copy(point)
    startPos.current = { x: item.x, y: item.y }
    document.body.style.cursor = 'grabbing'
  }, [getGroundPoint, item.x, item.y])

  const handleRotateStart = useCallback((e: any) => {
    e.stopPropagation()
    const point = getGroundPoint(e.nativeEvent || e)
    if (!point) return
    isDragging.current = 'rotate'
    dragStart.current.copy(point)
    startRot.current = item.rotation
    document.body.style.cursor = 'grabbing'
  }, [getGroundPoint, item.rotation])

  const size = Math.max(item.width, item.depth)
  const ringRadius = size * 0.7 + 0.15

  return (
    <group rotation={[0, (item.rotation * Math.PI) / 180, 0]}>
      {/* Selection outline */}
      <mesh position={[0, item.height / 2, 0]}>
        <boxGeometry args={[item.width + 0.04, item.height + 0.04, item.depth + 0.04]} />
        <meshBasicMaterial color="#5B8DEF" wireframe transparent opacity={0.4} />
      </mesh>

      {/* Move handle (flat plane at feet level) */}
      <mesh
        ref={planeRef}
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handleMoveStart}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'grab' }}
        onPointerOut={() => { document.body.style.cursor = 'auto' }}
      >
        <planeGeometry args={[item.width * 0.6, item.depth * 0.6]} />
        <meshBasicMaterial color="#5B8DEF" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>

      {/* Move arrows (4 directions) */}
      {[[0, 0, item.depth / 2 + 0.15, 0], [0, 0, -item.depth / 2 - 0.15, Math.PI], [item.width / 2 + 0.15, 0, 0, -Math.PI / 2], [-item.width / 2 - 0.15, 0, 0, Math.PI / 2]].map(([ax, ay, az, ar], i) => (
        <mesh
          key={`arrow-${i}`}
          position={[ax as number, 0.05, az as number]}
          rotation={[-Math.PI / 2, 0, ar as number]}
          onPointerDown={handleMoveStart}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'grab' }}
          onPointerOut={() => { document.body.style.cursor = 'auto' }}
        >
          <coneGeometry args={[0.08, 0.16, 3]} />
          <meshBasicMaterial color="#5B8DEF" transparent opacity={0.7} />
        </mesh>
      ))}

      {/* Rotation ring */}
      <mesh
        ref={ringRef}
        position={[0, item.height + 0.15, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handleRotateStart}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'grab' }}
        onPointerOut={() => { document.body.style.cursor = 'auto' }}
      >
        <torusGeometry args={[ringRadius, 0.03, 8, 32]} />
        <meshBasicMaterial color="#FF9F43" transparent opacity={0.85} />
      </mesh>

      {/* Rotation handle ball */}
      <mesh
        position={[ringRadius, item.height + 0.15, 0]}
        onPointerDown={handleRotateStart}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'grab' }}
        onPointerOut={() => { document.body.style.cursor = 'auto' }}
      >
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshBasicMaterial color="#FF9F43" />
      </mesh>

      {/* Height label */}
      <mesh position={[0, item.height + 0.4, 0]}>
        <sphereGeometry args={[0.01, 4, 4]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  )
}

/* ─── Wall corner joints (fills gaps at wall junctions) ─── */
function WallJoints({ walls }: { walls: Wall[] }) {
  const sm = useStore((s) => s.sceneMaterials)
  const joints = useMemo(() => {
    const eps = 0.01
    const key = (x: number, y: number) =>
      `${Math.round(x / eps) * eps},${Math.round(y / eps) * eps}`
    const map = new Map<string, { x: number; z: number; thickness: number; height: number; count: number }>()

    for (const w of walls) {
      for (const pt of [w.start, w.end]) {
        const k = key(pt.x, pt.y)
        const existing = map.get(k)
        if (existing) {
          existing.count++
          existing.thickness = Math.max(existing.thickness, w.thickness)
          existing.height = Math.max(existing.height, w.height)
        } else {
          map.set(k, { x: pt.x, z: pt.y, thickness: w.thickness, height: w.height, count: 1 })
        }
      }
    }

    const result: { x: number; z: number; t: number; h: number }[] = []
    map.forEach((j) => {
      if (j.count >= 2) {
        result.push({ x: j.x, z: j.z, t: j.thickness, h: j.height })
      }
    })
    return result
  }, [walls])

  const wallColor = sm.walls.color
  const roughness = sm.walls.roughness
  const metalness = sm.walls.metalness
  // Juntas sin textura (solo color) para fusión continua; polygonOffset evita z-fighting
  const jointMat = (
    <meshStandardMaterial
      color={wallColor}
      roughness={roughness}
      metalness={metalness}
      polygonOffset
      polygonOffsetFactor={1}
      polygonOffsetUnits={2}
    />
  )

  return (
    <>
      {joints.map((j, i) => (
        <mesh key={`joint-${i}`} position={[j.x, j.h / 2, j.z]} castShadow receiveShadow>
          <boxGeometry args={[j.t * 1.02, j.h * 1.01, j.t * 1.02]} />
          {jointMat}
        </mesh>
      ))}
    </>
  )
}

/* ─── Room detection & floor rendering ─── */
function findClosedRooms(walls: Wall[]): { x: number; z: number }[][] {
  const eps = 0.02
  const key = (x: number, y: number) =>
    `${(Math.round(x / eps) * eps).toFixed(3)},${(Math.round(y / eps) * eps).toFixed(3)}`

  const adj = new Map<string, { x: number; z: number; neighbors: string[] }>()

  for (const w of walls) {
    const ks = key(w.start.x, w.start.y)
    const ke = key(w.end.x, w.end.y)
    if (ks === ke) continue
    if (!adj.has(ks)) adj.set(ks, { x: w.start.x, z: w.start.y, neighbors: [] })
    if (!adj.has(ke)) adj.set(ke, { x: w.end.x, z: w.end.y, neighbors: [] })
    const sn = adj.get(ks)!
    const en = adj.get(ke)!
    if (!sn.neighbors.includes(ke)) sn.neighbors.push(ke)
    if (!en.neighbors.includes(ks)) en.neighbors.push(ks)
  }

  // Sort neighbors by angle for each node (for minimal cycle detection)
  for (const [k, node] of adj) {
    node.neighbors.sort((a, b) => {
      const na = adj.get(a)!
      const nb = adj.get(b)!
      return Math.atan2(na.z - node.z, na.x - node.x) - Math.atan2(nb.z - node.z, nb.x - node.x)
    })
  }

  const usedEdges = new Set<string>()
  const rooms: { x: number; z: number }[][] = []
  const edgeKey = (a: string, b: string) => `${a}>${b}`

  for (const [startK] of adj) {
    const startNode = adj.get(startK)!
    for (const firstNeighborK of startNode.neighbors) {
      const ek = edgeKey(startK, firstNeighborK)
      if (usedEdges.has(ek)) continue

      // Walk using "always turn left" (next edge in sorted neighbors after incoming)
      const chain: string[] = [startK]
      let prevK = startK
      let currK = firstNeighborK
      let valid = true

      for (let step = 0; step < 50; step++) {
        chain.push(currK)
        usedEdges.add(edgeKey(prevK, currK))

        if (currK === startK) break

        const curr = adj.get(currK)
        if (!curr || curr.neighbors.length < 2) { valid = false; break }

        const incomingAngle = Math.atan2(adj.get(prevK)!.z - curr.z, adj.get(prevK)!.x - curr.x)
        let bestK = ''
        let bestAngle = Infinity

        for (const nk of curr.neighbors) {
          if (nk === prevK && curr.neighbors.length > 1) continue
          const nn = adj.get(nk)!
          let a = Math.atan2(nn.z - curr.z, nn.x - curr.x) - incomingAngle
          if (a <= 0) a += Math.PI * 2
          if (a < bestAngle) {
            bestAngle = a
            bestK = nk
          }
        }

        if (!bestK) { valid = false; break }
        prevK = currK
        currK = bestK
      }

      if (!valid || chain.length < 4 || chain[chain.length - 1] !== startK) continue

      const poly = chain.slice(0, -1).map(k => adj.get(k)!)

      // Signed area to check winding
      let area = 0
      for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length
        area += poly[i].x * poly[j].z - poly[j].x * poly[i].z
      }

      // Only keep counter-clockwise (positive area = interior rooms, skip huge exterior)
      if (area <= 0.05) continue
      if (Math.abs(area / 2) > 200) continue

      rooms.push(poly.map(p => ({ x: p.x, z: p.z })))
    }
  }

  // Deduplicate rooms (same vertices in different order)
  const unique: { x: number; z: number }[][] = []
  const roomSigs = new Set<string>()
  for (const room of rooms) {
    const sorted = room.map(p => key(p.x, p.z)).sort().join('|')
    if (!roomSigs.has(sorted)) {
      roomSigs.add(sorted)
      unique.push(room)
    }
  }

  return unique
}

function RoomFloors({ walls }: { walls: Wall[] }) {
  const rooms = useMemo(() => findClosedRooms(walls), [walls])
  const sm = useStore((s) => s.sceneMaterials)
  const floorTex = useSlotTexture(sm.floor)
  const showRoomLabels = useStore((s) => s.editor.showRoomLabels)
  const wireframeMode = useStore((s) => s.editor.wireframeMode)
  const floor = useStore((s) => s.getActiveFloor())
  const roomNames = floor.rooms

  return (
    <>
      {rooms.map((room, idx) => {
        // ShapeGeometry crea en plano XY. rotateX(-90°) mapea (x,y,0)→(x,0,-y).
        // Para que Z coincida con las paredes, usamos -room.z en el Shape.
        const shape = new THREE.Shape()
        shape.moveTo(room[0].x, -room[0].z)
        for (let i = 1; i < room.length; i++) {
          shape.lineTo(room[i].x, -room[i].z)
        }
        shape.closePath()
        const geo = new THREE.ShapeGeometry(shape)
        geo.rotateX(-Math.PI / 2)
        geo.translate(0, 0.005, 0)

        let area = 0
        for (let i = 0; i < room.length; i++) {
          const j = (i + 1) % room.length
          area += room[i].x * room[j].z - room[j].x * room[i].z
        }
        area = Math.abs(area / 2)

        const cx = room.reduce((s, p) => s + p.x, 0) / room.length
        const cz = room.reduce((s, p) => s + p.z, 0) / room.length

        const roomName = roomNames[idx]?.name || (rooms.length > 1 ? `Zona ${idx + 1}` : '')
        return (
          <group key={`room-${idx}`}>
            <mesh geometry={geo} receiveShadow>
              <meshStandardMaterial
                color={sm.floor.color}
                map={floorTex || undefined}
                roughness={sm.floor.roughness}
                metalness={sm.floor.metalness}
                wireframe={wireframeMode}
              />
            </mesh>
            {showRoomLabels && (
              <Html
                position={[cx, 0.03, cz]}
                center
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                <div style={{
                  background: 'rgba(255,255,255,0.9)',
                  color: '#333',
                  padding: '4px 12px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                }}>
                  {roomName && <div style={{ fontSize: 10, opacity: 0.8 }}>{roomName}</div>}
                  {area.toFixed(1)} m²
                </div>
              </Html>
            )}
          </group>
        )
      })}
    </>
  )
}

/* ─── Skirting Boards (rodapiés) — continuo bajo ventanas; omitido en puertas ─── */
function SkirtingBoards({ walls, openings }: { walls: Wall[]; openings: WallOpening[] }) {
  const sm = useStore((s) => s.sceneMaterials)
  const baseTex = useSlotTexture(sm.baseboard)
  const skirtHeight = sm.baseboard.height
  const skirtDepth = 0.012

  const corners = useMemo(() => {
    const eps = 0.01
    const key = (x: number, y: number) => `${Math.round(x / eps) * eps},${Math.round(y / eps) * eps}`
    const map = new Map<string, { x: number; z: number; thickness: number; count: number }>()
    for (const w of walls) {
      for (const pt of [w.start, w.end]) {
        const k = key(pt.x, pt.y)
        const existing = map.get(k)
        if (existing) {
          existing.count++
          existing.thickness = Math.max(existing.thickness, w.thickness)
        } else {
          map.set(k, { x: pt.x, z: pt.y, thickness: w.thickness, count: 1 })
        }
      }
    }
    const result: { x: number; z: number; t: number }[] = []
    map.forEach((j) => { if (j.count >= 2) result.push({ x: j.x, z: j.z, t: j.thickness }) })
    return result
  }, [walls])

  const baseMat = <meshStandardMaterial color={sm.baseboard.color} map={baseTex || undefined} roughness={sm.baseboard.roughness} metalness={sm.baseboard.metalness} />
  // Esquinas sin textura (solo color) para fusión continua con rodapiés
  const cornerMat = (
    <meshStandardMaterial
      color={sm.baseboard.color}
      roughness={sm.baseboard.roughness}
      metalness={sm.baseboard.metalness}
      polygonOffset
      polygonOffsetFactor={1}
      polygonOffsetUnits={2}
    />
  )

  return (
    <>
      {walls.map((wall) => {
        const dx = wall.end.x - wall.start.x
        const dy = wall.end.y - wall.start.y
        const length = Math.sqrt(dx * dx + dy * dy)
        if (length === 0) return null
        const angle = Math.atan2(dy, dx)
        const cx = (wall.start.x + wall.end.x) / 2
        const cy = (wall.start.y + wall.end.y) / 2
        const t = wall.thickness

        // Filtrar solo puertas (elevation 0) para segmentar el rodapié
        const doorOpenings = openings.filter((o) => o.wallId === wall.id && o.type === 'door')
        const sortedDoors = [...doorOpenings].sort((a, b) => a.position - b.position)
        const segments: { start: number; end: number }[] = []
        let currentX = 0
        for (const op of sortedDoors) {
          const opCenter = op.position * length
          const opStart = Math.max(currentX, opCenter - op.width / 2)
          const opEnd = Math.min(length, opCenter + op.width / 2)
          if (opStart > currentX) segments.push({ start: currentX, end: opStart })
          currentX = Math.max(currentX, opEnd)
        }
        if (currentX < length) segments.push({ start: currentX, end: length })

        return (
          <group key={`skirt-${wall.id}`} position={[cx, 0, cy]} rotation={[0, -angle, 0]}>
            {segments.map((seg, i) => {
              const segLen = seg.end - seg.start
              if (segLen < 0.02) return null
              const localX = (seg.start + seg.end) / 2 - length / 2
              return (
                <group key={i}>
                  <mesh castShadow position={[localX, skirtHeight / 2, t / 2 + skirtDepth / 2]}>
                    <boxGeometry args={[segLen, skirtHeight, skirtDepth]} />
                    {baseMat}
                  </mesh>
                  <mesh castShadow position={[localX, skirtHeight / 2, -(t / 2 + skirtDepth / 2)]}>
                    <boxGeometry args={[segLen, skirtHeight, skirtDepth]} />
                    {baseMat}
                  </mesh>
                </group>
              )
            })}
          </group>
        )
      })}
      {corners.map((c, i) => (
        <mesh key={`skirt-corner-${i}`} position={[c.x, skirtHeight / 2, c.z]} castShadow scale={[1.02, 1.01, 1.02]}>
          <boxGeometry args={[c.t, skirtHeight, c.t]} />
          {cornerMat}
        </mesh>
      ))}
    </>
  )
}

/* ─── Floor plane (exterior ground — always green) ─── */
const EXTERIOR_GROUND_COLOR = '#2d5a27'
function FloorPlane({ onDeselect }: { onDeselect?: (e: any) => void }) {
  const wireframeMode = useStore((s) => s.editor.wireframeMode)
  return (
    <mesh
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      onClick={(e) => { e.stopPropagation(); onDeselect?.(e) }}
    >
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial color={EXTERIOR_GROUND_COLOR} roughness={0.9} metalness={0.02} wireframe={wireframeMode} />
    </mesh>
  )
}

/* ─── Ceiling: usa findClosedRooms como el suelo para consistencia ─── */
function CeilingMesh({ walls, height }: { walls: Wall[]; height: number }) {
  const sm = useStore((s) => s.sceneMaterials)
  const ceilingTex = useSlotTexture(sm.ceiling)
  const meshes = useMemo(() => {
    const rooms = findClosedRooms(walls)
    return rooms.map((room) => {
      const shape = new THREE.Shape()
      // Orden inverso para que la normal apunte hacia abajo (visible desde el interior)
      shape.moveTo(room[room.length - 1].x, -room[room.length - 1].z)
      for (let i = room.length - 2; i >= 0; i--) {
        shape.lineTo(room[i].x, -room[i].z)
      }
      shape.closePath()
      const geo = new THREE.ShapeGeometry(shape)
      geo.rotateX(-Math.PI / 2)
      geo.translate(0, height + 0.005, 0)
      return geo
    })
  }, [walls, height])

  if (meshes.length === 0) return null

  return (
    <>
      {meshes.map((geometry, idx) => (
        <mesh key={`ceiling-${idx}`} geometry={geometry} receiveShadow>
          <meshStandardMaterial
            color={sm.ceiling.color}
            map={ceilingTex || undefined}
            roughness={sm.ceiling.roughness}
            metalness={sm.ceiling.metalness}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  )
}

/* ─── First Person Controls (no pointer lock) ─── */
function FirstPersonController() {
  const { camera, gl } = useThree()
  const firstPersonCamera = useStore((s) => s.editor.firstPersonCamera)
  const setFirstPersonCamera = useStore((s) => s.setFirstPersonCamera)
  const cameraMode = useStore((s) => s.editor.cameraMode)
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const keys = useRef({ w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false })
  const mouseDragButton = useRef<number | null>(null)
  const prevMouse = useRef({ x: 0, y: 0 })

  React.useEffect(() => {
    if (cameraMode !== 'firstPerson') return
    const fp = firstPersonCamera ?? { x: 4, z: 4, yaw: -Math.PI / 4 }
    camera.position.set(fp.x, 1.6, fp.z)
    euler.current.set(0, fp.yaw, 0, 'YXZ')
    camera.quaternion.setFromEuler(euler.current)
  }, [cameraMode])

  React.useEffect(() => {
    const keyMap: Record<string, keyof typeof keys.current> = {
      w: 'w', a: 'a', s: 's', d: 'd',
      ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
      const mapped = keyMap[e.key] ?? (e.key.toLowerCase() in keys.current ? (e.key.toLowerCase() as keyof typeof keys.current) : null)
      if (mapped && mapped in keys.current) {
        (keys.current as any)[mapped] = true
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const mapped = keyMap[e.key] ?? (e.key.toLowerCase() in keys.current ? (e.key.toLowerCase() as keyof typeof keys.current) : null)
      if (mapped && mapped in keys.current) (keys.current as any)[mapped] = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  React.useEffect(() => {
    const dom = gl.domElement

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        mouseDragButton.current = e.button
        prevMouse.current = { x: e.clientX, y: e.clientY }
      }
    }
    const onMouseMove = (e: MouseEvent) => {
      if (mouseDragButton.current === null) return
      const dx = e.clientX - prevMouse.current.x
      const dy = e.clientY - prevMouse.current.y
      prevMouse.current = { x: e.clientX, y: e.clientY }
      if (mouseDragButton.current === 2) {
        fpLookInput.yaw -= dx * 0.003
        fpLookInput.pitch -= dy * 0.003
      } else {
        fpMoveInput.x += dx * 0.015
        fpMoveInput.y -= dy * 0.015
      }
    }
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === mouseDragButton.current) mouseDragButton.current = null
    }
    const onMouseLeave = () => { mouseDragButton.current = null }
    const onContext = (e: Event) => { e.preventDefault() }

    dom.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    dom.addEventListener('mouseleave', onMouseLeave)
    dom.addEventListener('contextmenu', onContext)
    return () => {
      dom.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      dom.removeEventListener('mouseleave', onMouseLeave)
      dom.removeEventListener('contextmenu', onContext)
    }
  }, [gl])

  useFrame((_, delta) => {
    let appliedLook = false
    // Aplicar mirada con botón derecho (ratón = mover cuello)
    if (fpLookInput.yaw !== 0 || fpLookInput.pitch !== 0) {
      euler.current.setFromQuaternion(camera.quaternion)
      euler.current.y += fpLookInput.yaw
      euler.current.x += fpLookInput.pitch
      euler.current.x = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, euler.current.x))
      camera.quaternion.setFromEuler(euler.current)
      setFirstPersonCamera(camera.position.x, camera.position.z, euler.current.y)
      fpLookInput.yaw = 0
      fpLookInput.pitch = 0
      appliedLook = true
    }

    // Movimiento con botón izquierdo (ratón = desplazarse, como joystick centro)
    if (fpMoveInput.x !== 0 || fpMoveInput.y !== 0) {
      euler.current.setFromQuaternion(camera.quaternion)
      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward)
      forward.y = 0
      forward.normalize()
      const right = new THREE.Vector3()
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
      camera.position.addScaledVector(forward, fpMoveInput.y)
      camera.position.addScaledVector(right, fpMoveInput.x)
      camera.position.y = 1.6
      setFirstPersonCamera(camera.position.x, camera.position.z, euler.current.y)
      fpMoveInput.x = 0
      fpMoveInput.y = 0
    }

    // Movimiento con teclado / joystick
    const k = keys.current
    const hasKey = k.w || k.s || k.a || k.d || k.arrowup || k.arrowdown || k.arrowleft || k.arrowright
    const hasJoy = joystickInput.x !== 0 || joystickInput.z !== 0

    if (hasKey || hasJoy) {
      const speed = 3.5
      const dir = new THREE.Vector3()
      if (hasJoy) {
        dir.x = joystickInput.x
        dir.z = joystickInput.z
      } else {
        if (k.w || k.arrowup) dir.z -= 1
        if (k.s || k.arrowdown) dir.z += 1
        if (k.a || k.arrowleft) dir.x -= 1
        if (k.d || k.arrowright) dir.x += 1
      }
      dir.normalize()
      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward)
      forward.y = 0
      forward.normalize()
      const right = new THREE.Vector3()
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
      camera.position.addScaledVector(forward, -dir.z * speed * delta)
      camera.position.addScaledVector(right, dir.x * speed * delta)
      camera.position.y = 1.6
      setFirstPersonCamera(camera.position.x, camera.position.z, euler.current.y)
    } else if (firstPersonCamera && !appliedLook) {
      camera.position.x = firstPersonCamera.x
      camera.position.z = firstPersonCamera.z
      camera.position.y = 1.6
      euler.current.y = firstPersonCamera.yaw
      camera.quaternion.setFromEuler(euler.current)
    }

    // Sincronizar cámara 3D → store cada frame para que el icono 2D muestre la posición real
    euler.current.setFromQuaternion(camera.quaternion)
    const fp = firstPersonCamera
    const eps = 0.001
    if (!fp || Math.abs(camera.position.x - fp.x) > eps || Math.abs(camera.position.z - fp.z) > eps || Math.abs(euler.current.y - fp.yaw) > eps) {
      setFirstPersonCamera(camera.position.x, camera.position.z, euler.current.y)
    }
  })

  return null
}

/* ─── Sincroniza target orbital → store (para spawn en Caminar donde miras) ─── */
function OrbitTargetSync() {
  const { controls } = useThree()
  const setOrbitTarget = useStore((s) => s.setOrbitTarget)
  const ctrl = controls as THREE.OrbitControls | null
  useFrame(() => {
    if (!ctrl) return
    const t = ctrl.target
    setOrbitTarget(t.x, t.z)
  })
  return null
}

/* ─── Sincroniza zoom orbital: slider → cámara, scroll → store ─── */
const _orbitDir = new THREE.Vector3()
function OrbitZoomSync() {
  const { camera, controls } = useThree()
  const orbitZoom = useStore((s) => s.editor.orbitZoom)
  const setOrbitZoom = useStore((s) => s.setOrbitZoom)
  const prevZoomRef = useRef(orbitZoom)
  const ctrl = controls as THREE.OrbitControls | null
  useFrame(() => {
    if (!ctrl) return
    _orbitDir.copy(camera.position).sub(ctrl.target)
    const currentDist = _orbitDir.length()
    if (prevZoomRef.current !== orbitZoom) {
      prevZoomRef.current = orbitZoom
      _orbitDir.normalize().multiplyScalar(orbitZoom)
      camera.position.copy(ctrl.target).add(_orbitDir)
      ctrl.update()
    } else if (Math.abs(currentDist - orbitZoom) > 0.05) {
      setOrbitZoom(currentDist)
      prevZoomRef.current = currentDist
    }
  })
  return null
}

/* ─── Zoom to selected (tecla Z) ─── */
function ZoomToSelected() {
  const { camera, controls } = useThree()
  const floor = useStore((s) => s.getActiveFloor())
  const editor = useStore((s) => s.editor)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'z' || e.ctrlKey || e.metaKey) return
      const inInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'
      if (inInput) return
      const ctrl = controls as THREE.OrbitControls | null
      if (!ctrl) return

      const { selectedItemId, selectedItemType, selectedFurnitureIds } = editor
      let tx = 0, ty = 1, tz = 0

      if (selectedItemType === 'furniture') {
        const ids = selectedFurnitureIds?.length ? selectedFurnitureIds : (selectedItemId ? [selectedItemId] : [])
        const items = ids.map((id) => floor.furniture.find((f) => f.id === id)).filter(Boolean) as FurnitureItem[]
        if (items.length > 0) {
          const cx = items.reduce((s, i) => s + i.x, 0) / items.length
          const cy = items.reduce((s, i) => s + i.y, 0) / items.length
          const avgH = items.reduce((s, i) => s + i.height, 0) / items.length
          tx = cx
          ty = avgH / 2
          tz = cy
        }
      } else if (selectedItemType === 'wall' && selectedItemId) {
        const wall = floor.walls.find((w) => w.id === selectedItemId)
        if (wall) {
          tx = (wall.start.x + wall.end.x) / 2
          ty = wall.height / 2
          tz = (wall.start.y + wall.end.y) / 2
        }
      } else if (selectedItemType === 'opening' && selectedItemId) {
        const op = floor.openings.find((o) => o.id === selectedItemId)
        if (op) {
          const wall = floor.walls.find((w) => w.id === op.wallId)
          if (wall) {
            const dx = wall.end.x - wall.start.x
            const dy = wall.end.y - wall.start.y
            const len = Math.sqrt(dx * dx + dy * dy)
            const angle = Math.atan2(dy, dx)
            const ox = (op.position - 0.5) * len
            tx = (wall.start.x + wall.end.x) / 2 + ox * Math.cos(angle)
            tz = (wall.start.y + wall.end.y) / 2 - ox * Math.sin(angle)
            ty = op.elevation + op.height / 2
          }
        }
      } else return

      ctrl.target.set(tx, ty, tz)
      const dist = 4
      const dir = new THREE.Vector3(0.5, 0.4, 0.5).normalize()
      camera.position.set(tx + dir.x * dist, ty + dir.y * dist, tz + dir.z * dist)
      ctrl.update()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [camera, controls, editor.selectedItemId, editor.selectedItemType, editor.selectedFurnitureIds, floor])
  return null
}

function getFloorBounds(walls: Wall[]) {
  let minX = 0, maxX = 8, minZ = 0, maxZ = 8
  if (walls.length > 0) {
    minX = Infinity; maxX = -Infinity; minZ = Infinity; maxZ = -Infinity
    for (const w of walls) {
      minX = Math.min(minX, w.start.x, w.end.x)
      maxX = Math.max(maxX, w.start.x, w.end.x)
      minZ = Math.min(minZ, w.start.y, w.end.y)
      maxZ = Math.max(maxZ, w.start.y, w.end.y)
    }
  }
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const size = Math.max(maxX - minX, maxZ - minZ, 4) * 0.8
  return { minX, maxX, minZ, maxZ, cx, cz, size }
}

/* ─── Aplica vista predefinida cuando se solicita ─── */
function CameraPresetApplier() {
  const { camera, controls } = useThree()
  const floor = useStore((s) => s.getActiveFloor())
  const preset = useStore((s) => s.editor.cameraPresetRequest)
  const setCameraPresetRequest = useStore((s) => s.setCameraPresetRequest)
  const setOrbitZoom = useStore((s) => s.setOrbitZoom)
  const bounds = useMemo(() => getFloorBounds(floor.walls), [floor.walls])

  useEffect(() => {
    if (!preset) return
    const ctrl = controls as THREE.OrbitControls | null
    if (!ctrl) return
    const { cx, cz, size } = bounds
    const target = new THREE.Vector3(cx, 1, cz)
    let pos: THREE.Vector3
    const dist = size * 1.2
    switch (preset) {
      case 'front': pos = new THREE.Vector3(cx, 1.5, cz + dist); break
      case 'side': pos = new THREE.Vector3(cx + dist, 1.5, cz); break
      case 'top': pos = new THREE.Vector3(cx, size + 3, cz); target.y = 0.5; break
      case 'isometric': pos = new THREE.Vector3(cx + dist * 0.7, dist * 0.5 + 1, cz + dist * 0.7); break
      default: return
    }
    ctrl.target.copy(target)
    camera.position.copy(pos)
    setOrbitZoom(camera.position.distanceTo(target))
    ctrl.update()
    setCameraPresetRequest(null)
  }, [preset, camera, controls, bounds, setCameraPresetRequest, setOrbitZoom])

  return null
}

/* ─── Guardar/restaurar posición de cámara ─── */
function CameraSaveRestore() {
  const { camera, controls } = useThree()
  const saveRequest = useStore((s) => s.editor.saveCameraRequest)
  const restoreIndex = useStore((s) => s.editor.restoreCameraIndex)
  const savedPositions = useStore((s) => s.savedCameraPositions)
  const clearSaveRequest = useStore((s) => s.clearSaveCameraRequest)
  const clearRestoreIndex = useStore((s) => s.clearRestoreCameraIndex)
  const setOrbitZoom = useStore((s) => s.setOrbitZoom)
  const prevSaveRef = useRef(0)
  const prevRestoreRef = useRef<number | null>(null)

  useFrame(() => {
    const ctrl = controls as THREE.OrbitControls | null
    if (!ctrl) return
    if (saveRequest && saveRequest !== prevSaveRef.current) {
      prevSaveRef.current = saveRequest
      const pos = camera.position.clone()
      const tgt = ctrl.target.clone()
      useStore.setState((s) => ({
        savedCameraPositions: [...s.savedCameraPositions, {
          position: [pos.x, pos.y, pos.z],
          target: [tgt.x, tgt.y, tgt.z],
          zoom: pos.distanceTo(tgt),
        }].slice(-5),
      }))
      clearSaveRequest()
    }
    if (restoreIndex !== null && restoreIndex !== prevRestoreRef.current && savedPositions[restoreIndex]) {
      prevRestoreRef.current = restoreIndex
      const cam = savedPositions[restoreIndex]
      camera.position.set(...cam.position)
      ctrl.target.set(...cam.target)
      setOrbitZoom(cam.zoom)
      ctrl.update()
      clearRestoreIndex()
    }
  })
  return null
}

/* ─── Modo recorrido: animación automática de cámara ─── */
const TOUR_DURATION = 30
function TourModeController() {
  const { camera, controls } = useThree()
  const tourMode = useStore((s) => s.editor.tourMode)
  const floor = useStore((s) => s.getActiveFloor())
  const bounds = useMemo(() => getFloorBounds(floor.walls), [floor.walls])
  const startTime = useRef<number | null>(null)

  useFrame((_, delta) => {
    if (!tourMode) { startTime.current = null; return }
    const ctrl = controls as THREE.OrbitControls | null
    if (!ctrl) return
    if (startTime.current === null) startTime.current = performance.now() / 1000
    const t = (performance.now() / 1000 - startTime.current) / TOUR_DURATION
    const angle = (t % 1) * Math.PI * 2
    const { cx, cz, size } = bounds
    const dist = size * 1.5
    const x = cx + Math.cos(angle) * dist
    const z = cz + Math.sin(angle) * dist
    camera.position.lerp(new THREE.Vector3(x, dist * 0.4 + 1, z), 0.05)
    ctrl.target.lerp(new THREE.Vector3(cx, 1, cz), 0.05)
    ctrl.update()
  })
  return null
}

/* ─── Cuadrícula de suelo opcional ─── */
function FloorGrid() {
  const showGrid = useStore((s) => s.editor.showFloorGrid)
  const floor = useStore((s) => s.getActiveFloor())
  const bounds = useMemo(() => getFloorBounds(floor.walls), [floor.walls])
  const lines = useMemo(() => {
    if (!showGrid) return []
    const { minX, maxX, minZ, maxZ } = bounds
    const step = 1
    const result: React.ReactNode[] = []
    for (let x = Math.floor(minX); x <= maxX + 1; x += step) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.01, minZ - 1),
        new THREE.Vector3(x, 0.01, maxZ + 1),
      ])
      result.push(
        <line key={`v${x}`} geometry={geo}>
          <lineBasicMaterial color="#888888" transparent opacity={0.4} />
        </line>
      )
    }
    for (let z = Math.floor(minZ); z <= maxZ + 1; z += step) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(minX - 1, 0.01, z),
        new THREE.Vector3(maxX + 1, 0.01, z),
      ])
      result.push(
        <line key={`h${z}`} geometry={geo}>
          <lineBasicMaterial color="#888888" transparent opacity={0.4} />
        </line>
      )
    }
    return result
  }, [showGrid, bounds])
  return showGrid && lines.length > 0 ? <group>{lines}</group> : null
}

/* ─── Tone mapping: exposición desde el store (cada frame) ─── */
function ToneMappingUpdater() {
  const { gl } = useThree()
  const exposure = useStore((s) => s.editor.exposure)
  useFrame(() => {
    gl.toneMappingExposure = exposure
  })
  return null
}

/* ─── Captura de foto/render en 16:9 ─── */
const CAPTURE_WIDTH = 1920
const CAPTURE_HEIGHT = 1080

function CapturePhoto() {
  const { gl, scene, camera } = useThree()
  const captureRequest = useStore((s) => s.editor.captureRequest)
  const captureMode = useStore((s) => s.editor.captureMode ?? 'download')
  const clearCaptureRequest = useStore((s) => s.clearCaptureRequest)
  const setLastCapturedImage = useStore((s) => s.setLastCapturedImage)
  const setRenderGenerationModalOpen = useStore((s) => s.setRenderGenerationModalOpen)
  const setIsCapturing = useStore((s) => s.setIsCapturing)
  const capturedRef = useRef(false)

  useFrame(() => {
    if (!captureRequest || capturedRef.current) return
    capturedRef.current = true
    setIsCapturing(true)

    requestAnimationFrame(() => {
      // Guardar tamaño original
      const origW = gl.domElement.width
      const origH = gl.domElement.height
      const origPixelRatio = gl.getPixelRatio()

      // Ajustar a 16:9 para la captura
      gl.setPixelRatio(1)
      gl.setSize(CAPTURE_WIDTH, CAPTURE_HEIGHT, false)

      // Ajustar cámara al nuevo aspecto
      if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        const cam = camera as THREE.PerspectiveCamera
        const origAspect = cam.aspect
        cam.aspect = CAPTURE_WIDTH / CAPTURE_HEIGHT
        cam.updateProjectionMatrix()

        // Renderizar un frame en 16:9
        gl.render(scene, camera)
        const dataUrl = gl.domElement.toDataURL('image/png')

        // Restaurar cámara
        cam.aspect = origAspect
        cam.updateProjectionMatrix()
      
        // Restaurar renderer
        gl.setPixelRatio(origPixelRatio)
        gl.setSize(origW / origPixelRatio, origH / origPixelRatio, false)

        if (captureMode === 'render') {
          setLastCapturedImage(dataUrl)
          setRenderGenerationModalOpen(true)
        } else {
          const a = document.createElement('a')
          a.href = dataUrl
          a.download = `floorcraft-render-${Date.now()}.png`
          a.style.display = 'none'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        }
      } else {
        // Fallback para cámaras no-perspectiva
        gl.render(scene, camera)
        const dataUrl = gl.domElement.toDataURL('image/png')
        gl.setPixelRatio(origPixelRatio)
        gl.setSize(origW / origPixelRatio, origH / origPixelRatio, false)

        if (captureMode === 'render') {
          setLastCapturedImage(dataUrl)
          setRenderGenerationModalOpen(true)
        } else {
          const a = document.createElement('a')
          a.href = dataUrl
          a.download = `floorcraft-render-${Date.now()}.png`
          a.style.display = 'none'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        }
      }

      clearCaptureRequest()
      setIsCapturing(false)
      capturedRef.current = false
    })
  })

  return null
}

/* ─── Camera FOV updater (sincroniza camera.fov con el store) ─── */
function CameraFovUpdater() {
  const { camera } = useThree()
  const cameraFov = useStore((s) => s.editor.cameraFov)
  useEffect(() => {
    camera.fov = cameraFov
    camera.updateProjectionMatrix()
  }, [camera, cameraFov])
  return null
}

/* ─── Scene ─── */
function Scene() {
  const floor = useStore((s) => s.getActiveFloor())
  const timeOfDay = useStore((s) => s.editor.timeOfDay)
  const showCeiling = useStore((s) => s.editor.showCeiling)
  const cameraMode = useStore((s) => s.editor.cameraMode)
  const sm = useStore((s) => s.sceneMaterials)
  const store = useStore()

  const handleSelectFurniture = useCallback((id: string) => {
    store.setSelected(id, 'furniture')
  }, [store])

  const handleDeselect = useCallback(() => {
    store.setSelected(null, null)
  }, [store])

  const sunPosition = useMemo(() => {
    const hour = timeOfDay
    const angle = ((hour - 6) / 12) * Math.PI
    return [Math.cos(angle) * 20, Math.sin(angle) * 20, 10] as [number, number, number]
  }, [timeOfDay])

  const sunIntensity = useMemo(() => {
    if (timeOfDay < 5 || timeOfDay > 21) return 0.05
    if (timeOfDay < 7 || timeOfDay > 19) return 0.3
    if (timeOfDay < 8 || timeOfDay > 18) return 0.7
    return 1.2
  }, [timeOfDay])

  const isNight = timeOfDay < 6 || timeOfDay > 20
  const ambientIntensity = isNight ? 0.15 : (showCeiling ? 0.5 : 0.3)
  const hemisphereIntensity = isNight ? 0.15 : (showCeiling ? 0.6 : 0.4)
  const bloomIntensity = useStore((s) => s.editor.bloomIntensity)

  const sunIntensityInterior = useMemo(() => {
    if (showCeiling) return 0
    return sunIntensity
  }, [showCeiling, sunIntensity])

  const windowLights = useMemo(() => {
    if (!showCeiling) return []
    const wins: { x: number; y: number; z: number; intensity: number }[] = []
    const winIntensity = isNight ? 0.1 : (timeOfDay >= 8 && timeOfDay <= 18 ? 0.8 : 0.4)
    floor.walls.forEach((wall) => {
      const dx = wall.end.x - wall.start.x
      const dy = wall.end.y - wall.start.y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < 0.01) return
      const angle = Math.atan2(dy, dx)
      const cx = (wall.start.x + wall.end.x) / 2
      const cy = (wall.start.y + wall.end.y) / 2
      floor.openings.filter((o) => o.wallId === wall.id && o.type === 'window').forEach((op) => {
        const ox = (op.position - 0.5) * len
        const wx = cx + ox * Math.cos(angle)
        const wz = cy - ox * Math.sin(angle)
        const wy = op.elevation + op.height / 2
        const nx = -Math.sin(angle)
        const nz = -Math.cos(angle)
        wins.push({
          x: wx + nx * 0.2,
          y: wy,
          z: wz + nz * 0.2,
          intensity: winIntensity,
        })
      })
    })
    return wins
  }, [showCeiling, floor.walls, floor.openings, isNight, timeOfDay])
  const focusDistance = useStore((s) => s.editor.focusDistance)
  const focusBlur = useStore((s) => s.editor.focusBlur)
  const showShadows = useStore((s) => s.editor.showShadows)
  const contrast = useStore((s) => s.editor.contrast)
  const saturation = useStore((s) => s.editor.saturation)

  return (
    <>
      <CameraFovUpdater />
      <Sky sunPosition={sunPosition} />
      <ambientLight intensity={ambientIntensity} color={isNight ? '#8090c0' : '#ffffff'} />
      <directionalLight
        position={sunPosition}
        intensity={sunIntensityInterior}
        castShadow={showShadows && !showCeiling}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-camera-far={60}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <hemisphereLight args={[isNight ? '#203060' : '#b1d8ff', isNight ? '#1a1a2e' : '#e8dcc8', hemisphereIntensity]} />
      {windowLights.map((wl, i) => (
        <pointLight key={i} position={[wl.x, wl.y, wl.z]} intensity={wl.intensity} distance={8} decay={2} color="#fffef5" />
      ))}

      <FloorPlane onDeselect={handleDeselect} />
      <FloorGrid />
      <RoomFloors walls={floor.walls} />
      <SkirtingBoards walls={floor.walls} openings={floor.openings} />

      {/* Ceiling — only covers the area enclosed by walls */}
      {showCeiling && floor.walls.length >= 3 && <CeilingMesh walls={floor.walls} height={floor.height} />}

      {/* Walls */}
      {floor.walls.map((wall) => (
        <WallMesh
          key={wall.id}
          wall={wall}
          openings={floor.openings.filter((o) => o.wallId === wall.id)}
        />
      ))}
      <WallJoints walls={floor.walls} />

      {/* Furniture */}
      {floor.furniture.map((item) => (
        <FurnitureMesh key={item.id} item={item} onSelect={handleSelectFurniture} ceilingHeight={floor.height} />
      ))}

      {/* Real-time shadows from directionalLight — no ContactShadows to avoid ghost artifacts */}

      {cameraMode === 'orbit' ? (
        <>
          <OrbitControls
            makeDefault
            maxPolarAngle={Math.PI / 2.05}
            minDistance={1}
            maxDistance={30}
            target={[0, 1, 0]}
          />
          <OrbitZoomSync />
          <OrbitTargetSync />
          <ZoomToSelected />
          <CameraPresetApplier />
          <CameraSaveRestore />
          <TourModeController />
        </>
      ) : (
        <FirstPersonController />
      )}

      <EffectComposer enableNormalPass>
        <SSAO
          radius={0.4}
          intensity={15}
          luminanceInfluence={0.6}
          worldDistanceThreshold={1.0}
          worldDistanceFalloff={0.0}
          worldProximityThreshold={0.5}
          worldProximityFalloff={0.3}
        />
        <Bloom luminanceThreshold={0.45} luminanceSmoothing={0.5} intensity={bloomIntensity} />
        {(contrast !== 0 || saturation !== 0) && (
          <>
            <BrightnessContrast contrast={contrast} brightness={0} />
            <HueSaturation saturation={saturation} hue={0} />
          </>
        )}
        {focusBlur > 0 && (
          <DepthOfField
            worldFocusDistance={focusDistance}
            worldFocusRange={2 / Math.max(0.1, focusBlur)}
            bokehScale={focusBlur}
            resolutionScale={0.5}
          />
        )}
      </EffectComposer>
      <ToneMappingUpdater />
      <CapturePhoto />
    </>
  )
}

/* ─── Virtual Joystick ─── */
function VirtualJoystick() {
  const padRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const center = useRef({ x: 0, y: 0 })
  const RADIUS = 50

  const updateInput = useCallback((clientX: number, clientY: number) => {
    if (!padRef.current) return
    const dx = clientX - center.current.x
    const dy = clientY - center.current.y
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), RADIUS)
    const angle = Math.atan2(dy, dx)
    const nx = (dist / RADIUS) * Math.cos(angle)
    const ny = (dist / RADIUS) * Math.sin(angle)

    joystickInput.x = nx
    joystickInput.z = ny

    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${nx * RADIUS}px, ${ny * RADIUS}px)`
    }
  }, [])

  const resetInput = useCallback(() => {
    joystickInput.x = 0
    joystickInput.z = 0
    dragging.current = false
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(0px, 0px)'
    }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragging.current = true
    const rect = padRef.current!.getBoundingClientRect()
    center.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    updateInput(e.clientX, e.clientY)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [updateInput])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    e.preventDefault()
    updateInput(e.clientX, e.clientY)
  }, [updateInput])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    resetInput()
  }, [resetInput])

  useEffect(() => {
    return () => { resetInput() }
  }, [resetInput])

  const base: React.CSSProperties = {
    position: 'absolute',
    bottom: 28,
    left: '50%',
    transform: 'translateX(-50%)',
    width: RADIUS * 2 + 32,
    height: RADIUS * 2 + 32,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(30,34,46,0.55) 0%, rgba(30,34,46,0.25) 70%, transparent 100%)',
    border: '2px solid rgba(255,255,255,0.12)',
    backdropFilter: 'blur(6px)',
    touchAction: 'none',
    userSelect: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    cursor: 'grab',
  }

  const knob: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 35%, rgba(120,160,255,0.85), rgba(70,100,220,0.7))',
    boxShadow: '0 2px 12px rgba(80,120,255,0.35), inset 0 1px 2px rgba(255,255,255,0.3)',
    border: '2px solid rgba(255,255,255,0.25)',
    transition: dragging.current ? 'none' : 'transform 0.15s ease-out',
    pointerEvents: 'none',
  }

  const arrowCommon: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0.35,
    pointerEvents: 'none',
  }

  const S = 7
  const OFF = 14

  return (
    <div
      ref={padRef}
      style={base}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Arrows */}
      <div style={{ ...arrowCommon, top: OFF, left: '50%', marginLeft: -S,
        borderLeft: `${S}px solid transparent`, borderRight: `${S}px solid transparent`, borderBottom: `${S + 2}px solid rgba(255,255,255,0.7)` }} />
      <div style={{ ...arrowCommon, bottom: OFF, left: '50%', marginLeft: -S,
        borderLeft: `${S}px solid transparent`, borderRight: `${S}px solid transparent`, borderTop: `${S + 2}px solid rgba(255,255,255,0.7)` }} />
      <div style={{ ...arrowCommon, left: OFF, top: '50%', marginTop: -S,
        borderTop: `${S}px solid transparent`, borderBottom: `${S}px solid transparent`, borderRight: `${S + 2}px solid rgba(255,255,255,0.7)` }} />
      <div style={{ ...arrowCommon, right: OFF, top: '50%', marginTop: -S,
        borderTop: `${S}px solid transparent`, borderBottom: `${S}px solid transparent`, borderLeft: `${S + 2}px solid rgba(255,255,255,0.7)` }} />
      {/* Knob */}
      <div ref={knobRef} style={knob} />
    </div>
  )
}

/* ─── Pad de mirada (movimiento de cuello) — arrastrar para mirar izq/der y arriba/abajo ─── */
function VirtualLookPad() {
  const padRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragging = useRef(false)
  const prev = useRef({ x: 0, y: 0 })

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragging.current = true
    setIsDragging(true)
    prev.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    e.preventDefault()
    const dx = e.clientX - prev.current.x
    const dy = e.clientY - prev.current.y
    prev.current = { x: e.clientX, y: e.clientY }
    fpLookInput.yaw -= dx * lookPadSensitivity
    fpLookInput.pitch -= dy * lookPadSensitivity
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = false
    setIsDragging(false)
  }, [])

  return (
    <div
      ref={padRef}
      style={{
        position: 'absolute',
        bottom: 28,
        left: 20,
        width: 100,
        height: 100,
        borderRadius: 12,
        background: 'radial-gradient(circle, rgba(30,34,46,0.5) 0%, rgba(30,34,46,0.2) 70%, transparent 100%)',
        border: '2px solid rgba(255,255,255,0.15)',
        backdropFilter: 'blur(6px)',
        touchAction: 'none',
        userSelect: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={e => e.preventDefault()}
      title="Arrastrar para mirar (izq/der, arriba/abajo)"
    >
      <span style={{ fontSize: 24, opacity: 0.5 }}>👁</span>
    </div>
  )
}

/* ─── Menú flotante Vista 3D (abajo derecha) ─── */
function Viewer3DFloatingMenu() {
  const store = useStore()
  const theme = useStore((s) => s.theme)
  const editor = useStore((s) => s.editor)
  const [collapsed, setCollapsed] = useState(false)
  const c = THEMES[theme]

  const card: React.CSSProperties = {
    background: theme === 'dark' ? '#181a22ee' : '#ffffffee',
    border: theme === 'dark' ? '1px solid #2a2d42' : '1px solid #d0d4de',
    borderRadius: 10,
    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
  }
  const btn: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 6, border: `1px solid ${c.border}`,
    background: c.bgCard, color: c.textSecondary, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
  }
  const btnActive: React.CSSProperties = { ...btn, background: c.accentBg, borderColor: c.accent, color: c.accent }
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }
  const label: React.CSSProperties = { fontSize: 12, color: c.textMuted, minWidth: 72 }
  const val: React.CSSProperties = { fontSize: 11, color: c.textMuted, fontFamily: '"JetBrains Mono", monospace' }

  if (collapsed) {
    return (
      <div style={{
        position: 'absolute', bottom: 16, right: 16,
        ...card, padding: '8px 12px', cursor: 'pointer',
      }} onClick={() => setCollapsed(false)} title="Abrir controles Vista 3D">
        <span style={{ fontSize: 14 }}>📷</span>
        <span style={{ marginLeft: 6, fontSize: 12, color: c.text }}>Vista 3D</span>
      </div>
    )
  }

  return (
    <div style={{
      position: 'absolute', bottom: 16, right: 16,
      ...card, padding: '14px 16px', width: 300, minWidth: 300, maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>📷 Vista 3D</span>
        <button onClick={() => setCollapsed(true)} style={{ ...btn, padding: '4px 8px', fontSize: 14 }} title="Colapsar">−</button>
      </div>

      {/* Modo cámara */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ ...label, marginBottom: 6 }}>Modo</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => store.setCameraMode('orbit')} style={editor.cameraMode === 'orbit' ? btnActive : btn}>🖱️ Orbital</button>
          <button onClick={() => store.setCameraMode('firstPerson')} style={editor.cameraMode === 'firstPerson' ? btnActive : btn}>🚶 Caminar</button>
        </div>
      </div>

      {/* Vistas predefinidas */}
      {editor.cameraMode === 'orbit' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ ...label, marginBottom: 6 }}>Vistas</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {(['front', 'side', 'top', 'isometric'] as const).map((p) => (
              <button key={p} onClick={() => store.setCameraPresetRequest(p)} style={btn} title={p === 'front' ? 'Frontal' : p === 'side' ? 'Lateral' : p === 'top' ? 'Cenital' : 'Isométrica'}>
                {p === 'front' ? '⬆️' : p === 'side' ? '➡️' : p === 'top' ? '🔝' : '📐'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Presets iluminación */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ ...label, marginBottom: 6 }}>Iluminación</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {[
            { h: 6, l: '🌅', t: 'Amanecer' },
            { h: 10, l: '☀️', t: 'Mañana' },
            { h: 13, l: '🌞', t: 'Mediodía' },
            { h: 17, l: '🌆', t: 'Tarde' },
            { h: 20, l: '🌙', t: 'Atardecer' },
            { h: 23, l: '🌃', t: 'Noche' },
          ].map(({ h, l, t }) => (
            <button key={h} onClick={() => store.setTimeOfDay(h)} style={editor.timeOfDay === h ? btnActive : btn} title={t}>{l}</button>
          ))}
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: c.textSecondary, cursor: 'pointer' }}>
        <input type="checkbox" checked={editor.showCeiling} onChange={(e) => store.setShowCeiling(e.target.checked)} style={{ accentColor: c.accent }} />
        Mostrar techo
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: c.textSecondary, cursor: 'pointer' }}>
        <input type="checkbox" checked={editor.showShadows} onChange={(e) => store.setShowShadows(e.target.checked)} style={{ accentColor: c.accent }} />
        Sombras
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: c.textSecondary, cursor: 'pointer' }}>
        <input type="checkbox" checked={editor.showFloorGrid} onChange={(e) => store.setShowFloorGrid(e.target.checked)} style={{ accentColor: c.accent }} />
        Cuadrícula suelo
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: c.textSecondary, cursor: 'pointer' }}>
        <input type="checkbox" checked={editor.wireframeMode} onChange={(e) => store.setWireframeMode(e.target.checked)} style={{ accentColor: c.accent }} />
        Wireframe
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: c.textSecondary, cursor: 'pointer' }}>
        <input type="checkbox" checked={editor.showRoomLabels} onChange={(e) => store.setShowRoomLabels(e.target.checked)} style={{ accentColor: c.accent }} />
        Etiquetas habitaciones
      </label>
      {editor.cameraMode === 'orbit' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: c.textSecondary, cursor: 'pointer' }}>
          <input type="checkbox" checked={editor.tourMode} onChange={(e) => store.setTourMode(e.target.checked)} style={{ accentColor: c.accent }} />
          Modo recorrido
        </label>
      )}

      <div style={{ ...label, marginBottom: 6, marginTop: 8 }}>📐 Cámara (tipo V-Ray)</div>
      <div style={row}>
        <span style={label}>Ángulo</span>
        <input type="range" min={30} max={120} step={5} value={editor.cameraFov ?? 55} onChange={(e) => store.setCameraFov(Number(e.target.value))} style={{ flex: 1, accentColor: c.accent }} />
        <span style={val}>{(editor.cameraFov ?? 55)}°</span>
      </div>
      {editor.cameraMode === 'orbit' && (
        <div style={row}>
          <span style={label}>Zoom</span>
          <input type="range" min={2} max={20} step={0.5} value={editor.orbitZoom ?? 8} onChange={(e) => store.setOrbitZoom(Number(e.target.value))} style={{ flex: 1, accentColor: c.accent }} />
          <span style={val}>{(editor.orbitZoom ?? 8).toFixed(1)}</span>
        </div>
      )}
      <div style={row}>
        <span style={label}>Obturación</span>
        <input type="range" min={0.3} max={2.5} step={0.1} value={editor.exposure} onChange={(e) => store.setExposure(Number(e.target.value))} style={{ flex: 1, accentColor: c.accent }} />
        <span style={val}>{(editor.exposure ?? 1.1).toFixed(1)}</span>
      </div>
      <div style={row}>
        <span style={label}>Enfoque (m)</span>
        <input type="range" min={1} max={15} step={0.5} value={editor.focusDistance ?? 5} onChange={(e) => store.setFocusDistance(Number(e.target.value))} style={{ flex: 1, accentColor: c.accent }} />
        <span style={val}>{(editor.focusDistance ?? 5).toFixed(1)}</span>
      </div>
      <div style={row}>
        <span style={label}>Desenfoque</span>
        <input type="range" min={0} max={2} step={0.1} value={editor.focusBlur ?? 0} onChange={(e) => store.setFocusBlur(Number(e.target.value))} style={{ flex: 1, accentColor: c.accent }} />
        <span style={val}>{(editor.focusBlur ?? 0).toFixed(1)}</span>
      </div>

      <div style={{ borderTop: `1px solid ${c.border}`, margin: '12px 0', paddingTop: 12 }}>
        <div style={{ ...label, marginBottom: 6 }}>☀️ Hora</div>
        <input type="range" min={0} max={24} step={1} value={editor.timeOfDay} onChange={(e) => store.setTimeOfDay(Number(e.target.value))} style={{ width: '100%', accentColor: c.accent }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: c.textMuted, marginTop: 2 }}><span>🌙</span><span>☀️</span><span>🌙</span></div>
      </div>

      <div style={row}>
        <span style={label}>Bloom</span>
        <input type="range" min={0} max={2} step={0.05} value={editor.bloomIntensity} onChange={(e) => store.setBloomIntensity(Number(e.target.value))} style={{ flex: 1, accentColor: c.accent }} />
        <span style={val}>{(editor.bloomIntensity ?? 0.15).toFixed(2)}</span>
      </div>
      <div style={row}>
        <span style={label}>Contraste</span>
        <input type="range" min={-0.5} max={0.5} step={0.05} value={editor.contrast} onChange={(e) => store.setContrast(Number(e.target.value))} style={{ flex: 1, accentColor: c.accent }} />
        <span style={val}>{(editor.contrast ?? 0).toFixed(2)}</span>
      </div>
      <div style={row}>
        <span style={label}>Saturación</span>
        <input type="range" min={-0.5} max={0.5} step={0.05} value={editor.saturation} onChange={(e) => store.setSaturation(Number(e.target.value))} style={{ flex: 1, accentColor: c.accent }} />
        <span style={val}>{(editor.saturation ?? 0).toFixed(2)}</span>
      </div>

      {/* Guardar/restaurar cámara */}
      {editor.cameraMode === 'orbit' && (
        <div style={{ marginTop: 12, marginBottom: 8 }}>
          <div style={{ ...label, marginBottom: 6 }}>Cámara</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => store.saveCameraPosition()} style={btn}>💾 Guardar</button>
            {store.savedCameraPositions.map((_, i) => (
              <button key={i} onClick={() => store.restoreCameraPosition(i)} style={btn}>📍 {i + 1}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={label}>Resolución</span>
        {([1, 2, 4] as const).map((r) => (
          <button key={r} onClick={() => store.setRenderResolution(r)} style={editor.renderResolution === r ? btnActive : btn}>{r}×</button>
        ))}
      </div>

      <button onClick={() => store.requestCapture()} style={{
        width: '100%', marginTop: 12, padding: '10px', border: `1px solid ${c.accent}`,
        borderRadius: 8, background: c.accentBg, color: c.accent, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
      }}>
        📷 Capturar foto / Render
      </button>
      <button onClick={() => store.requestRenderGeneration()} style={{
        width: '100%', marginTop: 8, padding: '10px', border: `1px solid ${c.accent}88`,
        borderRadius: 8, background: c.accentBg, color: c.accent, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
      }}>
        🎨 Generar render con IA (DALL·E / SORA)
      </button>
    </div>
  )
}

export default function Viewer3D() {
  const cameraMode = useStore((s) => s.editor.cameraMode)
  const theme = useStore((s) => s.theme)
  const isCapturing = useStore((s) => s.editor.isCapturing)

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {isCapturing && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(30,34,46,0.95)', padding: '20px 32px', borderRadius: 12,
            fontSize: 16, fontWeight: 600, color: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            📷 Capturando...
          </div>
        </div>
      )}
      <Canvas
        shadows
        camera={{
          position: [8, 6, 8],
          fov: 55,
          near: 0.1,
          far: 200,
        }}
        gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        style={{ cursor: cameraMode === 'firstPerson' ? 'crosshair' : 'auto' }}
      >
        <Scene />
      </Canvas>
      <div style={{
        position: 'absolute', top: 10, right: 10,
        background: theme === 'dark' ? '#181a22dd' : '#ffffffdd',
        padding: '8px 14px', borderRadius: 8,
        fontSize: 13,
        color: theme === 'dark' ? '#a0a8c0' : '#555',
        fontFamily: '"JetBrains Mono", monospace',
        pointerEvents: 'none',
        border: theme === 'dark' ? '1px solid #2a2d42' : '1px solid #d0d4de',
      }}>
        {cameraMode === 'orbit'
          ? '🖱️ Orbital — Arrastrar para rotar'
          : '🚶 Caminar — Clic izq + arrastrar: mover · Clic der + arrastrar: mirar · Joystick: mover · Pad: mirar'}
      </div>
      <Viewer3DFloatingMenu />
      {cameraMode === 'firstPerson' && (
        <>
          <VirtualJoystick />
          <VirtualLookPad />
        </>
      )}
    </div>
  )
}
