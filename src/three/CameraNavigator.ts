import * as THREE from 'three'

export interface MovementState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  fast: boolean
}

export class CameraNavigator {
  private camera: THREE.PerspectiveCamera
  private initialHeight = 1.7
  private initialPosition = new THREE.Vector3(0, 1.7, 5)
  private yaw = 0
  private pitch = 0
  private initialYaw = 0
  private initialPitch = 0
  private speed = 5.0
  private fastMultiplier = 2.5
  private keys: Record<string, boolean> = {}
  private isPointerDown = false
  private activeLookPointerId: number | null = null
  private activeLookTarget: HTMLElement | null = null
  private lastPointer = { x: 0, y: 0 }
  private movement: MovementState = { forward: false, backward: false, left: false, right: false, fast: false }

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera
    this.setupEvents()
  }

  private setupEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') this.reset()
      this.keys[e.code] = true
      if (e.shiftKey) this.movement.fast = true
    })
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false
      if (!e.shiftKey) this.movement.fast = false
    })

    const onPointerDown = (e: PointerEvent) => {
      if (this.activeLookPointerId !== null) return
      if (e.target instanceof HTMLElement && e.target.closest('#controls, #lighting-panel, #lighting-toggle')) return
      e.preventDefault()
      this.isPointerDown = true
      this.activeLookPointerId = e.pointerId
      this.activeLookTarget = e.target instanceof HTMLElement ? e.target : null
      this.activeLookTarget?.setPointerCapture?.(e.pointerId)
      this.lastPointer = { x: e.clientX, y: e.clientY }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!this.isPointerDown || e.pointerId !== this.activeLookPointerId) return
      e.preventDefault()
      const dx = e.clientX - this.lastPointer.x
      const dy = e.clientY - this.lastPointer.y
      this.yaw -= dx * 0.002
      this.pitch -= dy * 0.002
      this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch))
      this.lastPointer = { x: e.clientX, y: e.clientY }
    }
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== this.activeLookPointerId) return
      this.activeLookTarget?.releasePointerCapture?.(e.pointerId)
      this.isPointerDown = false
      this.activeLookPointerId = null
      this.activeLookTarget = null
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }

  public attachButtonListeners(buttons: { id: string, action: keyof MovementState }[]) {
    buttons.forEach(({ id, action }) => {
      const el = document.getElementById(id)
      if (!el) return
      const set = (v: boolean) => { this.movement[action] = v }
      const stop = () => set(false)
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        el.setPointerCapture?.(e.pointerId)
        set(true)
      })
      el.addEventListener('pointerup', (e) => {
        e.preventDefault()
        el.releasePointerCapture?.(e.pointerId)
        stop()
      })
      el.addEventListener('pointercancel', stop)
      el.addEventListener('lostpointercapture', stop)
      el.addEventListener('contextmenu', (e) => e.preventDefault())
    })
  }

  public update(delta: number) {
    const forwardActive = this.movement.forward || this.keys['ArrowUp'] || this.keys['KeyW']
    const backwardActive = this.movement.backward || this.keys['ArrowDown'] || this.keys['KeyS']
    const leftActive = this.movement.left || this.keys['ArrowLeft'] || this.keys['KeyA']
    const rightActive = this.movement.right || this.keys['ArrowRight'] || this.keys['KeyD']

    const speed = this.speed * (this.movement.fast ? this.fastMultiplier : 1) * delta
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)
    forward.y = 0; forward.normalize()
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion)
    right.y = 0; right.normalize()

    if (forwardActive) this.camera.position.addScaledVector(forward, speed)
    if (backwardActive) this.camera.position.addScaledVector(forward, -speed)
    if (leftActive) this.camera.position.addScaledVector(right, -speed)
    if (rightActive) this.camera.position.addScaledVector(right, speed)

    this.camera.position.y = this.initialHeight

    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')
    this.camera.quaternion.setFromEuler(euler)
  }

  public reset() {
    this.yaw = this.initialYaw
    this.pitch = this.initialPitch
    this.camera.position.copy(this.initialPosition)
    this.keys = {}
    this.movement = { forward: false, backward: false, left: false, right: false, fast: false }
  }

  public setInitialHeight(h: number) { this.initialHeight = h }
  public setInitialPose(position: THREE.Vector3, yaw = 0, pitch = 0) {
    this.initialPosition.copy(position)
    this.initialHeight = position.y
    this.initialYaw = yaw
    this.initialPitch = pitch
    this.reset()
  }
  public checkCollisions(_raycaster: THREE.Raycaster): boolean { return false }
}
