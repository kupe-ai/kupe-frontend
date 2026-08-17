"use client"

import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"

import { cn } from "@/lib/utils"

export type Frame = number[][]
type MatrixMode = "default" | "vu"

interface CellPosition {
  x: number
  y: number
}

interface MatrixProps extends React.HTMLAttributes<HTMLDivElement> {
  rows: number
  cols: number
  pattern?: Frame
  frames?: Frame[]
  fps?: number
  autoplay?: boolean
  loop?: boolean
  size?: number
  gap?: number
  palette?: {
    on: string
    off: string
  }
  brightness?: number
  ariaLabel?: string
  onFrame?: (index: number) => void
  mode?: MatrixMode
  levels?: number[]
  /** Shuffle dots on hover, then settle back to the original pattern (700ms). */
  scrambleOnHover?: boolean
  /** Keep off cells visible as a muted grid, including during scramble. */
  showOffDots?: boolean
  /** When set, scramble on this becoming true instead of the matrix's own hover. */
  hovered?: boolean
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function ensureFrameSize(frame: Frame, rows: number, cols: number): Frame {
  const result: Frame = []
  for (let r = 0; r < rows; r++) {
    const row = frame[r] || []
    result.push([])
    for (let c = 0; c < cols; c++) {
      result[r][c] = row[c] ?? 0
    }
  }
  return result
}

function useAnimation(
  frames: Frame[] | undefined,
  options: {
    fps: number
    autoplay: boolean
    loop: boolean
    onFrame?: (index: number) => void
  }
): { frameIndex: number; isPlaying: boolean } {
  const [frameIndex, setFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(options.autoplay)
  const frameIdRef = useRef<number | undefined>(undefined)
  const lastTimeRef = useRef<number>(0)
  const accumulatorRef = useRef<number>(0)

  useEffect(() => {
    if (!frames || frames.length === 0 || !isPlaying) {
      return
    }

    const frameInterval = 1000 / options.fps

    const animate = (currentTime: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime
      }

      const deltaTime = currentTime - lastTimeRef.current
      lastTimeRef.current = currentTime
      accumulatorRef.current += deltaTime

      if (accumulatorRef.current >= frameInterval) {
        accumulatorRef.current -= frameInterval

        setFrameIndex((prev) => {
          const next = prev + 1
          if (next >= frames.length) {
            if (options.loop) {
              options.onFrame?.(0)
              return 0
            } else {
              setIsPlaying(false)
              return prev
            }
          }
          options.onFrame?.(next)
          return next
        })
      }

      frameIdRef.current = requestAnimationFrame(animate)
    }

    frameIdRef.current = requestAnimationFrame(animate)

    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current)
      }
    }
  }, [frames, isPlaying, options.fps, options.loop, options.onFrame])

  useEffect(() => {
    setFrameIndex(0)
    setIsPlaying(options.autoplay)
    lastTimeRef.current = 0
    accumulatorRef.current = 0
  }, [frames, options.autoplay])

  return { frameIndex, isPlaying }
}

function emptyFrame(rows: number, cols: number): Frame {
  return Array.from({ length: rows }, () => Array(cols).fill(0))
}

function setPixel(frame: Frame, row: number, col: number, value: number): void {
  if (row >= 0 && row < frame.length && col >= 0 && col < frame[0].length) {
    frame[row][col] = value
  }
}

const SCRAMBLE_MS = 400
const SETTLE_MS = 300
const SCRAMBLE_SWAP_MS = 80

function shuffleFrame(source: Frame): Frame {
  const rows = source.length
  const cols = source[0]?.length ?? 0
  const cells: number[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(source[r]![c] ?? 0)
    }
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = cells[i]!
    cells[i] = cells[j]!
    cells[j] = tmp
  }
  const next = emptyFrame(rows, cols)
  let i = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      next[r]![c] = cells[i++]!
    }
  }
  return next
}

