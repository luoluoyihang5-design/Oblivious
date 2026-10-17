import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

const execute = promisify(execFile);
export async function controlChatGPT({ platform = process.platform, appPath = '', action = 'toggle', sourceDir, run = execute }) {
  if (platform === 'win32') {
    const { stdout } = await run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(sourceDir, 'chatgpt.ps1')], {
      windowsHide: true, timeout: 20000, maxBuffer: 256 * 1024,
      env: { ...process.env, ORB_ACTION: action, ORB_CHATGPT_EXE: appPath },
    });
    return stdout.trim();
  }
  if (platform === 'darwin') {
    const { stdout } = await run('/usr/bin/osascript', ['-l', 'JavaScript', join(sourceDir, 'chatgpt-mac.js'), action, appPath], {
      timeout: 10000, maxBuffer: 256 * 1024,
    });
    const state = stdout.trim();
    if (state !== 'not-running') return state;
    await run('/usr/bin/open', appPath ? ['-a', appPath] : ['-b', 'com.openai.chat'], { timeout: 10000, maxBuffer: 256 * 1024 });
    return 'launched';
  }
  throw new Error('当前平台尚不支持 ChatGPT 窗口控制');
}
export function loginSettings(platform, executable) {
  return platform === 'win32' ? { path: executable } : {};
}
