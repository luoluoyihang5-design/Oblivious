// JavaScript for Automation, executed by macOS osascript, not by Electron.
// AppKit controls visibility without System Events/accessibility scripting.
// Paths and actions arrive as argv, never as interpolated source code.
ObjC.import('AppKit');
function run(argv) {
  var action = argv[0] || 'toggle';
  var configured = argv[1] || '';
  var applications = $.NSWorkspace.sharedWorkspace.runningApplications;
  var target = null;
  for (var i = 0; i < Number(applications.count); i++) {
    var candidate = applications.objectAtIndex(i);
    var identifier = ObjC.unwrap(candidate.bundleIdentifier) || '';
    var name = ObjC.unwrap(candidate.localizedName) || '';
    var location = candidate.bundleURL ? ObjC.unwrap(candidate.bundleURL.path) : '';
    if (configured ? location === configured : identifier === 'com.openai.chat' || name === 'ChatGPT') {
      target = candidate; break;
    }
  }
  if (!target) return 'not-running';
  // JXA invokes zero-argument Objective-C selectors when their properties are read.
  if (action === 'toggle' && target.active && !target.hidden) return target.hide ? 'minimized' : 'restored-no-focus';
  return target.activateWithOptions(3) ? 'restored' : 'restored-no-focus';
}
