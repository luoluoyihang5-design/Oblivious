import { packager } from '@electron/packager';
import { readFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const platform = process.argv[2] || process.platform;
// A Windows package built on an Apple Silicon Mac should still target common x64 PCs.
const arch = process.argv[3] || (platform === 'win32' ? 'x64' : process.arch);
if (!['darwin', 'win32'].includes(platform) || !['arm64', 'x64'].includes(arch)) throw new Error('支持 darwin/win32 与 arm64/x64');
if (platform === 'darwin' && process.platform !== 'darwin') throw new Error('请在 macOS 执行 Mac 构建，以保留 .app 符号链接并完成本地签名。');
const out = join(root, 'dist');
await mkdir(out, { recursive: true });
const bundles = await packager({
  dir: root, name: 'ChatGPT Companion', appBundleId: 'local.zhizhi.companion',
  platform, arch, out, overwrite: false, asar: false,
  electronVersion: manifest.devDependencies.electron, appVersion: manifest.version,
  icon: platform === 'win32' ? join(root, 'assets/chatgpt.ico') : undefined,
  // No developer identity is invented; the macOS result is locally ad-hoc signed below.
  darwinDarkModeSupport: true,
  extendInfo: { CFBundleDisplayName: '知知桌面伴侣' },
  ignore: [/^\/dist(?:\/|$)/, /^\/test(?:\/|$)/, /^\/tools(?:\/|$)/, /^\/\.github(?:\/|$)/, /^\/generated_images(?:\/|$)/, /^\/MANIFEST\.sha256$/, /\.command$/],
});
const run = promisify(execFile);
for (const bundle of bundles) {
  if (platform !== 'darwin') { console.log(bundle); continue; }
  const app = join(bundle, 'ChatGPT Companion.app');
  await run('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', app]);
  await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
  const archive = join(out, `ZhizhiCompanion-${manifest.version}-macos-${arch}.zip`);
  await run('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, archive]);
  console.log(archive);
}
