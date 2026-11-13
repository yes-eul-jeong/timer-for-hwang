// public/icon.svg, scripts/icon-maskable.svg로 PNG 아이콘과 favicon.ico를 만든다.
// SVG는 scripts/make-icons.py가 만든다. 실행: docker compose -f docker/compose.yml run --rm app node scripts/make-icons.mjs
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const icon = await readFile('public/icon.svg')
const maskable = await readFile('scripts/icon-maskable.svg')

const png = (svg, size) => sharp(svg, { density: 72 * (size / 512) * 4 }).resize(size, size).png().toBuffer()

const out = [
  ['public/pwa-64x64.png', icon, 64],
  ['public/pwa-192x192.png', icon, 192],
  ['public/pwa-512x512.png', icon, 512],
  // iOS가 모서리를 둥글게 깎으므로 여백 없이 꽉 채운다
  ['public/apple-touch-icon-180x180.png', icon, 180],
  ['public/maskable-icon-512x512.png', maskable, 512],
]
for (const [path, svg, size] of out) await writeFile(path, await png(svg, size))

// favicon.ico: 48px PNG 한 장을 담은 ICO
const fav = await png(icon, 48)
const head = Buffer.alloc(22)
head.writeUInt16LE(0, 0) // reserved
head.writeUInt16LE(1, 2) // type: icon
head.writeUInt16LE(1, 4) // count
head.writeUInt8(48, 6) // width
head.writeUInt8(48, 7) // height
head.writeUInt8(0, 8) // palette
head.writeUInt8(0, 9) // reserved
head.writeUInt16LE(1, 10) // planes
head.writeUInt16LE(32, 12) // bpp
head.writeUInt32LE(fav.length, 14) // size
head.writeUInt32LE(22, 18) // offset
await writeFile('public/favicon.ico', Buffer.concat([head, fav]))

console.log('icons written')