/** Stable identicon-style matrix from a seed. Not animated. Default 5×5. */
export function seededPattern(seed: string, rows = 5, cols = 5): Frame {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const rand = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822519)
    h = Math.imul(h ^ (h >>> 13), 3266489917)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }

  const frame = emptyFrame(rows, cols)
  let onCount = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = rand() > 0.48
      frame[r][c] = on ? 0.55 + rand() * 0.45 : 0
      if (on) onCount++
    }
  }
  const minOn = Math.max(5, Math.floor(rows * cols * 0.28))
  while (onCount < minOn) {
    const r = Math.floor(rand() * rows)
    const c = Math.floor(rand() * cols)
    if (frame[r]![c] === 0) {
      frame[r]![c] = 0.7 + rand() * 0.3
      onCount++
    }
  }
  return frame
}

export const digits: Frame[] = [
  [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  [
    [0, 0, 1, 0, 0],
    [0, 1, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
  ],
  [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 0, 0, 0],
    [1, 1, 1, 1, 1],
  ],
  [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
    [0, 0, 1, 1, 0],
    [0, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  [
    [0, 0, 0, 1, 0],
    [0, 0, 1, 1, 0],
    [0, 1, 0, 1, 0],
    [1, 0, 0, 1, 0],
    [1, 1, 1, 1, 1],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 1, 0],
  ],
  [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 0],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 1, 0, 0, 0],
  ],
  [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 1],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
]

export const chevronLeft: Frame = [
  [0, 0, 0, 1, 0],
  [0, 0, 1, 0, 0],
  [0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 0, 1, 0],
]

export const chevronRight: Frame = [
  [0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 0, 1, 0],
  [0, 0, 1, 0, 0],
  [0, 1, 0, 0, 0],
]

export const loader: Frame[] = (() => {
  const frames: Frame[] = []
  const size = 7
  const center = 3
  const radius = 2.5

  for (let frame = 0; frame < 12; frame++) {
    const f = emptyFrame(size, size)
    for (let i = 0; i < 8; i++) {
      const angle = (frame / 12) * Math.PI * 2 + (i / 8) * Math.PI * 2
      const x = Math.round(center + Math.cos(angle) * radius)
      const y = Math.round(center + Math.sin(angle) * radius)
      const brightness = 1 - i / 10
      setPixel(f, y, x, Math.max(0.2, brightness))
    }
    frames.push(f)
  }

  return frames
})()

export const pulse: Frame[] = (() => {
  const frames: Frame[] = []
  const size = 7
  const center = 3

  for (let frame = 0; frame < 16; frame++) {
    const f = emptyFrame(size, size)
    const phase = (frame / 16) * Math.PI * 2
    const intensity = (Math.sin(phase) + 1) / 2

    setPixel(f, center, center, 1)

    const radius = Math.floor((1 - intensity) * 3) + 1
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (Math.abs(dist - radius) < 0.7) {
          setPixel(f, center + dy, center + dx, intensity * 0.6)
        }
      }
    }

    frames.push(f)
  }

  return frames
})()

export function vu(columns: number, levels: number[]): Frame {
  const rows = 7
  const frame = emptyFrame(rows, columns)

  for (let col = 0; col < Math.min(columns, levels.length); col++) {
    const level = Math.max(0, Math.min(1, levels[col]))
    const height = Math.floor(level * rows)

    for (let row = 0; row < rows; row++) {
      const rowFromBottom = rows - 1 - row
      if (rowFromBottom < height) {
        let brightness = 1
        if (row < rows * 0.3) {
          brightness = 1
        } else if (row < rows * 0.6) {
          brightness = 0.8
        } else {
          brightness = 0.6
        }
        frame[row][col] = brightness
      }
    }
  }

  return frame
}

export const wave: Frame[] = (() => {
  const frames: Frame[] = []
  const rows = 7
  const cols = 7

  for (let frame = 0; frame < 24; frame++) {
    const f = emptyFrame(rows, cols)
    const phase = (frame / 24) * Math.PI * 2

    for (let col = 0; col < cols; col++) {
      const colPhase = (col / cols) * Math.PI * 2
      const height = Math.sin(phase + colPhase) * 2.5 + 3.5
      const row = Math.floor(height)

      if (row >= 0 && row < rows) {
        setPixel(f, row, col, 1)
        const frac = height - row
        if (row > 0) setPixel(f, row - 1, col, 1 - frac)
        if (row < rows - 1) setPixel(f, row + 1, col, frac)
      }
    }

    frames.push(f)
  }

  return frames
})()

