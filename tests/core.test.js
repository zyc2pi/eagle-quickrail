const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../js/core.js");

test("flattenFolders flattens nested folders and builds readable paths", () => {
  const folders = Core.flattenFolders([
    {
      id: "root",
      name: "项目",
      iconColor: "orange",
      children: [
        {
          id: "child",
          name: "参考",
          parent: "root",
          children: [{ id: "leaf", name: "海报", parent: "child", children: [] }],
        },
      ],
    },
  ]);

  assert.deepEqual(
    folders.map(({ id, depth, path }) => ({ id, depth, path })),
    [
      { id: "root", depth: 0, path: "项目" },
      { id: "child", depth: 1, path: "项目 / 参考" },
      { id: "leaf", depth: 2, path: "项目 / 参考 / 海报" },
    ],
  );
});

test("flattenFolders ignores duplicate ids and malformed nodes", () => {
  const folders = Core.flattenFolders([
    { id: "one", name: "一", children: [{ id: "one", name: "重复", children: [] }] },
    { name: "缺少 ID", children: [] },
    null,
  ]);

  assert.equal(folders.length, 1);
  assert.equal(folders[0].name, "一");
});

test("duplicate shortcut names receive the shortest unique parent context", () => {
  const labels = Core.buildDistinctFolderLabels([
    { id: "unique", name: "海报", path: "设计 / 海报" },
    { id: "a", name: "图片", path: "项目 A / 素材 / 图片" },
    { id: "b", name: "图片", path: "项目 B / 素材 / 图片" },
    { id: "c", name: "图片", path: "项目 C / 照片 / 图片" },
  ]);

  assert.deepEqual(labels.get("unique"), { primary: "海报", context: "" });
  assert.deepEqual(labels.get("a"), {
    primary: "图片",
    context: "项目 A › 素材",
  });
  assert.deepEqual(labels.get("b"), {
    primary: "图片",
    context: "项目 B › 素材",
  });
  assert.deepEqual(labels.get("c"), { primary: "图片", context: "照片" });
});

test("identical shortcut paths fall back to a stable id suffix", () => {
  const labels = Core.buildDistinctFolderLabels([
    { id: "folder-1234", name: "图片", path: "项目 / 图片" },
    { id: "folder-abcd", name: "图片", path: "项目 / 图片" },
  ]);

  assert.deepEqual(labels.get("folder-1234"), {
    primary: "图片",
    context: "项目 · #1234",
  });
  assert.deepEqual(labels.get("folder-abcd"), {
    primary: "图片",
    context: "项目 · #abcd",
  });
});

test("normalizePinned keeps All, removes missing ids, and de-duplicates", () => {
  const result = Core.normalizePinned(
    [Core.ALL_ID, "a", "missing", "a", Core.ALL_ID],
    new Set(["a", "b"]),
  );

  assert.deepEqual(result, [Core.ALL_ID, "a"]);
});

test("togglePinned adds and removes an item without mutating input", () => {
  const original = ["a"];
  const added = Core.togglePinned(original, "b");
  const removed = Core.togglePinned(added, "a");

  assert.deepEqual(original, ["a"]);
  assert.deepEqual(added, ["a", "b"]);
  assert.deepEqual(removed, ["b"]);
});

test("normalizePinColors keeps only supported shortcut color overrides", () => {
  const normalized = Core.normalizePinColors({
    [Core.ALL_ID]: "purple",
    a: "red",
    b: "not-a-color",
    c: 42,
  });

  assert.deepEqual(normalized, {
    [Core.ALL_ID]: "purple",
    a: "red",
  });
  assert.deepEqual(Core.normalizePinColors(null), {});
});

test("normalizePinWidths validates and clamps per-shortcut widths", () => {
  assert.deepEqual(
    Core.normalizePinWidths({ a: 124.6, narrow: 20, wide: 999, bad: "120" }),
    { a: 125, narrow: 64, wide: 260 },
  );
  assert.equal(Core.normalizePinWidth(Number.NaN), null);
  assert.equal(Core.normalizePinWidth(null), null);
  assert.deepEqual(Core.normalizePinWidths(null), {});
});

test("movePinned moves the dragged item before its target", () => {
  assert.deepEqual(Core.movePinned(["all", "a", "b", "c"], "c", "a"), [
    "all",
    "c",
    "a",
    "b",
  ]);
  assert.deepEqual(Core.movePinned(["a", "b"], "missing", "a"), ["a", "b"]);
});

test("filterFolders matches both folder name and full path", () => {
  const folders = [
    { id: "a", name: "海报", path: "项目 / 海报" },
    { id: "b", name: "图标", path: "素材 / UI / 图标" },
  ];

  assert.deepEqual(
    Core.filterFolders(folders, "项目").map((folder) => folder.id),
    ["a"],
  );
  assert.deepEqual(
    Core.filterFolders(folders, "ui").map((folder) => folder.id),
    ["b"],
  );
});

