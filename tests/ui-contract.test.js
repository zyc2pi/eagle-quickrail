const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const pluginSource = fs.readFileSync(path.join(projectRoot, "js", "plugin.js"), "utf8");

test("successful navigation does not show a toast over the compact rail", () => {
  assert.doesNotMatch(pluginSource, /showToast\(`已打开：\$\{item\.name\}`\)/);
});

test("linked docking is explicit and does not depend on Electron remote", () => {
  assert.match(indexHtml, /id="dockButton"/);
  assert.match(indexHtml, /联动吸附/);
  assert.match(pluginSource, /window-link\.ps1/);
  assert.match(pluginSource, /getNativeWindowHandle/);
  assert.doesNotMatch(pluginSource, /@electron\/remote/);
});

test("linked docking preference survives startup races and helper restarts", () => {
  const helperExit = pluginSource.match(
    /child\.on\("exit",[\s\S]*?\n\s*return helper;/,
  );
  assert.ok(helperExit, "dock helper exit handler should exist");
  assert.match(helperExit[0], /scheduleDockRetry\(\)/);
  assert.doesNotMatch(helperExit[0], /persistBoolean\(STORAGE\.linkedDocked, false\)/);

  const dockFunction = pluginSource.match(
    /async function setDocked\(value, options\)\s*\{[\s\S]*?\n  \}\n\n  async function revealEagle/,
  );
  assert.ok(dockFunction, "setDocked should exist");
  const failure = dockFunction[0].match(/catch \(error\)\s*\{[\s\S]*?\n    \} finally/);
  assert.ok(failure, "setDocked failure path should exist");
  assert.match(failure[0], /scheduleDockRetry\(\)/);
  assert.doesNotMatch(failure[0], /persistBoolean\(STORAGE\.linkedDocked, false\)/);
  assert.match(
    pluginSource,
    /dockButton\.addEventListener\("click", \(\) =>\s*setDocked\(!state\.dockRestoreRequested\)/,
  );
});

test("window resize is persisted and restored when the plugin is created again", () => {
  assert.match(pluginSource, /windowSize:\s*"quickrail:window-size"/);
  assert.match(pluginSource, /window\.addEventListener\("resize"[\s\S]*scheduleWindowSizeSave\(\)/);
  assert.match(pluginSource, /applyWindowLayout\(false,\s*\{\s*restoreRemembered:\s*true\s*\}\)/);
});

test("window position is persisted across Eagle restarts, including linked movement", () => {
  assert.match(pluginSource, /windowPosition:\s*"quickrail:window-position"/);
  assert.match(pluginSource, /window\.eagle\.window\.getPosition\(\)/);
  assert.match(pluginSource, /window\.eagle\.window\.setPosition\(/);
  assert.match(pluginSource, /Core\.normalizeRememberedWindowPosition/);
  assert.match(
    pluginSource,
    /setInterval\(\s*persistCurrentWindowPosition,\s*POSITION_SAVE_INTERVAL\s*\)/,
  );

  const initializer = pluginSource.match(
    /async function initializePlugin\(\)\s*\{[\s\S]*?\n  \}\n\n  function handleLifecycleError/,
  );
  assert.ok(initializer, "initializePlugin should exist");
  const source = initializer[0];
  const restoreIndex = source.indexOf("restoreRememberedWindowPosition()");
  const showIndex = source.indexOf("window.eagle.window.showInactive()");
  const dockIndex = source.indexOf("setDocked(true");
  assert.ok(restoreIndex >= 0, "saved position should be restored during initialization");
  assert.ok(restoreIndex < showIndex, "position should be restored before the window is shown");
  assert.ok(showIndex < dockIndex, "linked docking should start after the restored window is shown");
});

test("opening the manager preserves the saved folder expansion state", () => {
  const managerFunction = pluginSource.match(
    /function setManagerOpen\(open\)\s*\{[\s\S]*?\n  \}\n\n  async function refreshLibrary/,
  );

  assert.ok(managerFunction, "setManagerOpen should exist");
  assert.doesNotMatch(managerFunction[0], /state\.collapsedIds\s*=/);
  assert.doesNotMatch(managerFunction[0], /saveCollapsed\(\)/);
});

test("Eagle data APIs wait for plugin-create even when plugin-show arrives first", () => {
  assert.match(pluginSource, /createPluginLifecycleGate\(initializePlugin\)/);
  assert.match(pluginSource, /onPluginCreate\([\s\S]*markCreated\(\)/);
  assert.match(pluginSource, /onPluginShow\([\s\S]*whenReady\(/);
});

test("manager exposes day, week, and month usage periods with click-order selection", () => {
  for (const id of [
    "usageTabButton",
    "usageView",
    "usageList",
    "usageSelectedCount",
    "selectAllUsageButton",
    "clearUsageSelectionButton",
  ]) {
    assert.match(indexHtml, new RegExp(`id="${id}"`));
  }
  for (const period of ["day", "week", "month"]) {
    assert.match(indexHtml, new RegExp(`data-usage-period="${period}"`));
  }
  assert.doesNotMatch(indexHtml, /data-usage-period="threeHours"/);
  assert.doesNotMatch(pluginSource, /threeHours/);
  assert.match(pluginSource, /recordFolderUse\(id,\s*"quickrail"\)/);
  assert.match(pluginSource, /recordFolderUse\(observation\.recordId,\s*"eagle"\)/);
  assert.match(pluginSource, /function toggleUsageCandidate\(id\)/);
  assert.match(pluginSource, /Core\.togglePinned\(state\.pinnedIds,\s*id\)/);
  assert.doesNotMatch(indexHtml, /id="sortByUsageButton"/);
});

test("rail items expose a safe right-click color and removal editor", () => {
  for (const id of [
    "pinContextStrip",
    "pinContextPalette",
    "pinContextResetColor",
    "pinContextRemoveButton",
    "pinContextConfirmRemoveButton",
  ]) {
    assert.match(indexHtml, new RegExp(`id="${id}"`));
  }

  assert.match(indexHtml, /从快捷轨移除/);
  assert.match(pluginSource, /addEventListener\("contextmenu"/);
  assert.match(pluginSource, /pinColors:\s*"quickrail:pin-colors:"/);
  assert.match(pluginSource, /Core\.normalizePinColors/);
  assert.doesNotMatch(pluginSource, /eagle\.folder\.(?:delete|remove|save)/);
});

test("duplicate rail names render automatic parent-path context", () => {
  assert.match(pluginSource, /Core\.buildDistinctFolderLabels/);
  assert.match(pluginSource, /class="pin-parent"/);
  assert.match(pluginSource, /button\.classList\.toggle\("disambiguated"/);
});

test("right-click length editing previews, confirms, cancels, and resets", () => {
  for (const id of [
    "pinContextAdjustLengthButton",
    "pinContextResetLengthButton",
    "pinLengthActions",
    "pinLengthConfirmButton",
    "pinLengthCancelButton",
  ]) {
    assert.match(indexHtml, new RegExp(`id="${id}"`));
  }

  assert.match(pluginSource, /pinWidths:\s*"quickrail:pin-widths:"/);
  assert.match(pluginSource, /Core\.normalizePinWidths/);
  assert.match(pluginSource, /class="pin-length-handle"/);
  assert.match(pluginSource, /function confirmPinLengthEdit\(/);
  assert.match(pluginSource, /function cancelPinLengthEdit\(/);
  assert.match(pluginSource, /function resetPinLength\(/);
});

test("overflowing shortcut rail supports horizontal mouse-wheel navigation", () => {
  assert.match(
    pluginSource,
    /pinnedList\.addEventListener\(\s*"wheel"[\s\S]*?scrollLeft\s*\+=/,
  );
});
