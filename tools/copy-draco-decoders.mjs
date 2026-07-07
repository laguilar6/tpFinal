import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const src = path.join(root, 'node_modules/three/examples/jsm/libs/draco/gltf/')
const dest = path.join(root, 'public/draco/')

if (!existsSync(src)) {
  console.error('❌ Three.js not installed. Run npm install first.')
  process.exit(1)
}

mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true, overwrite: true })
console.log('✅ Draco decoders copied to public/draco/')