export const snake: Frame[] = (() => {
  const frames: Frame[] = []
  const rows = 7
  const cols = 7
  const path: Array<[number, number]> = []

  let x = 0
  let y = 0
  let dx = 1
  let dy = 0

  const visited = new Set<string>()
  while (path.length < rows * cols) {
    path.push([y, x])
    visited.add(`${y},${x}`)

    const nextX = x + dx
    const nextY = y + dy

    if (
      nextX >= 0 &&
      nextX < cols &&
      nextY >= 0 &&
      nextY < rows &&
      !visited.has(`${nextY},${nextX}`)
    ) {
      x = nextX
      y = nextY
    } else {
      const newDx = -dy
      const newDy = dx
      dx = newDx
      dy = newDy

      const nextX = x + dx
      const nextY = y + dy

      if (
        nextX >= 0 &&
        nextX < cols &&
        nextY >= 0 &&
        nextY < rows &&
        !visited.has(`${nextY},${nextX}`)
      ) {
        x = nextX
        y = nextY
      } else {
        break
      }
    }
  }

  const snakeLength = 5
  for (let frame = 0; frame < path.length; frame++) {
    const f = emptyFrame(rows, cols)

    for (let i = 0; i < snakeLength; i++) {
      const idx = frame - i
      if (idx >= 0 && idx < path.length) {
        const [y, x] = path[idx]
        const brightness = 1 - i / snakeLength
        setPixel(f, y, x, brightness)
      }
    }

    frames.push(f)
  }

  return frames
})()

