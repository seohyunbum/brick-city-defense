[CmdletBinding()]
param(
    [string]$GameUrl = "https://seohyunbum.github.io/lego-city-game/",
    [string]$ShortcutName = "레고 시티 - 브릭 몬스터 방어전"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$iconPath = Join-Path $repoRoot "assets\icons\brick-city-defense.ico"
if (-not (Test-Path -LiteralPath $iconPath)) {
    throw "게임 아이콘을 찾을 수 없습니다: $iconPath"
}

$edgeCandidates = @(
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe")
)
$edgePath = $edgeCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $edgePath) {
    $edgeCommand = Get-Command msedge.exe -ErrorAction SilentlyContinue
    if ($edgeCommand) {
        $edgePath = $edgeCommand.Source
    }
}
if (-not $edgePath) {
    throw "Microsoft Edge를 찾을 수 없습니다. Edge 설치 후 다시 실행해 주세요."
}

$desktopPath = [Environment]::GetFolderPath("Desktop")
if (-not $desktopPath) {
    throw "Windows 바탕화면 경로를 확인할 수 없습니다."
}

$shortcutPath = Join-Path $desktopPath ("{0}.lnk" -f $ShortcutName)
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $edgePath
$shortcut.Arguments = "--app=`"$GameUrl`" --start-maximized"
$shortcut.WorkingDirectory = $repoRoot
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = "GitHub Pages의 최신 레고 시티 브릭 몬스터 방어전을 실행합니다."
$shortcut.WindowStyle = 3
$shortcut.Save()

Write-Output "바탕화면 바로가기 생성 완료: $shortcutPath"
Write-Output "실행 URL: $GameUrl"
