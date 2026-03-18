# Planning Guide

An interactive particle loading screen featuring floating stars that elegantly orbit and respond to cursor movements, creating a mesmerizing visual experience.

**Experience Qualities**: 
1. **Hypnotic** - Stars continuously flow in graceful patterns that naturally draw and hold attention
2. **Playful** - Particles react organically to mouse position, rewarding user interaction with fluid motion
3. **Ethereal** - Soft glowing effects and smooth animations create a dreamlike, weightless atmosphere

**Complexity Level**: Micro Tool (single-purpose application)
This is a focused visual effect demonstration - a canvas-based particle system with mouse interaction, no complex state management or multiple views needed.

## Essential Features

### Floating Star Particles
- **Functionality**: Hundreds of star particles float across the screen with independent motion trajectories
- **Purpose**: Creates the base visual atmosphere and sense of depth through parallax-like movement
- **Trigger**: Automatically starts on page load
- **Progression**: Initialize canvas → Generate particles with random positions/velocities → Update positions each frame → Render stars with glow effects → Loop continuously
- **Success criteria**: Smooth 60fps animation with 150-300 visible particles moving fluidly across the viewport

### Cursor Orbital Interaction
- **Functionality**: Particles within range of cursor position get pulled into gentle orbital motion around the mouse
- **Purpose**: Rewards user interaction and adds playful, responsive behavior to an otherwise passive animation
- **Trigger**: Mouse movement within the viewport
- **Progression**: Track mouse coordinates → Calculate distance from each particle to cursor → Apply gravitational/magnetic force to nearby particles → Blend orbital motion with natural drift → Particles gradually return to normal drift when cursor moves away
- **Success criteria**: Natural-feeling physics where particles smoothly transition between free-floating and cursor-orbiting states

### Particle Rendering & Effects
- **Functionality**: Stars rendered with varying sizes, opacity, and subtle glow/bloom effects
- **Purpose**: Creates visual depth and the characteristic "twinkling star" aesthetic
- **Trigger**: Every animation frame
- **Progression**: Clear canvas → Calculate particle brightness/size → Draw circular stars with radial gradients → Apply subtle blur/glow → Composite final frame
- **Success criteria**: Stars appear luminous with soft edges, varying in visual prominence to suggest depth

## Edge Case Handling

- **Mouse Leave Viewport**: Particles gracefully return to natural drift motion when cursor exits the window
- **Window Resize**: Canvas and particle boundaries adjust dynamically to new viewport dimensions without jarring resets
- **Performance Throttling**: Particle count or effects quality reduces automatically on lower-end devices to maintain smoothness
- **No Mouse Input**: On touch devices or when cursor is idle, particles continue their mesmerizing autonomous motion

## Design Direction

The design should evoke the wonder of gazing at a night sky while creating a sense of magical responsiveness. The experience should feel like controlling a personal constellation, where cosmic particles acknowledge and react to your presence. The aesthetic balances ethereal beauty with subtle playfulness—serious enough to feel premium, but engaging enough to encourage interaction.

## Color Selection

A deep cosmic palette with luminous accents, creating maximum contrast for glowing particles against the void.

- **Primary Color**: Deep Space Navy `oklch(0.12 0.03 250)` - An almost-black background with a subtle blue tint that suggests infinite depth
- **Secondary Colors**: 
  - Soft Twilight `oklch(0.25 0.05 260)` for subtle atmospheric gradients
  - Particle glow bases range from cool white to warm amber