test("getVisibleFolders hides descendants of collapsed folders", () => {
  const folders = [
    { id: "a", depth: 0, childCount: 2 },
    { id: "a1", depth: 1, childCount: 1 },
    { id: "a1x", depth: 2, childCount: 0 },
    { id: "a2", depth: 1, childCount: 0 },
    { id: "b", depth: 0, childCount: 1 },
    { id: "b1", depth: 1, childCount: 0 },
  ];

  assert.deepEqual(
    Core.getVisibleFolders(folders, new Set(["a"]), "").map((folder) => folder.id),
    ["a", "b", "b1"],
  );
  assert.deepEqual(
    Core.getVisibleFolders(folders, new Set(["a1"]), "").map((folder) => folder.id),
    ["a", "a1", "a2", "b", "b1"],
  );
});

test("getVisibleFolders ignores collapse state while searching", () => {
  const folders = [
    { id: "a", name: "项目", path: "项目", depth: 0, childCount: 1 },
    { id: "a1", name: "海报", path: "项目 / 海报", depth: 1, childCount: 0 },
  ];

  assert.deepEqual(
    Core.getVisibleFolders(folders, new Set(["a"]), "海报").map((folder) => folder.id),
    ["a1"],
  );
});

test("calculateWindowLayout keeps one shared width across manager transitions", () => {
  const opened = Core.calculateWindowLayout({
    expanded: true,
    currentWidth: 1040,
    currentHeight: 92,
    compactHeight: 58,
  });
  const closed = Core.calculateWindowLayout({
    expanded: false,
    currentWidth: 1180,
    currentHeight: 720,
    compactHeight: opened.compactHeight,
  });

  assert.deepEqual(opened, { width: 1040, height: 610, compactHeight: 92 });
  assert.deepEqual(closed, { width: 1180, height: 92, compactHeight: 92 });
});

test("sendOpenAllToHost targets Eagle's parent renderer navigation channel", () => {
  const calls = [];
  const ipcRenderer = {
    sendTo(...args) {
      calls.push(args);
    },
  };

  assert.equal(Core.sendOpenAllToHost(ipcRenderer, 17), true);
  assert.deepEqual(calls, [[17, "show-and-search"]]);
  assert.equal(Core.sendOpenAllToHost(ipcRenderer, Number.NaN), false);
  assert.equal(Core.sendOpenAllToHost({}, 17), false);
});

test("shouldStartWindowDrag accepts rail whitespace but preserves controls and resize edges", () => {
  assert.equal(
    Core.shouldStartWindowDrag({
      button: 0,
      interactive: false,
      clientX: 92,
      clientY: 24,
      viewportWidth: 760,
      viewportHeight: 58,
    }),
    true,
  );
  assert.equal(
    Core.shouldStartWindowDrag({
      button: 0,
      interactive: true,
      clientX: 92,
      clientY: 24,
      viewportWidth: 760,
      viewportHeight: 58,
    }),
    false,
  );
  assert.equal(
    Core.shouldStartWindowDrag({
      button: 0,
      interactive: false,
      clientX: 2,
      clientY: 24,
      viewportWidth: 760,
      viewportHeight: 58,
    }),
    false,
  );
});

test("normalizeRememberedWindowSize validates and clamps persisted dimensions", () => {
  assert.deepEqual(Core.normalizeRememberedWindowSize({ width: 1040.4, height: 92.6 }), {
    width: 1040,
    height: 93,
  });
  assert.deepEqual(Core.normalizeRememberedWindowSize({ width: 300, height: 20 }), {
    width: 620,
    height: 58,
  });
  assert.equal(Core.normalizeRememberedWindowSize({ width: "1040", height: 92 }), null);
  assert.equal(Core.normalizeRememberedWindowSize(null), null);
});

test("normalizeRememberedWindowPosition preserves negative multi-monitor coordinates", () => {
  assert.deepEqual(Core.normalizeRememberedWindowPosition({ x: -1280.4, y: 214.6 }), {
    x: -1280,
    y: 215,
  });
  assert.deepEqual(
    Core.normalizeRememberedWindowPosition(
      { x: -999999, y: 999999 },
      { minCoordinate: -50000, maxCoordinate: 50000 },
    ),
    { x: -50000, y: 50000 },
  );
  assert.equal(Core.normalizeRememberedWindowPosition({ x: "40", y: 80 }), null);
  assert.equal(Core.normalizeRememberedWindowPosition(null), null);
});

test("dock retry delay backs off without giving up the saved preference", () => {
  assert.equal(Core.dockRetryDelay(0), 1000);
  assert.equal(Core.dockRetryDelay(1), 2000);
  assert.equal(Core.dockRetryDelay(2), 4000);
  assert.equal(Core.dockRetryDelay(3), 8000);
  assert.equal(Core.dockRetryDelay(4), 15000);
  assert.equal(Core.dockRetryDelay(20), 30000);
});

test("rememberWindowSize shares width across modes and keeps one compact height", () => {
  const compact = Core.rememberWindowSize(null, { width: 980, height: 84 }, false);
  const expanded = Core.rememberWindowSize(compact, { width: 1120, height: 730 }, true);
  const compactAgain = Core.rememberWindowSize(expanded, { width: 1060, height: 96 }, false);

  assert.deepEqual(compact, { width: 980, height: 84 });
  assert.deepEqual(expanded, { width: 1120, height: 84 });
  assert.deepEqual(compactAgain, { width: 1060, height: 96 });
});

