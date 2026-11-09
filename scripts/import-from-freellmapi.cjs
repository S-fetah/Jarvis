const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js');

app.whenReady().then(async () => {
  try {
    const appData = process.env.APPDATA || '';
    const freeApiDir = path.join(appData, 'FreeLLMAPI');
    const encKeyFile = path.join(freeApiDir, '.encryption-key');
    const dbFile = path.join(freeApiDir, 'freeapi.db');

    if (!fs.existsSync(encKeyFile) || !fs.existsSync(dbFile)) {
      console.log('[Migration] No FreeLLMAPI installation found.');
      app.quit();
      return;
    }

    const encKeyHex = fs.readFileSync(encKeyFile, 'utf8').trim();
    const encKey = Buffer.from(encKeyHex, 'hex');

    const SQL = await initSqlJs();
    const dbBuffer = fs.readFileSync(dbFile);
    const db = new SQL.Database(dbBuffer);

    const res = db.exec('SELECT id, platform, encrypted_key, iv, auth_tag, enabled, base_url FROM api_keys');
    if (!res || !res.length) {
      console.log('[Migration] No API keys found in FreeLLMAPI database.');
      app.quit();
      return;
    }

    const rows = res[0].values;
    const imported = [];

    // Load or initialize Jarvis provider vault
    const vaultPath = path.join(process.cwd(), 'userData', 'provider_vault.json');
    let vaultData = {
      providers: {},
      localServerEnabled: true,
      localServerPort: 31415,
      activeProviderId: 'auto'
    };

    if (fs.existsSync(vaultPath)) {
      try {
        vaultData = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
      } catch {}
    }

    const platformMap = {
      google: 'gemini',
      groq: 'groq',
      openrouter: 'openrouter',
      nvidia: 'nvidia',
      mistral: 'mistral',
      cohere: 'cohere',
      cloudflare: 'cloudflare',
      cerebras: 'cerebras',
      deepseek: 'deepseek',
      openai: 'openai',
      anthropic: 'anthropic'
    };

    for (const row of rows) {
      const [id, platform, enc, iv, tag, enabled, baseUrl] = row;
      const targetProviderId = platformMap[platform.toLowerCase()];
      if (!targetProviderId) {
        continue;
      }

      try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(tag, 'hex'));
        const decryptedKey = decipher.update(enc, 'hex', 'utf8') + decipher.final('utf8');

        if (!decryptedKey || !decryptedKey.trim()) continue;

        // Encrypt with Electron's DPAPI safeStorage
        let encryptedKey = '';
        if (safeStorage.isEncryptionAvailable()) {
          encryptedKey = safeStorage.encryptString(decryptedKey.trim()).toString('base64');
        } else {
          encryptedKey = `enc:${Buffer.from(decryptedKey.trim(), 'utf8').toString('base64')}`;
        }

        vaultData.providers[targetProviderId] = {
          encryptedKey,
          enabled: Boolean(enabled !== 0),
          baseUrl: baseUrl || undefined
        };

        imported.push({
          platform,
          targetProviderId,
          masked: decryptedKey.slice(0, 4) + '••••' + decryptedKey.slice(-4)
        });
      } catch (err) {
        console.error(`[Migration] Failed to decrypt key for ${platform}:`, err.message);
      }
    }

    // Save updated vault to disk
    fs.mkdirSync(path.dirname(vaultPath), { recursive: true });
    fs.writeFileSync(vaultPath, JSON.stringify(vaultData, null, 2), 'utf8');

    console.log('[Migration] Successfully imported and encrypted keys into Jarvis vault:');
    for (const item of imported) {
      console.log(`  ✓ ${item.platform} -> ${item.targetProviderId} (${item.masked})`);
    }
  } catch (err) {
    console.error('[Migration] Error:', err);
  } finally {
    app.quit();
  }
});
