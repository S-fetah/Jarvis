import { _electron as electron } from 'playwright'
import fs from 'fs'
import path from 'path'

const outDir = path.resolve('output/ui-review/baseline')
fs.mkdirSync(outDir, { recursive: true })

const app = await electron.launch({
  args: ['.'],
  env: { ...process.env, NODE_ENV: 'production' }
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  await app.firstWindow()
  await sleep(1800)

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
  await sleep(800)
  console.log('MAIN', main.url())
  await main.screenshot({ path: path.join(outDir, 'main-light.png') })

  const darkToggle = main.locator('button[title="Switch to Dark Mode"]')
  if (await darkToggle.count()) {
    await darkToggle.first().click()
    await sleep(600)
    await main.screenshot({ path: path.join(outDir, 'main-dark.png') })
    const lightToggle = main.locator('button[title="Switch to Light Mode"]')
    if (await lightToggle.count()) {
      await lightToggle.first().click()
      await sleep(400)
    }
  }

  const settingsButton = main.locator('button[title="Gateway & Key Settings"]')
  if (await settingsButton.count()) {
    await settingsButton.first().click()
    await sleep(500)
    await main.screenshot({ path: path.join(outDir, 'settings-light.png') })
    await main.reload()
    await main.waitForLoadState('domcontentloaded')
    await sleep(1200)
  }

  const hubButton = main.locator('button[title*="free model"]')
  if (await hubButton.count()) {
    await hubButton.first().click()
    await sleep(500)
    await main.screenshot({ path: path.join(outDir, 'models-hub-light.png') })
    await main.reload()
    await main.waitForLoadState('domcontentloaded')
    await sleep(1200)
  }

  if (quick) {
    await quick.waitForLoadState('domcontentloaded').catch(() => {})
    await sleep(500)
    console.log('QUICK', quick.url())
    await quick.screenshot({ path: path.join(outDir, 'quickchat-light.png') })
  }

  if (mascot) {
    await mascot.waitForLoadState('domcontentloaded').catch(() => {})
    await sleep(1200)
    console.log('MASCOT', mascot.url())
    await mascot.screenshot({ path: path.join(outDir, 'mascot.png'), omitBackground: true })
  }
} finally {
  await app.close()
}

console.log(`Baseline screenshots written to ${outDir}`)
