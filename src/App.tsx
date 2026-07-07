import { useEffect, useRef, useState, useCallback } from 'react'
import { DEFAULT_LIGHTING_SETTINGS, LightingSettings, Viewer3D } from './three/Viewer3D'

const LIGHTING_STORAGE_KEY = 'viewer-lighting-settings'

const loadLightingSettings = (): LightingSettings => {
  try {
    const raw = localStorage.getItem(LIGHTING_STORAGE_KEY)
    if (!raw) return DEFAULT_LIGHTING_SETTINGS
    return { ...DEFAULT_LIGHTING_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_LIGHTING_SETTINGS
  }
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightingOpen, setLightingOpen] = useState(false)
  const [lightingSaved, setLightingSaved] = useState(false)
  const [lighting, setLighting] = useState<LightingSettings>(() => loadLightingSettings())
  const viewerRef = useRef<Viewer3D | null>(null)

  const handleLoad = useCallback(() => {
    setLoading(false)
    document.getElementById('progress-bar')!.style.width = '100%'
    setTimeout(() => document.getElementById('overlay')?.classList.add('hidden'), 300)
  }, [])

  const handleError = useCallback((msg: string) => {
    setError(msg)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    viewerRef.current = new Viewer3D(containerRef.current, handleLoad, handleError, lighting)
    
    const buttons = [
      { id: 'btn-fwd', action: 'forward' as const },
      { id: 'btn-back', action: 'backward' as const },
      { id: 'btn-left', action: 'left' as const },
      { id: 'btn-right', action: 'right' as const }
    ]
    viewerRef.current.navigator.attachButtonListeners(buttons)

    return () => {
      viewerRef.current?.cleanup()
      viewerRef.current = null
    }
  }, [handleLoad, handleError])

  useEffect(() => {
    viewerRef.current?.applyLightingSettings(lighting)
    setLightingSaved(false)
  }, [lighting])

  const updateLighting = (key: keyof LightingSettings, value: number) => {
    setLighting((current) => ({ ...current, [key]: value }))
  }

  const saveLighting = () => {
    localStorage.setItem(LIGHTING_STORAGE_KEY, JSON.stringify(lighting))
    setLightingSaved(true)
  }

  const resetLighting = () => {
    localStorage.removeItem(LIGHTING_STORAGE_KEY)
    setLighting(DEFAULT_LIGHTING_SETTINGS)
    setLightingSaved(false)
  }

  const slider = (
    key: keyof LightingSettings,
    label: string,
    min: number,
    max: number,
    step: number
  ) => (
    <label className="lighting-field">
      <span>{label}<strong>{lighting[key].toFixed(2)}</strong></span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={lighting[key]}
        onChange={(e) => updateLighting(key, Number(e.target.value))}
      />
    </label>
  )

  return (
    <>
      <div id="canvas-container" ref={containerRef} />
      
      <div id="overlay" className={loading ? '' : 'hidden'}>
        <h2>Cargando modelo 3D...</h2>
        <div id="progress"><div id="progress-bar"></div></div>
      </div>

      {error && <div id="error-box">{error}</div>}

      <button
        id="lighting-toggle"
        className="ctrl-btn"
        onClick={() => setLightingOpen((open) => !open)}
        title="Luz"
        aria-label="Luz"
      >
        â˜¼
      </button>

      {lightingOpen && (
        <div id="lighting-panel">
          <div className="lighting-title">Luz</div>
          {slider('exposure', 'ExposiciÃ³n', 0.25, 1.5, 0.01)}
          {slider('ambient', 'Ambiente cÃ¡lido', 0, 1.5, 0.01)}
          {slider('hemisphere', 'Relleno', 0, 1, 0.01)}
          {slider('modelLights', 'Luces del modelo', 0, 1.5, 0.01)}
          {slider('materialBrightness', 'Materiales', 0.2, 1.25, 0.01)}
          {slider('emissive', 'EmisiÃ³n', 0, 1.25, 0.01)}
          <div className="lighting-actions">
            <button onClick={saveLighting}>{lightingSaved ? 'Guardado' : 'Guardar'}</button>
            <button onClick={resetLighting}>Reset</button>
          </div>
        </div>
      )}

      <div id="controls">
        <button id="btn-left" className="ctrl-btn" title="Izquierda">â†</button>
        <button id="btn-fwd" className="ctrl-btn" title="Avanzar">â†‘</button>
        <button id="btn-back" className="ctrl-btn" title="Retroceder">â†“</button>
        <button id="btn-right" className="ctrl-btn" title="Derecha">â†’</button>
        <button className="ctrl-btn" onClick={() => viewerRef.current?.navigator.reset()} title="Reset (R)">â†º</button>
      </div>

      <div id="instructions">
        ðŸ–±ï¸ Arrastrar: Mirar<br/>
        âŒ¨ï¸ Flechas/WASD: Moverse<br/>
        Shift: Correr<br/>
        R: Reset cÃ¡mara
      </div>
    </>
  )
}