export const Matrix = React.forwardRef<HTMLDivElement, MatrixProps>(
  (
    {
      rows,
      cols,
      pattern,
      frames,
      fps = 12,
      autoplay = true,
      loop = true,
      size = 10,
      gap = 2,
      palette = {
        on: "currentColor",
        off: "var(--muted-foreground)",
      },
      brightness = 1,
      ariaLabel,
      onFrame,
      mode = "default",
      levels,
      scrambleOnHover = false,
      showOffDots = false,
      hovered,
      className,
      ...props
    },
    ref
  ) => {
    const { frameIndex } = useAnimation(frames, {
      fps,
      autoplay: autoplay && !pattern,
      loop,
      onFrame,
    })

    const [hoverFrame, setHoverFrame] = useState<Frame | null>(null)
    const scrambleRafRef = useRef<number | undefined>(undefined)
    const scrambleTokenRef = useRef(0)

    useEffect(() => {
      return () => {
        if (scrambleRafRef.current) {
          cancelAnimationFrame(scrambleRafRef.current)
        }
      }
    }, [])

    const currentFrame = useMemo(() => {
      if (mode === "vu" && levels && levels.length > 0) {
        return ensureFrameSize(vu(cols, levels), rows, cols)
      }

      if (hoverFrame) {
        return ensureFrameSize(hoverFrame, rows, cols)
      }

      if (pattern) {
        return ensureFrameSize(pattern, rows, cols)
      }

      if (frames && frames.length > 0) {
        return ensureFrameSize(frames[frameIndex] || frames[0], rows, cols)
      }

      return ensureFrameSize([], rows, cols)
    }, [hoverFrame, pattern, frames, frameIndex, rows, cols, mode, levels])

    const cellPositions = useMemo(() => {
      const positions: CellPosition[][] = []

      for (let row = 0; row < rows; row++) {
        positions[row] = []
        for (let col = 0; col < cols; col++) {
          positions[row][col] = {
            x: col * (size + gap),
            y: row * (size + gap),
          }
        }
      }

      return positions
    }, [rows, cols, size, gap])

    const svgDimensions = useMemo(() => {
      return {
        width: cols * (size + gap) - gap,
        height: rows * (size + gap) - gap,
      }
    }, [rows, cols, size, gap])

    const isAnimating = !pattern && frames && frames.length > 0

    const gradientId = React.useId().replace(/:/g, "")
    const onFillId = `matrix-on-${gradientId}`
    const offFillId = `matrix-off-${gradientId}`
    const glowId = `matrix-glow-${gradientId}`
    const scrambling = hoverFrame !== null

    const startScramble = () => {
      if (!scrambleOnHover || !pattern) return
      if (scrambleRafRef.current) {
        cancelAnimationFrame(scrambleRafRef.current)
      }
      const token = ++scrambleTokenRef.current
      const origin = ensureFrameSize(pattern, rows, cols)
      const start = performance.now()
      let lastSwap = -Infinity

      const tick = (now: number) => {
        if (token !== scrambleTokenRef.current) return
        const elapsed = now - start
        if (elapsed >= SCRAMBLE_MS) {
          setHoverFrame(null)
          scrambleRafRef.current = undefined
          return
        }
        if (now - lastSwap >= SCRAMBLE_SWAP_MS) {
          lastSwap = now
          setHoverFrame(shuffleFrame(origin))
        }
        scrambleRafRef.current = requestAnimationFrame(tick)
      }

      setHoverFrame(shuffleFrame(origin))
      scrambleRafRef.current = requestAnimationFrame(tick)
    }

    useEffect(() => {
      if (hovered) startScramble()
    }, [hovered])

    return (
      <div
        ref={ref}
        role="img"
        aria-label={ariaLabel ?? "matrix display"}
        aria-live={isAnimating ? "polite" : undefined}
        className={cn("relative inline-block", className)}
        data-scrambling={scrambling ? "" : undefined}
        style={
          {
            "--matrix-on": palette.on,
            "--matrix-off": palette.off,
            "--matrix-gap": `${gap}px`,
            "--matrix-size": `${size}px`,
          } as React.CSSProperties
        }
        {...props}
        onMouseEnter={(e) => {
          if (hovered === undefined) startScramble()
          props.onMouseEnter?.(e)
        }}
        onMouseLeave={props.onMouseLeave}
      >
        <svg
          width={svgDimensions.width}
          height={svgDimensions.height}
          viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
          xmlns="http://www.w3.org/2000/svg"
          className="block"
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient
              id={onFillId}
              gradientUnits="objectBoundingBox"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop offset="0%" stopColor="var(--primary-from)" />
              <stop offset="50%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--primary-to)" />
            </linearGradient>

            <radialGradient id={offFillId} cx="50%" cy="50%" r="50%">
              <stop
                offset="0%"
                stopColor="var(--muted-foreground)"
                stopOpacity="1"
              />
              <stop
                offset="100%"
                stopColor="var(--muted-foreground)"
                stopOpacity="0.7"
              />
            </radialGradient>

            <filter
              id={glowId}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <style>
            {`
              .matrix-pixel {
                transition: opacity ${SETTLE_MS}ms ease-out, transform 150ms ease-out;
                transform-origin: center;
                transform-box: fill-box;
              }
              [data-scrambling] .matrix-pixel {
                transition: opacity 70ms linear, transform 70ms linear;
              }
              .matrix-pixel-active {
                filter: url(#${glowId});
              }
            `}
          </style>

          {currentFrame.map((row, rowIndex) =>
            row.map((value, colIndex) => {
              const pos = cellPositions[rowIndex]?.[colIndex]
              if (!pos) return null

              const opacity = clamp(brightness * value)
              const isActive = opacity > 0.5
              const isOn = opacity > 0.05
              const offHidden =
                palette.off === "transparent" || palette.off === "none"
              if (!isOn && !showOffDots && offHidden && !scrambling) {
                return null
              }
              const fill =
                isOn || (scrambleOnHover && !showOffDots)
                  ? `url(#${onFillId})`
                  : `url(#${offFillId})`

              const scale = isActive ? 1.1 : 1
              const radius = (size / 2) * 0.9
              const offOpacity = showOffDots ? 0.22 : scrambleOnHover ? 0 : 0.1

              return (
                <circle
                  key={`${rowIndex}-${colIndex}`}
                  className={cn(
                    "matrix-pixel",
                    isActive && "matrix-pixel-active",
                    !isOn &&
                      !scrambleOnHover &&
                      !showOffDots &&
                      "opacity-20 dark:opacity-[0.1]"
                  )}
                  cx={pos.x + size / 2}
                  cy={pos.y + size / 2}
                  r={radius}
                  fill={fill}
                  opacity={isOn ? opacity : offOpacity}
                  style={{
                    transform: `scale(${scale})`,
                  }}
                />
              )
            })
          )}
        </svg>
      </div>
    )
  }
)

Matrix.displayName = "Matrix"
