# Fixed bundled script: paths are passed in the environment, never interpolated into code.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class OrbWindow {
 public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr data);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int cmd);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint cmd);
}
'@
$ids = @(Get-Process -Name ChatGPT -ErrorAction SilentlyContinue | ForEach-Object { [uint32]$_.Id })
$script:found = [IntPtr]::Zero
[OrbWindow]::EnumWindows({ param($handle, $unused)
 [uint32]$ownerPid = 0
 [void][OrbWindow]::GetWindowThreadProcessId($handle, [ref]$ownerPid)
 if ($ids -contains $ownerPid -and ([OrbWindow]::IsWindowVisible($handle) -or [OrbWindow]::IsIconic($handle)) -and [OrbWindow]::GetWindowTextLength($handle) -gt 0 -and [OrbWindow]::GetWindow($handle, 4) -eq [IntPtr]::Zero) {
  $script:found = $handle
  return $false
 }
 return $true
}, [IntPtr]::Zero) | Out-Null
if ($script:found -ne [IntPtr]::Zero) {
 if ($env:ORB_ACTION -eq 'toggle' -and [OrbWindow]::GetForegroundWindow() -eq $script:found -and -not [OrbWindow]::IsIconic($script:found)) {
  [void][OrbWindow]::ShowWindowAsync($script:found, 6)
  Write-Output 'minimized'
 } else {
  [void][OrbWindow]::ShowWindowAsync($script:found, 9)
  # Windows can reject focus stealing; restoring still exposes the existing window.
  if ([OrbWindow]::SetForegroundWindow($script:found)) { Write-Output 'restored' }
  else { Write-Output 'restored-no-focus' }
 }
 exit 0
}
if ($env:ORB_CHATGPT_EXE) {
 if (-not (Test-Path -LiteralPath $env:ORB_CHATGPT_EXE -PathType Leaf) -or [System.IO.Path]::GetExtension($env:ORB_CHATGPT_EXE) -ine '.exe') { throw '所选 ChatGPT 程序不存在，请重新选择。' }
 Start-Process -FilePath $env:ORB_CHATGPT_EXE
 Write-Output 'launched'
 exit 0
}
$entries = @(Get-StartApps)
$entry = $entries | Where-Object { $_.AppID -like 'OpenAI.ChatGPT-Desktop_*' } | Select-Object -First 1
if (-not $entry) { $entry = $entries | Where-Object { $_.Name -eq 'ChatGPT' } | Select-Object -First 1 }
if ($entry) {
 Start-Process -FilePath explorer.exe -ArgumentList ('shell:AppsFolder\' + $entry.AppID)
 Write-Output 'launched'
} else {
 throw '没有找到 ChatGPT 桌面端。请安装官方 Windows 客户端，或在设置中选择 ChatGPT.exe。'
}
