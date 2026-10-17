import test from 'node:test';
import assert from 'node:assert/strict';
import { controlChatGPT, loginSettings } from '../src/platform.mjs';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveCodexExecutable } from '../src/vendor/gpt-niang/usage.mjs';

test('macOS Finder minimal PATH resolves the bundled Codex executable', async () => {
  const fixture=await mkdtemp(join(tmpdir(),'companion-mac-test-'));
  try {
    const root=join(fixture,'Codex.app');
    const bin=join(root,'Contents','Resources','codex-cli','bin');
    await mkdir(bin,{recursive:true});
    await writeFile(join(bin,'codex'),'fixture');
    assert.equal(resolveCodexExecutable('',{platform:'darwin',env:{GPT_NIANG_CODEX_APP:root,PATH:''}}),join(bin,'codex'));
  } finally { await rm(fixture,{recursive:true,force:true}); }
});

test('Windows adapter preserves the fixed script and passes user paths as environment only', async () => {
  const file = 'C:\\Apps\\测试 $ x\\ChatGPT.exe';
  const result = await controlChatGPT({ platform: 'win32', appPath: file, action: 'toggle', sourceDir: 'src', run: async (program, args, options) => {
    assert.equal(program, 'powershell.exe'); assert.equal(options.env.ORB_CHATGPT_EXE, file);
    assert.equal(options.env.ORB_ACTION, 'toggle'); assert.ok(!args.includes(file)); return { stdout: 'minimized\n' };
  } });
  assert.equal(result, 'minimized');
});
test('macOS controller uses argument arrays and launches .app only when not running', async () => {
  const calls = [], appPath = '/Applications/My ChatGPT "test".app';
  const result = await controlChatGPT({ platform: 'darwin', appPath, sourceDir: '/source', run: async (program, args) => {
    calls.push({ program, args }); return { stdout: program.endsWith('osascript') ? 'not-running\n' : '' };
  } });
  assert.equal(result, 'launched'); assert.deepEqual(calls[1].args, ['-a', appPath]);
  assert.equal(calls[0].args.at(-1), appPath);
  let commands = 0;
  assert.equal(await controlChatGPT({ platform: 'darwin', sourceDir: '/source', run: async () => { commands++; return { stdout: 'restored\n' }; } }), 'restored');
  assert.equal(commands, 1);
});
test('macOS JXA branches target only ChatGPT or the configured app path', async () => {
  const source = await readFile(new URL('../src/chatgpt-mac.js', import.meta.url), 'utf8');
  const target = { bundleIdentifier: 'com.openai.chat', localizedName: 'ChatGPT', bundleURL: { path: '/Applications/ChatGPT.app' }, active: true, hidden: false, hide: true, activateWithOptions: flags => flags === 3 };
  const context = vm.createContext({ ObjC: { import() {}, unwrap: value => value }, $: { NSWorkspace: { sharedWorkspace: { runningApplications: { count: 1, objectAtIndex: () => target } } } } });
  vm.runInContext(source, context);
  assert.equal(context.run(['toggle', '']), 'minimized');
  assert.equal(context.run(['show', '']), 'restored');
  assert.equal(context.run(['toggle', '/Applications/Other.app']), 'not-running');
  assert.deepEqual(loginSettings('darwin', '/unused'), {});
});
