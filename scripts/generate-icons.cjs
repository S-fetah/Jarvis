const { app, nativeImage } = require('electron')
const fs = require('fs')
const path = require('path')

app.whenReady().then(() => {
  const userPngPath = 'C:/Users/abdelfetah safiddine/.gemini/antigravity/brain/7528fe2f-d45c-4851-b2ce-b126ab577fe2/.user_uploaded/media_1794253002181_4340fbfb.png'
  
  if (!fs.existsSync(userPngPath)) {
    console.error('Source image not found:', userPngPath)
    app.quit()
    return
  }

  const baseImage = nativeImage.createFromPath(userPngPath)
  console.log('Original image size:', baseImage.getSize())

  // Save full-res master PNG
  const outPng = path.join(process.cwd(), 'resources', 'icon.png')
  fs.writeFileSync(outPng, baseImage.toPNG())
  console.log('Saved master PNG:', outPng)

  // Save branding image
  const brandingPng = path.join(process.cwd(), 'resources', 'branding', 'jarvis-owl.png')
  fs.mkdirSync(path.dirname(brandingPng), { recursive: true })
  fs.writeFileSync(brandingPng, baseImage.toPNG())
  console.log('Saved branding PNG:', brandingPng)

  // Also save to renderer public assets for in-app UI / favicon
  const publicDir = path.join(process.cwd(), 'src', 'renderer', 'public')
  if (fs.existsSync(publicDir)) {
    fs.writeFileSync(path.join(publicDir, 'icon.png'), baseImage.toPNG())
    console.log('Saved public icon.png')
  }

  // Generate multi-resolution ICO (256, 128, 64, 48, 32, 16)
  const sizes = [256, 128, 64, 48, 32, 16]
  const images = sizes.map(size => {
    const resized = baseImage.resize({ width: size, height: size, quality: 'best' })
    const pngBuffer = resized.toPNG()
    return { size, buffer: pngBuffer }
  })

  // Construct ICO binary
  const numImages = images.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // Reserved
  header.writeUInt16LE(1, 2) // Type 1 = ICO
  header.writeUInt16LE(numImages, 4) // Count

  let offset = 6 + (numImages * 16)
  const dirEntries = []
  const buffers = []

  for (const img of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0) // Width
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1) // Height
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
  console.log('Successfully generated ICO:', outIco, 'Total size:', icoBuffer.length)

  // Verify Electron can load it
  const verifyIco = nativeImage.createFromPath(outIco)
  console.log('Verified ICO with nativeImage, empty?', verifyIco.isEmpty(), 'sizes:', verifyIco.getSize())

  app.quit()
})