test("nativeWindowHandleToDecimal decodes Electron's little-endian HWND buffer", () => {
  assert.equal(Core.nativeWindowHandleToDecimal(Buffer.from([0x78, 0x56, 0x34, 0x12])), "305419896");
  assert.equal(
    Core.nativeWindowHandleToDecimal({ type: "Buffer", data: [0xef, 0xcd, 0xab, 0x00] }),
    "11259375",
  );
  assert.equal(Core.nativeWindowHandleToDecimal(Buffer.alloc(8)), null);
  assert.equal(Core.nativeWindowHandleToDecimal(null), null);
});

test("plugin lifecycle gate ignores show events before create and serializes initialization", async () => {
  let initializationCount = 0;
  const calls = [];
  const gate = Core.createPluginLifecycleGate(async () => {
    initializationCount += 1;
    calls.push("initialize");
  });

  const earlyResult = await gate.whenReady(() => {
    calls.push("early-show");
  });
  assert.equal(earlyResult, false);
  assert.deepEqual(calls, []);

  gate.markCreated();
  await Promise.all([
    gate.whenReady(() => calls.push("plugin-run")),
    gate.whenReady(() => calls.push("plugin-show")),
  ]);

  assert.equal(initializationCount, 1);
  assert.deepEqual(calls, ["initialize", "plugin-run", "plugin-show"]);
});

test("folder usage is aggregated across day, week, and month windows", () => {
  const hour = 60 * 60 * 1000;
  const now = Date.UTC(2026, 6, 29, 12, 0, 0);
  const events = [
    { id: "a", at: now - hour, source: "quickrail" },
    { id: "a", at: now - 4 * hour, source: "eagle" },
    { id: "b", at: now - 2 * hour, source: "eagle" },
    { id: "c", at: now - 2 * 24 * hour, source: "eagle" },
    { id: "a", at: now - 8 * 24 * hour, source: "quickrail" },
    { id: "b", at: now - 29 * 24 * hour, source: "eagle" },
    { id: "expired", at: now - 31 * 24 * hour, source: "eagle" },
  ];

  assert.deepEqual(Object.fromEntries(Core.countFolderUsage(events, "day", now)), {
    a: 2,
    b: 1,
  });
  assert.deepEqual(Object.fromEntries(Core.countFolderUsage(events, "week", now)), {
    a: 2,
    b: 1,
    c: 1,
  });
  assert.deepEqual(Object.fromEntries(Core.countFolderUsage(events, "month", now)), {
    a: 3,
    b: 2,
    c: 1,
  });
});

test("usage history normalization removes malformed and expired events", () => {
  const now = Date.UTC(2026, 6, 29, 12, 0, 0);
  const normalized = Core.normalizeUsageEvents(
    [
      { id: "a", at: now - 1000, source: "eagle" },
      { id: "b", at: now - 2000, source: "unknown" },
      { id: "", at: now - 3000, source: "eagle" },
      { id: "old", at: now - 31 * 24 * 60 * 60 * 1000, source: "quickrail" },
      { id: "future", at: now + 2 * 60 * 1000, source: "eagle" },
    ],
    { now },
  );

  assert.deepEqual(normalized, [
    { id: "b", at: now - 2000, source: "eagle" },
    { id: "a", at: now - 1000, source: "eagle" },
  ]);
});

test("sortPinnedByUsage sorts descending and preserves manual order for ties", () => {
  const counts = new Map([
    ["a", 2],
    ["b", 7],
    ["c", 2],
  ]);

  assert.deepEqual(
    Core.sortPinnedByUsage([Core.ALL_ID, "a", "b", "c"], counts),
    ["b", "a", "c", Core.ALL_ID],
  );
});

test("folder observation ignores startup state and records later Eagle selection changes", () => {
  const initial = Core.observeFolderSelection(null, "a", false);
  const unchanged = Core.observeFolderSelection(initial.lastId, "a", initial.observed);
  const changed = Core.observeFolderSelection(unchanged.lastId, "b", unchanged.observed);
  const cleared = Core.observeFolderSelection(changed.lastId, null, changed.observed);

  assert.deepEqual(initial, { observed: true, lastId: "a", recordId: null });
  assert.deepEqual(unchanged, { observed: true, lastId: "a", recordId: null });
  assert.deepEqual(changed, { observed: true, lastId: "b", recordId: "b" });
  assert.deepEqual(cleared, { observed: true, lastId: null, recordId: null });
});

test("usage candidate clicks append in click order and clicking again cancels selection", () => {
  let selected = [];
  selected = Core.togglePinned(selected, "b");
  selected = Core.togglePinned(selected, "a");
  selected = Core.togglePinned(selected, "c");
  assert.deepEqual(selected, ["b", "a", "c"]);

  selected = Core.togglePinned(selected, "a");
  assert.deepEqual(selected, ["b", "c"]);

  selected = Core.togglePinned(selected, "a");
  assert.deepEqual(selected, ["b", "c", "a"]);
});
