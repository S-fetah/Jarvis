import fs from 'fs'
import path from 'path'

export interface ChromeProfile {
  directory: string // e.g. "Default", "Profile 4"
  name: string // e.g. "abdelfetah", "fennec"
  userName?: string // e.g. "fettahsafi6@gmail.com", "fennecbooking.dz@gmail.com"
}

/**
 * Discovers Google Chrome profiles configured on the current Windows system.
 * Reads %LOCALAPPDATA%\Google\Chrome\User Data\Local State.
 */
export function getChromeProfiles(): ChromeProfile[] {
  if (process.platform !== 'win32') return []

  const localAppData = process.env.LOCALAPPDATA
  if (!localAppData) return []

  const localStatePath = path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Local State')
  if (!fs.existsSync(localStatePath)) return []

  try {
    const raw = fs.readFileSync(localStatePath, 'utf8')
    const parsed = JSON.parse(raw)
    const infoCache = parsed?.profile?.info_cache || {}
    const profiles: ChromeProfile[] = []

    for (const [dirName, profileData] of Object.entries(infoCache)) {
      const data = profileData as any
      profiles.push({
        directory: dirName,
        name: data?.name || dirName,
        userName: data?.user_name || undefined
      })
    }

    return profiles.sort((a, b) => {
      if (a.directory === 'Default') return -1
      if (b.directory === 'Default') return 1
      return a.name.localeCompare(b.name)
    })
  } catch (err) {
    console.warn('[ChromeProfiles] Failed to read Chrome profiles:', err)
    return []
  }
}

/**
 * Resolves a profile query (e.g. "fennec", "fettahsafi6@gmail.com", "Profile 4", "Default")
 * to its exact profile directory name (e.g. "Profile 4").
 */
export function resolveProfileDirectory(profileQuery?: string): string | undefined {
  if (!profileQuery) return undefined
  const profiles = getChromeProfiles()
  if (profiles.length === 0) return profileQuery

  const q = profileQuery.trim().toLowerCase()

  // 1. Direct match on directory
  const byDir = profiles.find((p) => p.directory.toLowerCase() === q)
  if (byDir) return byDir.directory

  // 2. Match on profile display name
  const byName = profiles.find((p) => p.name.toLowerCase() === q || p.name.toLowerCase().includes(q))
  if (byName) return byName.directory

  // 3. Match on user email / userName
  const byEmail = profiles.find((p) => p.userName && p.userName.toLowerCase().includes(q))
  if (byEmail) return byEmail.directory

  return profileQuery
}
