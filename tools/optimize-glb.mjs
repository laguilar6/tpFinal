import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const args = process.argv.slice(2)
if (args.length < 1) {
  console.error('Usage: npm run optimize:glb -- <input.glb> [output.glb]')
  process.exit(1)
}

const input = path.resolve(args[0])
const output = args[1] ? path.resolve(args[1]) : path.join(process.cwd(), 'public/models/model.optimized.glb')

if (!existsSync(input)) {
  console.error(`Input file not found: ${input}`)
  process.exit(1)
}

const quote = (value) => `"${value.replace(/"/g, '\\"')}"`
const outDir = path.dirname(output)
const tempDir = path.join(os.tmpdir(), `glb-optimize-${Date.now()}`)
const webpOutput = path.join(tempDir, 'textures.webp.glb')

mkdirSync(outDir, { recursive: true })

const run = (command) => execSync(command, { stdio: 'inherit' })

console.log(`Optimizing ${path.basename(input)} with geometry-safe settings...`)
console.log('Using explicit WebP + Draco steps, without optimize/join/weld/simplify.')

try {
  mkdirSync(tempDir, { recursive: true })

  run(`npx gltf-transform webp ${quote(input)} ${quote(webpOutput)} --quality 85`)
  run(`npx gltf-transform draco ${quote(webpOutput)} ${quote(output)} --quantize-position 16 --quantize-normal 12 --quantize-texcoord 14 --quantize-generic 14`)

  const before = statSync(input).size / (1024 * 1024)
  const after = statSync(output).size / (1024 * 1024)
  const reduction = ((before - after) / before * 100).toFixed(1)

  console.log(`Done! Size: ${before.toFixed(2)}MB -> ${after.toFixed(2)}MB (${reduction}% smaller)`)
} catch (err) {
  console.error('Optimization failed.')
  if (err?.message) console.error(err.message)
  process.exit(1)
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}