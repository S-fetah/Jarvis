const { app, nativeImage } = require('electron')
const fs = require('fs')
const path = require('path')

app.whenReady().then(() => {
  const userPngPath = 'C:/Users/abdelfetah safiddine/.gemini/antigravity/brain/7528fe2f-d45c-4851-b2ce-b126ab577fe2/.user_uploaded/media_1794253002181_4340fbfb.png'
  
  // Fallback to resources/icon.png if user path is not present in another environment
  const srcPath = fs.existsSync(userPngPath) ? userPngPath : path.join(process.cwd(), 'resources', 'icon.png')
  
  if (!fs.existsSync(srcPath)) {
    console.error('Source image not found:', srcPath)
    app.quit()
    return
  }

  const rawImage = nativeImage.createFromPath(srcPath)
  console.log('Raw image size:', rawImage.getSize())

  // Apply 1.45x zoom crop:
  // Original is 500x500. A 1.45x zoom corresponds to a ~345x345 crop window.
  // Center is cx=256, so cropX = 256 - 172 = 84.
  // Head ears start at y=43, so cropY = 38 preserves the ears with 5px breathing margin.
  const cropSize = 345
  const cropX = 84
  const cropY = 38

  const cropped = rawImage.crop({ x: cropX, y: cropY, width: cropSize, height: cropSize })
  // Resize to high-resolution 500x500 master with best resampling quality
  const masterImage = cropped.resize({ width: 500, height: 500, quality: 'best' })
  const masterPng = masterImage.toPNG()

  // 1. Save master PNG in resources
  const outPng = path.join(process.cwd(), 'resources', 'icon.png')
  fs.writeFileSync(outPng, masterPng)
  console.log('Saved 1.45x zoomed master PNG:', outPng)

  // 2. Save branding image
  const brandingPng = path.join(process.cwd(), 'resources', 'branding', 'jarvis-owl.png')
  fs.mkdirSync(path.dirname(brandingPng), { recursive: true })
  fs.writeFileSync(brandingPng, masterPng)
  console.log('Saved 1.45x zoomed branding PNG:', brandingPng)

  // 3. Save to renderer public assets for in-app UI / favicon
  const publicDir = path.join(process.cwd(), 'src', 'renderer', 'public')
  if (fs.existsSync(publicDir)) {
    fs.writeFileSync(path.join(publicDir, 'icon.png'), masterPng)
    console.log('Saved 1.45x zoomed public icon.png')
  }

  // 4. Generate multi-resolution ICO (256, 128, 64, 48, 32, 16)
  const sizes = [256, 128, 64, 48, 32, 16]
  const images = sizes.map((size) => {
    const resized = masterImage.resize({ width: size, height: size, quality: 'best' })
    const pngBuffer = resized.toPNG()
    return { size, buffer: pngBuffer }
  })

  // Construct ICO binary
  const numImages = images.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // Reserved
  header.writeUInt16LE(1, 2) // Type 1 = ICO
  header.writeUInt16LE(numImages, 4) // Count

  let offset = 6 + numImages * 16
  const dirEntries = []
  const buffers = []

  for (const img of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0) // Width (0 means 256)
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1) // Height (0 means 256)
    entry.writeUInt8(0, 2) // Color count (0 = no palette)
    entry.writeUInt8(0, 3) // Reserved
    entry.writeUInt16LE(1, 4) // Color planes
    entry.writeUInt16LE(32, 6) // Bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8) // Size of image data
    entry.writeUInt32LE(offset, 12) // Offset of image data
    dirEntries.push(entry)
    buffers.push(img.buffer)
    offset += img.buffer.length
  }

  const icoBuffer = Buffer.concat([header, ...dirEntries, ...buffers])
  const outIco = path.join(process.cwd(), 'resources', 'icon.ico')
  fs.writeFileSync(outIco, icoBuffer)
  console.log('Successfully generated zoomed ICO:', outIco, 'Total size:', icoBuffer.length)

  // Verify Electron can load the generated ICO
  const verifyIco = nativeImage.createFromPath(outIco)
  console.log('Verified ICO with nativeImage, empty?', verifyIco.isEmpty(), 'sizes:', verifyIco.getSize())

  app.quit()
})
