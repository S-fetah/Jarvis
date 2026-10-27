import { _electron as electron } from 'playwright'
import fs from 'fs'
import path from 'path'

const outDir = path.resolve('output/ui-review/after')
fs.mkdirSync(outDir, { recursive: true })

const app = await electron.launch({
  args: ['.'],
  env: { ...process.env, NODE_ENV: 'production' }
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  await app.firstWindow()
  await sleep(2200)

  const findPage = (hash) => {
    const pages = app.windows()
    return hash
      ? pages.find((p) => p.url().includes(hash))
      : pages.find((p) => !p.url().includes('#') && p.url().endsWith('index.html'))
  }

  const main = findPage(null)
  const quick = findPage('#quickchat')
  const mascot = findPage('#mascot')

  if (!main) throw new Error('Main window not found')
  await main.waitForLoadState('domcontentloaded')
  await sleep(1000)
  console.log('MAIN URL:', main.url())

  // 1. Capture Main Window Light Mode
  await main.screenshot({ path: path.join(outDir, 'main-light.png') })
  console.log('Saved main-light.png')

  // 2. Open Evidence Rail in Light Mode
  const evidenceBtn = main.locator('button:has-text("Evidence")')
  if (await evidenceBtn.count()) {
    await evidenceBtn.first().click()
    await sleep(600)
    await main.screenshot({ path: path.join(outDir, 'main-light-evidence.png') })
    console.log('Saved main-light-evidence.png')
    // Close evidence rail
    const closeEvidence = main.locator('button[aria-label="Close evidence rail"]')
    if (await closeEvidence.count()) {
      await closeEvidence.first().click()
      await sleep(400)
    }
  }

  // 3. Capture Settings Modal Light Mode
  const settingsButton = main.locator('button[aria-label*="settings" i]')
  if (await settingsButton.count()) {
    await settingsButton.first().click()
    await sleep(600)
    await main.screenshot({ path: path.join(outDir, 'settings-light.png') })
    console.log('Saved settings-light.png')
    await main.keyboard.press('Escape')
    await sleep(400)
  }

  // 4. Capture Free Models Hub Modal Light Mode
  const hubButton = main.locator('button[aria-label*="Free model" i]')
  if (await hubButton.count()) {
    await hubButton.first().click()
    await sleep(600)
    await main.screenshot({ path: path.join(outDir, 'models-hub-light.png') })
    console.log('Saved models-hub-light.png')
    await main.keyboard.press('Escape')
    await sleep(400)
  }

  // 5. Toggle to Dark Mode and Capture
  const darkToggle = main.locator('button[aria-label*="Switch to dark" i]')
  if (await darkToggle.count()) {
    await darkToggle.first().click()
    await sleep(800)
    await main.screenshot({ path: path.join(outDir, 'main-dark.png') })
    console.log('Saved main-dark.png')

    // Open Settings in Dark Mode
    if (await settingsButton.count()) {
      await settingsButton.first().click()
      await sleep(600)
      await main.screenshot({ path: path.join(outDir, 'settings-dark.png') })
      console.log('Saved settings-dark.png')
      await main.keyboard.press('Escape')
      await sleep(400)
    }

    // Switch back to light
    const lightToggle = main.locator('button[aria-label*="Switch to light" i]')
    if (await lightToggle.count()) {
      await lightToggle.first().click()
      await sleep(600)
    }
  }

  // 6. Capture QuickChat
  if (quick) {
    await quick.waitForLoadState('domcontentloaded').catch(() => {})
    await sleep(800)
    console.log('QUICK URL:', quick.url())
    await quick.screenshot({ path: path.join(outDir, 'quickchat-light.png') })
    console.log('Saved quickchat-light.png')
  }

  // 7. Capture Mascot
  if (mascot) {
    await mascot.waitForLoadState('domcontentloaded').catch(() => {})
    await sleep(1500)
    console.log('MASCOT URL:', mascot.url())
    await mascot.screenshot({ path: path.join(outDir, 'mascot.png'), omitBackground: true })
    console.log('Saved mascot.png')
  }
} catch (err) {
  console.error('Error during capture:', err)
} finally {
  await app.close()
}

console.log(`After screenshots successfully written to ${outDir}`)
