# Create Windows Desktop & Project Shortcut with the Jarvis Icon
$projectDir = "C:\work\softwares\jarvis"
$iconPath = Join-Path $projectDir "resources\icon.ico"
$targetBatch = Join-Path $projectDir "jarvis.bat"
$desktopPath = [Environment]::GetFolderPath("Desktop")

if (-not (Test-Path $iconPath)) {
    Write-Host "[Shortcut] Warning: Icon not found at $iconPath" -ForegroundColor Yellow
}

$wsh = New-Object -ComObject WScript.Shell

# 1. Create Project Root Shortcut
$projectShortcutPath = Join-Path $projectDir "Jarvis.lnk"
$sc1 = $wsh.CreateShortcut($projectShortcutPath)
$sc1.TargetPath = $targetBatch
$sc1.WorkingDirectory = $projectDir
$sc1.IconLocation = "$iconPath,0"
$sc1.Description = "Launch or Restart Jarvis AI Assistant"
$sc1.Save()
Write-Host "[Shortcut] Created Project Shortcut: $projectShortcutPath" -ForegroundColor Green

# 2. Create Desktop Shortcut
if (Test-Path $desktopPath) {
    $desktopShortcutPath = Join-Path $desktopPath "Jarvis.lnk"
    $sc2 = $wsh.CreateShortcut($desktopShortcutPath)
    $sc2.TargetPath = $targetBatch
    $sc2.WorkingDirectory = $projectDir
    $sc2.IconLocation = "$iconPath,0"
    $sc2.Description = "Launch or Restart Jarvis AI Assistant"
    $sc2.Save()
    Write-Host "[Shortcut] Created Desktop Shortcut: $desktopShortcutPath" -ForegroundColor Green
}
