import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { CameraNavigator } from './CameraNavigator'

export interface LightingSettings {
  exposure: number
  ambient: number
  hemisphere: number
  modelLights: number
  materialBrightness: number
  emissive: number
}

export const DEFAULT_LIGHTING_SETTINGS: LightingSettings = {
  exposure: 0.85,
  ambient: 0.65,
  hemisphere: 0.25,
  modelLights: 0.75,
  materialBrightness: 0.9,
  emissive: 0.35
}

const HUMAN_EYE_HEIGHT = 1.7
const ROOM_SCALE = 1
const RESET_BACK_DISTANCE = 5

interface MaterialBaseline {
  color?: THREE.Color
  emissive?: THREE.Color
  emissiveIntensity?: number
}

export class Viewer3D {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  public readonly navigator: CameraNavigator
  private container: HTMLElement
  private animationId: number | null = null
  private onLoad?: () => void
  private onError?: (msg: string) => void
  private ambientLight: THREE.AmbientLight
  private hemisphereLight: THREE.HemisphereLight
  private lightingSettings: LightingSettings
  private materialBaselines = new WeakMap<THREE.Material, MaterialBaseline>()
  private lightBaselines = new WeakMap<THREE.Light, number>()

  constructor(
    container: HTMLElement,
    onLoad?: () => void,
    onError?: (msg: string) => void,
    lightingSettings: LightingSettings = DEFAULT_LIGHTING_SETTINGS
  ) {
    this.container = container
    this.onLoad = onLoad
    this.onError = onError
    this.lightingSettings = lightingSettings

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0a0c)

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
    this.camera.position.set(0, HUMAN_EYE_HEIGHT, 0)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.container.appendChild(this.renderer.domElement)

    this.navigator = new CameraNavigator(this.camera)

    this.ambientLight = new THREE.AmbientLight(0xffe2bf, 1)
    this.scene.add(this.ambientLight)
    this.hemisphereLight = new THREE.HemisphereLight(0xfff1dc, 0x2a211b, 1)
    this.scene.add(this.hemisphereLight)
    this.applyLightingSettings(this.lightingSettings)

    window.addEventListener('resize', this.onResize)
    this.loadModel()
    this.animate()
  }

  private onResize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private loadModel() {
    const loader = new GLTFLoader()
    const draco = new DRACOLoader()
    draco.setDecoderPath('/draco/')
    loader.setDRACOLoader(draco)

    loader.load(
      '/models/model.optimized.glb',
      (gltf) => {
        const model = gltf.scene
        const box = new THREE.Box3().setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        const minY = box.min.y

        model.scale.multiplyScalar(ROOM_SCALE)
        model.position.set(
          -center.x * ROOM_SCALE,
          -minY * ROOM_SCALE,
          -center.z * ROOM_SCALE
        )

        this.scene.add(model)
        this.captureModelBaselines(model)
        this.applyLightingSettings(this.lightingSettings)

        this.camera.near = 0.03
        this.camera.far = 1000
        this.camera.updateProjectionMatrix()
        this.navigator.setInitialPose(new THREE.Vector3(0, HUMAN_EYE_HEIGHT, -RESET_BACK_DISTANCE), Math.PI)

        this.onLoad?.()
      },
      (xhr) => {
        if (xhr.total > 0) {
          const pct = (xhr.loaded / xhr.total) * 100
          document.getElementById('progress-bar')!.style.width = `${pct}%`
        }
      },
      (err) => {
        console.error(err)
        this.onError?.('Missing optimized GLB: /models/model.optimized.glb. Run npm run optimize:glb first.')
      }
    )
  }

  private captureModelBaselines(model: THREE.Object3D) {
    model.traverse((obj) => {
      if (obj instanceof THREE.Light && !this.lightBaselines.has(obj)) {
        this.lightBaselines.set(obj, obj.intensity)
      }

      if ('isMesh' in obj && (obj as any).isMesh) {
        const mesh = obj as THREE.Mesh
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        materials.forEach((material) => this.captureMaterialBaseline(material))
      }
    })
  }

  private captureMaterialBaseline(material?: THREE.Material | null) {
    if (!material || this.materialBaselines.has(material)) return

    const mat = material as THREE.Material & {
      color?: THREE.Color
      emissive?: THREE.Color
      emissiveIntensity?: number
    }

    this.materialBaselines.set(material, {
      color: mat.color?.clone(),
      emissive: mat.emissive?.clone(),
      emissiveIntensity: mat.emissiveIntensity
    })
  }

  public applyLightingSettings(settings: LightingSettings) {
    this.lightingSettings = settings
    this.renderer.toneMappingExposure = settings.exposure
    this.ambientLight.intensity = settings.ambient
    this.hemisphereLight.intensity = settings.hemisphere

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Light) {
        if (obj === this.ambientLight || obj === this.hemisphereLight) return
        const baseIntensity = this.lightBaselines.get(obj) ?? obj.intensity
        this.lightBaselines.set(obj, baseIntensity)
        obj.intensity = baseIntensity * settings.modelLights
        return
      }

      if ('isMesh' in obj && (obj as any).isMesh) {
        const mesh = obj as THREE.Mesh
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        materials.forEach((material) => this.applyMaterialLighting(material, settings))
      }
    })
  }

  private applyMaterialLighting(material: THREE.Material, settings: LightingSettings) {
    this.captureMaterialBaseline(material)
    const baseline = this.materialBaselines.get(material)
    const mat = material as THREE.Material & {
      color?: THREE.Color
      emissive?: THREE.Color
      emissiveIntensity?: number
    }

    if (baseline?.color && mat.color) {
      mat.color.copy(baseline.color).multiplyScalar(settings.materialBrightness)
    }

    if (baseline?.emissive && mat.emissive) {
      mat.emissive.copy(baseline.emissive)
      mat.emissiveIntensity = (baseline.emissiveIntensity ?? 1) * settings.emissive
    }

    material.needsUpdate = true
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate)
    const delta = 0.016
    this.navigator.update(delta)
    this.renderer.render(this.scene, this.camera)
  }

  public cleanup() {
    window.removeEventListener('resize', this.onResize)
    if (this.animationId) cancelAnimationFrame(this.animationId)
    this.renderer.dispose()
    this.container.removeChild(this.renderer.domElement)
    this.scene.traverse((obj) => {
      // Check for 'isMesh' property existence to satisfy TypeScript strictness
      if ('isMesh' in obj && (obj as any).isMesh) {
        const mesh = obj as THREE.Mesh
        mesh.geometry.dispose()
        if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose())
        else mesh.material?.dispose()
      }
    })
  }
}