- **Accent Color**: Bright Star White `oklch(0.98 0.01 90)` - Pure luminous white for the brightest star cores, creating focal points
- **Foreground/Background Pairings**: 
  - Primary (Deep Navy #0A0E1F): White text (#FAFAFA) - Ratio 16.8:1 ✓
  - Accent (Star White #FAFAFA): Navy background (#0A0E1F) - Ratio 16.8:1 ✓

## Font Selection

Clean, modern sans-serif typography that feels technical yet approachable—suggesting precision without coldness.

- **Typographic Hierarchy**: 
  - H1 (Main Title): Space Grotesk Bold/48px/tight tracking (-0.02em)
  - Body (Instructions): Inter Regular/16px/relaxed line-height (1.6)
  - Small (Info Text): Inter Medium/13px/normal tracking

## Animations

Animations are the heart of this experience—every movement must feel organic and physically plausible. Particle motion uses easing functions that mimic natural physics (momentum, gradual acceleration/deceleration). The cursor interaction should feel like magnetic attraction rather than rigid following. All effects are continuous and looping, with no abrupt starts or stops. Subtle randomness in particle behavior (slight wobble, varied speeds) prevents the animation from feeling mechanical. The overall effect should be meditative yet responsive, creating a sense of living, breathing motion.

## Component Selection

- **Components**: 
  - Full-screen `<canvas>` element for particle rendering (no shadcn components needed)
  - Optional minimal UI overlay using shadcn `Card` for loading text/progress
  - `Badge` component for subtle FPS counter or particle count (if showing metrics)
  
- **Customizations**: 
  - Custom particle system class to manage star lifecycle, physics, and rendering
  - Custom cursor tracking hook to smooth mouse position updates
  - Canvas rendering pipeline with custom gradient/glow effects
  
- **States**: 
  - Loading state: Particles fade in gradually on initialization
  - Active state: Full particle system with cursor interaction enabled
  - Idle state: When cursor hasn't moved for 5+ seconds, add gentle wave/pulse effects to particles
  
- **Icon Selection**: 
  - Sparkle/Star icons from Phosphor for any UI overlays
  - No icons needed for core particle canvas
  
- **Spacing**: 
  - Canvas fills entire viewport (w-screen h-screen)
  - Any overlay UI uses generous padding (p-8) and centered positioning
  - Breathing room maintained with min 24px margins on text elements
  
- **Mobile**: 
  - Canvas remains full-screen and responsive
  - Particle count reduces to 100-150 for performance
  - Touch events map to cursor position, creating orbital pull on tap-and-hold
  - Gyroscope integration could subtly influence particle drift direction (optional enhancement)


/////not sure if relevant
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cosmic Particles</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
    <link href="/src/main.css" rel="stylesheet" />
</head>

<body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
</body>

</html>
/////not sure if relevant///
widget difference prob:
import { useEffect, useRef, useState } from 'react'
import { ParticleSystem } from './lib/particle-system'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkle } from '@phosphor-icons/react'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const systemRef = useRef<ParticleSystem | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!canvasRef.current) return

    const particleCount = window.innerWidth < 768 ? 100 : 200
    const system = new ParticleSystem(canvasRef.current, particleCount)
    systemRef.current = system

    system.start()

    setTimeout(() => setIsLoading(false), 1000)

    const handleMouseMove = (e: MouseEvent) => {
      system.setMouse(e.clientX, e.clientY)
    }

    const handleMouseLeave = () => {
      system.clearMouse()
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        system.setMouse(e.touches[0].clientX, e.touches[0].clientY)
      }
    }

    const handleTouchEnd = () => {
      system.clearMouse()
    }

    const handleResize = () => {
      system.resize()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('touchmove', handleTouchMove)
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('resize', handleResize)

    return () => {
      system.destroy()
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <Card className={`bg-card/80 backdrop-blur-sm border-primary/20 p-8 transition-opacity duration-1000 ${isLoading ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex flex-col items-center gap-4">
            <Sparkle className="w-12 h-12 text-primary animate-spin" weight="duotone" />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              Cosmic Particles
            </h1>
            <p className="text-muted-foreground text-center max-w-md">
              Move your cursor to interact with the stars
            </p>
          </div>
        </Card>
      </div>

      <div className="absolute bottom-6 left-6 pointer-events-none">
        <Badge variant="outline" className="bg-card/60 backdrop-blur-sm border-primary/20">
          <Sparkle className="w-3 h-3 mr-1" weight="fill" />
          Interactive Star Field
        </Badge>
      </div>
    </div>
  )
}

export default App

very important:
@import 'tailwindcss';
@import "tw-animate-css";

@layer base {
  * {
    @apply border-border;
  }
}

:root {
  --background: oklch(0.12 0.03 250);
  --foreground: oklch(0.98 0.01 90);
  --card: oklch(0.18 0.04 250);
  --card-foreground: oklch(0.95 0.01 90);
  --popover: oklch(0.18 0.04 250);
  --popover-foreground: oklch(0.95 0.01 90);
  --primary: oklch(0.98 0.01 90);
  --primary-foreground: oklch(0.12 0.03 250);
  --secondary: oklch(0.25 0.05 260);
  --secondary-foreground: oklch(0.98 0.01 90);
  --muted: oklch(0.25 0.05 260);
  --muted-foreground: oklch(0.65 0.02 260);
  --accent: oklch(0.35 0.08 270);
  --accent-foreground: oklch(0.98 0.01 90);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.25 0.05 260);
  --input: oklch(0.25 0.05 260);
  --ring: oklch(0.65 0.08 270);
  --radius: 0.75rem;
}

@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  
  --radius-sm: calc(var(--radius) * 0.5);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) * 1.5);
  --radius-xl: calc(var(--radius) * 2);
  --radius-2xl: calc(var(--radius) * 3);
  --radius-full: 9999px;
}

body {
  font-family: 'Inter', sans-serif;
}

h1, h2, h3, h4, h5, h6 {
  font-family: 'Space Grotesk', sans-serif;
}

particle system for nice twirl around the porthole center while destroying satellites:
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  brightness: number
  hue: number
  baseVx: number
  baseVy: number
}

export class ParticleSystem {
  private particles: Particle[] = []
  private mouse = { x: 0, y: 0, active: false }
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private animationId: number | null = null

  constructor(canvas: HTMLCanvasElement, particleCount: number = 200) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.resize()
    this.initParticles(particleCount)
  }

  private initParticles(count: number) {
    this.particles = []
    for (let i = 0; i < count; i++) {
      const vx = (Math.random() - 0.5) * 0.5
      const vy = (Math.random() - 0.5) * 0.5
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx,
        vy,
        baseVx: vx,
        baseVy: vy,
        size: Math.random() * 2 + 0.5,
        brightness: Math.random() * 0.5 + 0.5,
        hue: Math.random() * 60 + 30,
      })
    }
  }

  resize() {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
  }

  setMouse(x: number, y: number) {
    this.mouse.x = x
    this.mouse.y = y
    this.mouse.active = true
  }

  clearMouse() {
    this.mouse.active = false
  }

  private updateParticle(p: Particle) {
    if (this.mouse.active) {
      const dx = this.mouse.x - p.x
      const dy = this.mouse.y - p.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const maxDistance = 200

      if (distance < maxDistance) {
        const force = (1 - distance / maxDistance) * 0.5
        const angle = Math.atan2(dy, dx)
        
        const orbitalAngle = angle + Math.PI / 2
        const orbitalForce = force * 2
        
        p.vx += Math.cos(orbitalAngle) * orbitalForce
        p.vy += Math.sin(orbitalAngle) * orbitalForce
        
        const pullForce = force * 0.3
        p.vx += Math.cos(angle) * pullForce
        p.vy += Math.sin(angle) * pullForce
      }
    }

    const returnForce = 0.02
    p.vx += (p.baseVx - p.vx) * returnForce
    p.vy += (p.baseVy - p.vy) * returnForce

    p.vx *= 0.99
    p.vy *= 0.99

    p.x += p.vx
    p.y += p.vy

    if (p.x < 0) p.x = this.canvas.width
    if (p.x > this.canvas.width) p.x = 0
    if (p.y < 0) p.y = this.canvas.height
    if (p.y > this.canvas.height) p.y = 0
  }

  private drawParticle(p: Particle) {
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
    const dynamicBrightness = Math.min(1, p.brightness + speed * 0.1)
    
    const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3)
    gradient.addColorStop(0, `oklch(${0.95 * dynamicBrightness} 0.05 ${p.hue} / ${dynamicBrightness})`)
    gradient.addColorStop(0.4, `oklch(${0.85 * dynamicBrightness} 0.03 ${p.hue} / ${dynamicBrightness * 0.5})`)
    gradient.addColorStop(1, `oklch(0.5 0.01 ${p.hue} / 0)`)

    this.ctx.fillStyle = gradient
    this.ctx.beginPath()
    this.ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
    this.ctx.fill()

    this.ctx.fillStyle = `oklch(0.98 0.01 ${p.hue} / ${dynamicBrightness})`
    this.ctx.beginPath()
    this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    this.ctx.fill()
  }

  private animate = () => {
    this.ctx.fillStyle = 'oklch(0.12 0.03 250 / 0.15)'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    for (const particle of this.particles) {
      this.updateParticle(particle)
      this.drawParticle(particle)
    }

    this.animationId = requestAnimationFrame(this.animate)
  }

  start() {
    if (!this.animationId) {
      this.animate()
    }
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  destroy() {
    this.stop()
  }
}
