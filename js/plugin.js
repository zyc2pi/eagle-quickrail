(function initializeQuickRail() {
  "use strict";

  const Core = window.QuickRailCore;
  const COMPACT_WIDTH = 760;
  const COMPACT_HEIGHT = 58;
  const EXPANDED_HEIGHT = 610;
  const SYNC_INTERVAL = 2000;
  const ACTIVE_INTERVAL = 650;
  const POSITION_SAVE_INTERVAL = 750;
  const USAGE_REFRESH_INTERVAL = 30000;
  const STORAGE = {
    pins: "quickrail:pins:",
    pinColors: "quickrail:pin-colors:",
    pinWidths: "quickrail:pin-widths:",
    collapsed: "quickrail:collapsed:",
    linkedDocked: "quickrail:linked-docked",
    topmost: "quickrail:topmost",
    onboarding: "quickrail:onboarding-complete",
    usage: "quickrail:usage:",
    usagePeriod: "quickrail:usage-period",
    windowPosition: "quickrail:window-position",
    windowSize: "quickrail:window-size",
  };
  const USAGE_PERIOD_LABELS = {
    day: "最近 24 小时",
    week: "最近 7 天",
    month: "最近 30 天",
  };
  const COLORS = {
    red: "#e26357",
    orange: "#ed8a3a",
    yellow: "#d8ad2f",
    green: "#65a85f",
    aqua: "#45aaa0",
    blue: "#4d86d9",
    purple: "#936ccc",
    pink: "#d96fa0",
  };
  const ICONS = {
    folder:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7h6l1.8 2h9.2v9H3.5z"/></svg>',
    all:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-9"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>',
    chevron:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>',
  };

  const elements = {
    appShell: document.querySelector("#appShell"),
    clearButton: document.querySelector("#clearButton"),
    clearUsageSelectionButton: document.querySelector("#clearUsageSelectionButton"),
    collapseAllButton: document.querySelector("#collapseAllButton"),
    dockButton: document.querySelector("#dockButton"),
    doneButton: document.querySelector("#doneButton"),
    emptyState: document.querySelector("#emptyState"),
    expandAllButton: document.querySelector("#expandAllButton"),
    folderCount: document.querySelector("#folderCount"),
    folderList: document.querySelector("#folderList"),
    hideButton: document.querySelector("#hideButton"),
    libraryName: document.querySelector("#libraryName"),
    manageButton: document.querySelector("#manageButton"),
    managerPanel: document.querySelector("#managerPanel"),
    orderTabButton: document.querySelector("#orderTabButton"),
    orderView: document.querySelector("#orderView"),
    pinContextActions: document.querySelector("#pinContextActions"),
    pinContextAdjustLengthButton: document.querySelector("#pinContextAdjustLengthButton"),
    pinContextCancelRemoveButton: document.querySelector("#pinContextCancelRemoveButton"),
    pinContextCloseButton: document.querySelector("#pinContextCloseButton"),
    pinContextConfirm: document.querySelector("#pinContextConfirm"),
    pinContextConfirmRemoveButton: document.querySelector("#pinContextConfirmRemoveButton"),
    pinContextIcon: document.querySelector("#pinContextIcon"),
    pinContextName: document.querySelector("#pinContextName"),
    pinContextPalette: document.querySelector("#pinContextPalette"),
    pinContextRemoveButton: document.querySelector("#pinContextRemoveButton"),
    pinContextResetLengthButton: document.querySelector("#pinContextResetLengthButton"),
    pinContextResetColor: document.querySelector("#pinContextResetColor"),
    pinContextStrip: document.querySelector("#pinContextStrip"),
    pinLengthActions: document.querySelector("#pinLengthActions"),
    pinLengthCancelButton: document.querySelector("#pinLengthCancelButton"),
    pinLengthConfirmButton: document.querySelector("#pinLengthConfirmButton"),
    pinLengthValue: document.querySelector("#pinLengthValue"),
    pinnedCount: document.querySelector("#pinnedCount"),
    pinnedList: document.querySelector("#pinnedList"),
    rail: document.querySelector("#rail"),
    saveState: document.querySelector("#saveState"),
    scrollLeftButton: document.querySelector("#scrollLeftButton"),
    scrollRightButton: document.querySelector("#scrollRightButton"),
    searchInput: document.querySelector("#searchInput"),
    selectAllUsageButton: document.querySelector("#selectAllUsageButton"),
    selectedList: document.querySelector("#selectedList"),
    syncLabel: document.querySelector("#syncLabel"),
    toast: document.querySelector("#toast"),
    topmostButton: document.querySelector("#topmostButton"),
    usageList: document.querySelector("#usageList"),
    usagePeriodButtons: Array.from(document.querySelectorAll("[data-usage-period]")),
    usageRangeLabel: document.querySelector("#usageRangeLabel"),
    usageSelectedCount: document.querySelector("#usageSelectedCount"),
    usageSummary: document.querySelector("#usageSummary"),
    usageTabButton: document.querySelector("#usageTabButton"),
    usageView: document.querySelector("#usageView"),
  };

  const state = {
    activeId: null,
    collapsedIds: new Set(),
    compactHeight: COMPACT_HEIGHT,
    currentLibraryKey: "default",
    docked: false,
    dockHelper: null,
    dockRetryAttempts: 0,
    dockRetryTimer: null,
    dockRestoreRequested: readBoolean(STORAGE.linkedDocked, false),
    dockStarting: false,
    expanded: false,
    folderMap: new Map(),
    folderSignature: "",
    folders: [],
    hasObservedFolder: false,
    initialized: false,
    lastAllClickAt: 0,
    lastObservedFolderId: null,
    libraryName: "当前资源库",
    lifecycleErrorReported: false,
    manualHidden: false,
    managerSideMode: "order",
    pinColors: {},
    pinContextId: null,
    pinContextRemovePending: false,
    pinLengthEdit: null,
    pinWidths: {},
    pinnedIds: [Core.ALL_ID],
    positionSaveInFlight: false,
    rememberedPosition: readWindowPosition(),
    rememberedSize: readWindowSize(),
    rendererIpc: undefined,
    resizeQueue: Promise.resolve(),
    sizeSaveTimer: null,
    syncInFlight: false,
    timers: [],
    toastTimer: null,
    topmost: readBoolean(STORAGE.topmost, false),
    usageEvents: [],
    usagePeriod: readUsagePeriod(),
    windowDrag: null,
    windowMoveInFlight: false,
    windowMovePending: null,
  };
  state.compactHeight = state.rememberedSize
    ? state.rememberedSize.height
    : COMPACT_HEIGHT;
  const lifecycleGate = Core.createPluginLifecycleGate(initializePlugin);

  function readBoolean(key, fallback) {
    const value = localStorage.getItem(key);
    if (value === null) {
      return fallback;
    }
    return value === "true";
  }

  function readUsagePeriod() {
    const value = localStorage.getItem(STORAGE.usagePeriod);
    return Object.hasOwn(USAGE_PERIOD_LABELS, value) ? value : "month";
  }

  function persistBoolean(key, value) {
    localStorage.setItem(key, String(Boolean(value)));
  }

  function readWindowSize() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE.windowSize) || "null");
      return Core.normalizeRememberedWindowSize(raw);
    } catch (_error) {
      return null;
    }
  }

  function readWindowPosition() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE.windowPosition) || "null");
      return Core.normalizeRememberedWindowPosition(raw);
    } catch (_error) {
      return null;
    }
  }

  function saveWindowPosition(position) {
    const normalized = Core.normalizeRememberedWindowPosition(position);
    if (!normalized) {
      return false;
    }

    if (
      state.rememberedPosition &&
      state.rememberedPosition.x === normalized.x &&
      state.rememberedPosition.y === normalized.y
    ) {
      return false;
    }

    state.rememberedPosition = normalized;
    localStorage.setItem(STORAGE.windowPosition, JSON.stringify(normalized));
    return true;
  }

  async function persistCurrentWindowPosition() {
    if (state.positionSaveInFlight || !window.eagle || !window.eagle.window) {
      return false;
    }

    state.positionSaveInFlight = true;
    try {
      const position = await window.eagle.window.getPosition();
      if (!Array.isArray(position)) {
        return false;
      }
      return saveWindowPosition({ x: position[0], y: position[1] });
    } catch (_error) {
      // The plugin window may stop answering while Eagle is shutting down.
      return false;
    } finally {
      state.positionSaveInFlight = false;
    }
  }

  async function restoreRememberedWindowPosition() {
    const position = state.rememberedPosition;
    if (!position) {
      return false;
    }

    try {
      await window.eagle.window.setPosition(position.x, position.y);
      return true;
    } catch (error) {
      console.warn("[QuickRail] restore window position failed", error);
      return false;
    }
  }

  function saveWindowSize(size) {
    const normalized = Core.normalizeRememberedWindowSize(size);
    if (!normalized) {
      return;
    }

    state.rememberedSize = normalized;
    state.compactHeight = normalized.height;
    localStorage.setItem(STORAGE.windowSize, JSON.stringify(normalized));
  }

  async function persistCurrentWindowSize() {
    try {
      const size = await window.eagle.window.getSize();
      if (!Array.isArray(size)) {
        return;
      }

      const remembered = Core.rememberWindowSize(
        state.rememberedSize,
        { width: size[0], height: size[1] },
        state.expanded,
      );
      saveWindowSize(remembered);
    } catch (_error) {
      // A closing plugin window may no longer answer size requests.
    }
  }

  function scheduleWindowSizeSave() {
    window.clearTimeout(state.sizeSaveTimer);
    state.sizeSaveTimer = window.setTimeout(persistCurrentWindowSize, 180);
  }

  function storageKey() {
    return `${STORAGE.pins}${state.currentLibraryKey}`;
  }

  function collapsedStorageKey() {
    return `${STORAGE.collapsed}${state.currentLibraryKey}`;
  }

  function pinColorsStorageKey() {
    return `${STORAGE.pinColors}${state.currentLibraryKey}`;
  }

  function pinWidthsStorageKey() {
    return `${STORAGE.pinWidths}${state.currentLibraryKey}`;
  }

  function usageStorageKey() {
    return `${STORAGE.usage}${state.currentLibraryKey}`;
  }

  function loadPinned() {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey()) || "null");
      state.pinnedIds = Array.isArray(raw) ? raw : [Core.ALL_ID];
    } catch (_error) {
      state.pinnedIds = [Core.ALL_ID];
    }
  }

  function savePinned() {
    localStorage.setItem(storageKey(), JSON.stringify(state.pinnedIds));
    elements.saveState.textContent = "已保存";
    window.setTimeout(() => {
      elements.saveState.textContent = "更改自动保存";
    }, 850);
  }

  function loadPinColors() {
    try {
      const raw = JSON.parse(localStorage.getItem(pinColorsStorageKey()) || "{}");
      state.pinColors = Core.normalizePinColors(raw);
    } catch (_error) {
      state.pinColors = {};
    }
  }

  function savePinColors() {
    state.pinColors = Core.normalizePinColors(state.pinColors);
    localStorage.setItem(pinColorsStorageKey(), JSON.stringify(state.pinColors));
  }

  function loadPinWidths() {
    try {
      const raw = JSON.parse(localStorage.getItem(pinWidthsStorageKey()) || "{}");
      state.pinWidths = Core.normalizePinWidths(raw);
    } catch (_error) {
      state.pinWidths = {};
    }
  }

  function savePinWidths() {
    state.pinWidths = Core.normalizePinWidths(state.pinWidths);
    localStorage.setItem(pinWidthsStorageKey(), JSON.stringify(state.pinWidths));
  }

  function loadCollapsed() {
    try {
      const raw = JSON.parse(localStorage.getItem(collapsedStorageKey()) || "[]");
      state.collapsedIds = new Set(Array.isArray(raw) ? raw.filter((id) => typeof id === "string") : []);
    } catch (_error) {
      state.collapsedIds = new Set();
    }
  }

  function saveCollapsed() {
    localStorage.setItem(collapsedStorageKey(), JSON.stringify(Array.from(state.collapsedIds)));
  }

  function loadUsage() {
    try {
      const raw = JSON.parse(localStorage.getItem(usageStorageKey()) || "[]");
      state.usageEvents = Core.normalizeUsageEvents(raw);
    } catch (_error) {
      state.usageEvents = [];
    }
  }

  function saveUsage() {
    state.usageEvents = Core.normalizeUsageEvents(state.usageEvents);
    localStorage.setItem(usageStorageKey(), JSON.stringify(state.usageEvents));
  }

  function currentUsageCounts() {
    return Core.countFolderUsage(state.usageEvents, state.usagePeriod);
  }

  function recordFolderUse(id, source) {
    if (
      typeof id !== "string" ||
      (id !== Core.ALL_ID && !state.folderMap.has(id))
    ) {
      return;
    }

    state.usageEvents.push({
      id,
      at: Date.now(),
      source: source === "quickrail" ? "quickrail" : "eagle",
    });
    saveUsage();

    if (state.expanded) {
      updateUsageBadges();
      renderUsage();
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function folderColor(folder) {
    if (!folder || !folder.iconColor) {
      return "#9ba390";
    }
    return COLORS[folder.iconColor] || "#9ba390";
  }

  function pinColor(id, item) {
    const override = state.pinColors[id];
    if (override && Object.hasOwn(COLORS, override)) {
      return COLORS[override];
    }
    return id === Core.ALL_ID ? "#c9f04d" : folderColor(item);
  }

  function itemForId(id) {
    if (id === Core.ALL_ID) {
      return {
        id: Core.ALL_ID,
        name: "全部",
        path: "当前资源库 / 全部文件",
        parentPath: "当前资源库",
        iconColor: "all",
      };
    }
    return state.folderMap.get(id);
  }

  function setSyncStatus(label, isSynced) {
    elements.syncLabel.textContent = label;
    elements.syncLabel.classList.toggle("synced", Boolean(isSynced));
  }

  function showToast(message, type) {
    window.clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle("error", type === "error");
    elements.toast.classList.add("show");
    state.toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove("show");
    }, 1900);
  }

  function closePinContext() {
    state.pinContextId = null;
    state.pinContextRemovePending = false;
    elements.pinContextStrip.hidden = true;
    elements.pinContextStrip.setAttribute("aria-hidden", "true");
  }

  function findPinnedButton(id) {
    return Array.from(elements.pinnedList.querySelectorAll(".pin-item[data-id]")).find(
      (button) => button.dataset.id === id,
    );
  }

  function renderPinLengthControls() {
    const edit = state.pinLengthEdit;
    const editing = Boolean(edit);
    elements.rail.classList.toggle("length-editing", editing);
    elements.pinnedList.classList.toggle("length-editing", editing);
    elements.pinLengthActions.hidden = !editing;
    elements.pinLengthActions.setAttribute("aria-hidden", String(!editing));
    if (edit) {
      elements.pinLengthValue.textContent = `${edit.previewWidth}px`;
    }
  }

  function applyPinLengthPreview(width) {
    const edit = state.pinLengthEdit;
    if (!edit) {
      return;
    }

    const normalized = Core.normalizePinWidth(width);
    if (normalized === null) {
      return;
    }

    edit.previewWidth = normalized;
    const button = findPinnedButton(edit.id);
    if (button) {
      const value = `${normalized}px`;
      button.style.width = value;
      button.style.maxWidth = value;
      button.style.flexBasis = value;
    }
    elements.pinLengthValue.textContent = `${normalized}px`;
    window.requestAnimationFrame(updateScrollNudges);
  }

  function bindPinLengthHandle(handle) {
    handle.addEventListener("pointerdown", (event) => {
      const edit = state.pinLengthEdit;
      if (!edit || event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      edit.dragging = true;
      edit.pointerId = event.pointerId;
      edit.startX = event.screenX;
      edit.startWidth = edit.previewWidth;
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener("pointermove", (event) => {
      const edit = state.pinLengthEdit;
      if (!edit || !edit.dragging || edit.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      applyPinLengthPreview(edit.startWidth + event.screenX - edit.startX);
    });

    const finishResize = (event) => {
      const edit = state.pinLengthEdit;
      if (!edit || edit.pointerId !== event.pointerId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      edit.dragging = false;
      edit.pointerId = null;
      if (handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
    };

    handle.addEventListener("pointerup", finishResize);
    handle.addEventListener("pointercancel", finishResize);
    handle.addEventListener("lostpointercapture", (event) => {
      const edit = state.pinLengthEdit;
      if (edit && edit.pointerId === event.pointerId) {
        edit.dragging = false;
        edit.pointerId = null;
      }
    });
  }

  function startPinLengthEdit() {
    const id = state.pinContextId;
    const button = id ? findPinnedButton(id) : null;
    if (!id || !button || !state.pinnedIds.includes(id)) {
      closePinContext();
      return;
    }

    const previewWidth = Core.normalizePinWidth(button.getBoundingClientRect().width);
    if (previewWidth === null) {
      return;
    }

    closePinContext();
    state.pinLengthEdit = {
      id,
      previewWidth,
      dragging: false,
      pointerId: null,
      startWidth: previewWidth,
      startX: 0,
    };
    renderPinned();
    renderPinLengthControls();
  }

  function confirmPinLengthEdit() {
    const edit = state.pinLengthEdit;
    if (!edit) {
      return;
    }

    state.pinWidths[edit.id] = edit.previewWidth;
    savePinWidths();
    state.pinLengthEdit = null;
    renderPinLengthControls();
    renderPinned();
    showToast("已保存卡片长度");
  }

  function cancelPinLengthEdit() {
    if (!state.pinLengthEdit) {
      return;
    }

    state.pinLengthEdit = null;
    renderPinLengthControls();
    renderPinned();
  }

  function resetPinLength() {
    const id = state.pinContextId;
    if (!id || !state.pinnedIds.includes(id)) {
      closePinContext();
      return;
    }

    delete state.pinWidths[id];
    savePinWidths();
    closePinContext();
    renderPinned();
    showToast("已恢复默认长度");
  }

  function renderPinContext() {
    const id = state.pinContextId;
    const item = id ? itemForId(id) : null;
    if (!id || !item || !state.pinnedIds.includes(id)) {
      closePinContext();
      return;
    }

    const isAll = id === Core.ALL_ID;
    const selectedColor = state.pinColors[id] || "";
    const displayColor = pinColor(id, item);
    elements.pinContextName.textContent = item.name;
    elements.pinContextName.title = item.path;
    elements.pinContextIcon.innerHTML = isAll ? ICONS.all : ICONS.folder;
    elements.pinContextIcon.style.setProperty("--context-color", displayColor);
    elements.pinContextPalette.querySelectorAll("[data-pin-color]").forEach((button) => {
      const selected = button.dataset.pinColor === selectedColor;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    elements.pinContextResetLengthButton.disabled = !Object.hasOwn(state.pinWidths, id);
    elements.pinContextActions.hidden = state.pinContextRemovePending;
    elements.pinContextConfirm.hidden = !state.pinContextRemovePending;
    elements.pinContextStrip.hidden = false;
    elements.pinContextStrip.setAttribute("aria-hidden", "false");
  }

  function openPinContext(id) {
    if (state.pinLengthEdit || !state.pinnedIds.includes(id) || !itemForId(id)) {
      return;
    }
    state.pinContextId = id;
    state.pinContextRemovePending = false;
    renderPinContext();
  }

  function setPinColor(color) {
    const id = state.pinContextId;
    if (!id || !state.pinnedIds.includes(id)) {
      closePinContext();
      return;
    }

    if (color && Object.hasOwn(COLORS, color)) {
      state.pinColors[id] = color;
    } else {
      delete state.pinColors[id];
    }
    savePinColors();
    renderPinned();
    renderPinContext();
  }

  function requestPinRemoval() {
    if (!state.pinContextId) {
      return;
    }
    state.pinContextRemovePending = true;
    renderPinContext();
    elements.pinContextConfirmRemoveButton.focus();
  }

  function confirmPinRemoval() {
    const id = state.pinContextId;
    if (!id || !state.pinnedIds.includes(id)) {
      closePinContext();
      return;
    }

    state.pinnedIds = state.pinnedIds.filter((pinnedId) => pinnedId !== id);
    delete state.pinColors[id];
    delete state.pinWidths[id];
    savePinned();
    savePinColors();
    savePinWidths();
    closePinContext();
    renderAll();
  }

  function renderPinned() {
    if (
      state.pinContextId &&
      (!state.pinnedIds.includes(state.pinContextId) || !itemForId(state.pinContextId))
    ) {
      closePinContext();
    }
    elements.pinnedList.replaceChildren();
    const editingId = state.pinLengthEdit && state.pinLengthEdit.id;
    const labels = Core.buildDistinctFolderLabels(
      state.pinnedIds.map((id) => itemForId(id)).filter(Boolean),
    );

    if (state.pinnedIds.length === 0) {
      const emptyButton = document.createElement("button");
      emptyButton.className = "pin-empty";
      emptyButton.type = "button";
      emptyButton.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>选择常用文件夹</span>';
      emptyButton.addEventListener("click", () => setManagerOpen(true));
      elements.pinnedList.append(emptyButton);
      updateScrollNudges();
      return;
    }

    state.pinnedIds.forEach((id, index) => {
      const item = itemForId(id);
      if (!item) {
        return;
      }

      const button = document.createElement("button");
      const isAll = id === Core.ALL_ID;
      const label = labels.get(id) || { primary: item.name, context: "" };
      const editing = editingId === id;
      const customWidth = editing ? state.pinLengthEdit.previewWidth : state.pinWidths[id];
      button.className = "pin-item";
      button.type = "button";
      button.draggable = !state.pinLengthEdit;
      button.dataset.id = id;
      button.title = state.pinLengthEdit
        ? editing
          ? "拖动右侧边缘调节长度"
          : item.path
        : `${item.path}\n右键设置颜色、长度或从快捷轨移除`;
      button.setAttribute(
        "aria-label",
        `打开 ${label.context ? `${label.context} / ` : ""}${label.primary}`,
      );
      button.classList.toggle("active", state.activeId === id);
      button.classList.toggle("disambiguated", Boolean(label.context));
      button.classList.toggle("custom-length", Number.isFinite(customWidth));
      button.classList.toggle("length-target", editing);
      button.style.setProperty("--folder-color", pinColor(id, item));
      if (Number.isFinite(customWidth)) {
        const width = `${customWidth}px`;
        button.style.width = width;
        button.style.maxWidth = width;
        button.style.flexBasis = width;
      }
      button.innerHTML = `
        <span class="pin-icon ${isAll ? "all" : ""}">${isAll ? ICONS.all : ICONS.folder}</span>
        <span class="pin-copy">
          <span class="pin-name">${escapeHtml(label.primary)}</span>
          ${label.context ? `<small class="pin-parent">${escapeHtml(label.context)}</small>` : ""}
        </span>
        ${index < 9 ? `<span class="shortcut-index">${index + 1}</span>` : ""}
        ${editing ? '<span class="pin-length-handle" aria-hidden="true"></span>' : ""}
      `;

      button.addEventListener("click", () => {
        if (!state.pinLengthEdit) {
          openItem(id);
        }
      });
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!state.pinLengthEdit) {
          openPinContext(id);
        }
      });
      if (editing) {
        bindPinLengthHandle(button.querySelector(".pin-length-handle"));
      } else if (!state.pinLengthEdit) {
        bindDragHandlers(button);
      }
      elements.pinnedList.append(button);
    });

    renderPinLengthControls();
    window.requestAnimationFrame(updateScrollNudges);
  }

  function renderFolderList() {
    const query = elements.searchInput.value.trim();
    const visibleFolders = Core.getVisibleFolders(state.folders, state.collapsedIds, query);
    const fragment = document.createDocumentFragment();
    const allMatches = !query || "全部 当前资源库 全部文件".includes(query.toLocaleLowerCase());
    const usageCounts = currentUsageCounts();

    if (allMatches) {
      fragment.append(
        createFolderRow(itemForId(Core.ALL_ID), true, Boolean(query), usageCounts),
      );
    }

    visibleFolders.forEach((folder) => {
      fragment.append(createFolderRow(folder, false, Boolean(query), usageCounts));
    });

    elements.folderList.replaceChildren(fragment);
    elements.emptyState.hidden = allMatches || visibleFolders.length > 0;
    elements.folderCount.textContent = query
      ? `${visibleFolders.length} 个匹配结果`
      : `${state.folders.length} 个文件夹 · 当前显示 ${visibleFolders.length} 个`;
  }

  function createFolderRow(folder, isAll, isSearching, usageCounts) {
    const selected = state.pinnedIds.includes(folder.id);
    const hasChildren = !isAll && folder.childCount > 0;
    const collapsed = hasChildren && state.collapsedIds.has(folder.id);
    const usageCount = usageCounts.get(folder.id) || 0;
    const row = document.createElement("div");
    row.className = `folder-row${selected ? " selected" : ""}${isAll ? " all-row" : ""}`;
    row.dataset.id = folder.id;
    row.style.setProperty("--depth", String(isAll ? 0 : Math.min(folder.depth, 8)));
    row.style.setProperty("--folder-color", isAll ? "#6d8b16" : folderColor(folder));
    row.setAttribute("role", "treeitem");
    row.setAttribute("aria-selected", String(selected));
    row.setAttribute("aria-level", String(isAll ? 1 : folder.depth + 1));
    if (hasChildren) {
      row.setAttribute("aria-expanded", String(!collapsed));
    }
    row.tabIndex = 0;

    const parentCopy = isAll
      ? "所有资源的总入口"
      : folder.parentPath || "顶层文件夹";

    row.innerHTML = `
      ${
        hasChildren
          ? `<button class="tree-toggle${collapsed ? " collapsed" : ""}" type="button" title="${
              collapsed ? "展开" : "收起"
            } ${escapeHtml(folder.name)}" aria-label="${collapsed ? "展开" : "收起"} ${escapeHtml(
              folder.name,
            )}" ${isSearching ? 'data-searching="true"' : ""}>${ICONS.chevron}</button>`
          : '<span class="tree-spacer" aria-hidden="true"></span>'
      }
      <span class="folder-checkbox">${ICONS.check}</span>
      <span class="folder-glyph">${isAll ? ICONS.all : ICONS.folder}</span>
      <span class="folder-copy">
        <strong>${escapeHtml(folder.name)}</strong>
        <small>${escapeHtml(parentCopy)}</small>
      </span>
      <span
        class="folder-usage${usageCount ? "" : " zero"}"
        title="${escapeHtml(USAGE_PERIOD_LABELS[state.usagePeriod])}使用 ${usageCount} 次"
      >${usageCount ? `${usageCount}次` : "—"}</span>
      <span class="folder-level">${isAll ? "ROOT" : `L${folder.depth + 1}`}</span>
    `;

    if (hasChildren) {
      row.querySelector(".tree-toggle").addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (state.collapsedIds.has(folder.id)) {
          state.collapsedIds.delete(folder.id);
        } else {
          state.collapsedIds.add(folder.id);
        }
        saveCollapsed();
        renderFolderList();
      });
    }

    const toggle = () => toggleItem(folder.id);
    row.addEventListener("click", toggle);
    row.addEventListener("keydown", (event) => {
      if (event.target === row && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        toggle();
      }
    });
    return row;
  }

  function renderSelected() {
    const fragment = document.createDocumentFragment();
    const usageCounts = currentUsageCounts();

    state.pinnedIds.forEach((id) => {
      const item = itemForId(id);
      if (!item) {
        return;
      }

      const isAll = id === Core.ALL_ID;
      const usageCount = usageCounts.get(id) || 0;
      const row = document.createElement("div");
      row.className = "selected-item";
      row.draggable = true;
      row.dataset.id = id;
      row.style.setProperty("--folder-color", isAll ? "#6d8b16" : folderColor(item));
      row.innerHTML = `
        <span class="drag-handle" aria-hidden="true">⠿</span>
        <span class="folder-glyph">${isAll ? ICONS.all : ICONS.folder}</span>
        <span class="selected-name">
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.parentPath || "当前资源库")}</small>
        </span>
        <span
          class="selected-usage${usageCount ? "" : " zero"}"
          title="${escapeHtml(USAGE_PERIOD_LABELS[state.usagePeriod])}使用 ${usageCount} 次"
        >${usageCount ? `${usageCount}次` : "—"}</span>
        <button class="remove-button" type="button" title="移除 ${escapeHtml(item.name)}" aria-label="移除 ${escapeHtml(item.name)}">
          ${ICONS.close}
        </button>
      `;
      row.querySelector(".remove-button").addEventListener("click", (event) => {
        event.stopPropagation();
        toggleItem(id);
      });
      bindDragHandlers(row);
      fragment.append(row);
    });

    elements.selectedList.replaceChildren(fragment);
    elements.pinnedCount.textContent = String(state.pinnedIds.length);
  }

  function updateUsageBadges() {
    const usageCounts = currentUsageCounts();
    const label = USAGE_PERIOD_LABELS[state.usagePeriod];

    elements.folderList.querySelectorAll(".folder-row[data-id]").forEach((row) => {
      const badge = row.querySelector(".folder-usage");
      if (!badge) {
        return;
      }
      const count = usageCounts.get(row.dataset.id) || 0;
      badge.textContent = count ? `${count}次` : "—";
      badge.classList.toggle("zero", count === 0);
      badge.title = `${label}使用 ${count} 次`;
    });

    elements.selectedList.querySelectorAll(".selected-item[data-id]").forEach((row) => {
      const badge = row.querySelector(".selected-usage");
      if (!badge) {
        return;
      }
      const count = usageCounts.get(row.dataset.id) || 0;
      badge.textContent = count ? `${count}次` : "—";
      badge.classList.toggle("zero", count === 0);
      badge.title = `${label}使用 ${count} 次`;
    });
  }

  function renderUsage() {
    const usageCounts = currentUsageCounts();
    const itemIds = [Core.ALL_ID, ...state.folders.map((folder) => folder.id)];
    const rankedIds = Core.sortPinnedByUsage(itemIds, usageCounts);
    const validCounts = itemIds.map((id) => usageCounts.get(id) || 0);
    const totalUses = validCounts.reduce((total, count) => total + count, 0);
    const activeFolderCount = validCounts.filter((count) => count > 0).length;
    const maxCount = rankedIds.length ? usageCounts.get(rankedIds[0]) || 1 : 1;

    elements.usageSummary.textContent = `${totalUses} 次 · ${activeFolderCount} 个文件夹`;
    elements.usageSelectedCount.textContent = String(state.pinnedIds.length);
    elements.usageRangeLabel.textContent =
      `${USAGE_PERIOD_LABELS[state.usagePeriod]}的文件夹切换`;
    elements.usagePeriodButtons.forEach((button) => {
      const active = button.dataset.usagePeriod === state.usagePeriod;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    if (rankedIds.length === 0) {
      elements.usageList.innerHTML = `
        <div class="usage-empty">
          <div>
            <strong>这个时间段还没有记录</strong>
            <small>打开文件夹后，这里会显示快捷轨与 Eagle 原生目录切换的合计次数。</small>
          </div>
        </div>
      `;
    } else {
      const fragment = document.createDocumentFragment();
      rankedIds.forEach((id, index) => {
        const item = itemForId(id);
        if (!item) {
          return;
        }

        const isAll = id === Core.ALL_ID;
        const count = usageCounts.get(id) || 0;
        const selectionIndex = state.pinnedIds.indexOf(id);
        const selected = selectionIndex >= 0;
        const row = document.createElement("button");
        row.className = `usage-row${selected ? " selected" : ""}${count ? "" : " zero-use"}`;
        row.type = "button";
        row.dataset.id = id;
        row.setAttribute("aria-pressed", String(selected));
        row.setAttribute(
          "aria-label",
          `${selected ? "从快捷轨移除" : "加入快捷轨"} ${item.name}`,
        );
        row.style.setProperty(
          "--usage-strength",
          count ? `${Math.max(8, (count / maxCount) * 100)}%` : "0%",
        );
        row.style.setProperty("--folder-color", isAll ? "#6d8b16" : folderColor(item));
        row.innerHTML = `
          <span class="usage-select-mark">${selected ? selectionIndex + 1 : "+"}</span>
          <span class="folder-glyph">${isAll ? ICONS.all : ICONS.folder}</span>
          <span class="usage-copy">
            <strong>${escapeHtml(item.name)}</strong>
            <small>#${String(index + 1).padStart(2, "0")} · ${escapeHtml(
              item.parentPath || "当前资源库",
            )}</small>
          </span>
          <span class="usage-count">${count}<small>次</small></span>
        `;
        row.addEventListener("click", () => toggleUsageCandidate(id));
        fragment.append(row);
      });
      elements.usageList.replaceChildren(fragment);
    }

    elements.selectAllUsageButton.disabled =
      rankedIds.length > 0 &&
      rankedIds.every((id, index) => state.pinnedIds[index] === id) &&
      state.pinnedIds.length === rankedIds.length;
    elements.clearUsageSelectionButton.disabled = state.pinnedIds.length === 0;
  }

  function renderAfterUsageSelection() {
    const usageScrollTop = elements.usageList.scrollTop;
    renderPinned();
    renderFolderList();
    renderSelected();
    renderUsage();
    elements.usageList.scrollTop = usageScrollTop;
  }

  function toggleUsageCandidate(id) {
    state.pinnedIds = Core.togglePinned(state.pinnedIds, id);
    savePinned();
    renderAfterUsageSelection();
  }

  function setManagerSideMode(mode) {
    state.managerSideMode = mode === "usage" ? "usage" : "order";
    const usageOpen = state.managerSideMode === "usage";
    elements.orderView.hidden = usageOpen;
    elements.usageView.hidden = !usageOpen;
    elements.orderTabButton.classList.toggle("active", !usageOpen);
    elements.usageTabButton.classList.toggle("active", usageOpen);
    elements.orderTabButton.setAttribute("aria-selected", String(!usageOpen));
    elements.usageTabButton.setAttribute("aria-selected", String(usageOpen));
    if (usageOpen) {
      renderUsage();
    }
  }

  function renderAll() {
    renderPinned();
    renderFolderList();
    renderSelected();
    renderUsage();
    updateControlStates();
  }

  function toggleItem(id) {
    state.pinnedIds = Core.togglePinned(state.pinnedIds, id);
    savePinned();
    renderAll();
  }

  function bindDragHandlers(element) {
    element.addEventListener("dragstart", (event) => {
      element.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", element.dataset.id);
    });
    element.addEventListener("dragend", () => {
      element.classList.remove("dragging");
      document.querySelectorAll(".drag-over").forEach((node) => node.classList.remove("drag-over"));
    });
    element.addEventListener("dragover", (event) => {
      event.preventDefault();
      element.classList.add("drag-over");
      event.dataTransfer.dropEffect = "move";
    });
    element.addEventListener("dragleave", () => element.classList.remove("drag-over"));
    element.addEventListener("drop", (event) => {
      event.preventDefault();
      element.classList.remove("drag-over");
      const draggedId = event.dataTransfer.getData("text/plain");
      const targetId = element.dataset.id;
      const next = Core.movePinned(state.pinnedIds, draggedId, targetId);

      if (next.join("\u0000") !== state.pinnedIds.join("\u0000")) {
        state.pinnedIds = next;
        savePinned();
        renderAll();
      }
    });
  }

  async function openItem(id) {
    const item = itemForId(id);
    if (!item) {
      showToast("这个文件夹已经不存在", "error");
      await refreshLibrary(true);
      return;
    }

    try {
      if (id === Core.ALL_ID) {
        const opened = await openAllView();
        if (!opened) {
          throw new Error("无法定位 Eagle 的“全部”入口");
        }
        state.lastAllClickAt = Date.now();
      } else {
        const opened = await window.eagle.folder.open(id);
        if (opened === false) {
          throw new Error("文件夹不存在或暂时不可用");
        }
      }

      recordFolderUse(id, "quickrail");
      state.hasObservedFolder = true;
      state.lastObservedFolderId = id;
      state.activeId = id;
      renderPinned();
      await revealEagle();
    } catch (error) {
      console.error("[QuickRail] open failed", error);
      showToast(error.message || "打开失败，请重试", "error");
    }
  }

  async function openAllView() {
    try {
      const ipcRenderer = getRendererIpc();
      const parentId = Number(window.parentID);
      return Core.sendOpenAllToHost(ipcRenderer, parentId);
    } catch (error) {
      console.error("[QuickRail] open all IPC navigation failed", error);
      return false;
    }
  }

  function getRendererIpc() {
    if (state.rendererIpc !== undefined) {
      return state.rendererIpc;
    }

    state.rendererIpc = null;
    try {
      if (typeof module !== "undefined" && module && typeof module.require === "function") {
        const electron = module.require("electron");
        if (electron && electron.ipcRenderer) {
          state.rendererIpc = electron.ipcRenderer;
        }
      }
    } catch (error) {
      console.warn("[QuickRail] renderer IPC unavailable", error);
    }

    return state.rendererIpc;
  }

  async function getPluginNativeHandle() {
    const ipcRenderer = getRendererIpc();
    if (!ipcRenderer || typeof ipcRenderer.invoke !== "function") {
      throw new Error("当前 Eagle 无法提供插件窗口通信");
    }

    const nativeHandle = await ipcRenderer.invoke("plugin.window.", {
      method: "getNativeWindowHandle",
      value: undefined,
    });
    const handle = Core.nativeWindowHandleToDecimal(nativeHandle);
    if (!handle) {
      throw new Error("无法获取快捷轨窗口句柄");
    }

    return handle;
  }

  function stopDockHelper() {
    const helper = state.dockHelper;
    state.dockHelper = null;
    if (!helper) {
      return;
    }

    helper.intentional = true;
    try {
      helper.process.kill();
    } catch (_error) {
      // The helper may already have stopped while Eagle is closing.
    }
  }

  function clearDockRetry() {
    window.clearTimeout(state.dockRetryTimer);
    state.dockRetryTimer = null;
    state.dockRetryAttempts = 0;
  }

  function scheduleDockRetry() {
    if (
      !state.dockRestoreRequested ||
      state.docked ||
      state.dockRetryTimer !== null
    ) {
      return;
    }

    const delay = Core.dockRetryDelay(state.dockRetryAttempts);
    state.dockRetryAttempts += 1;
    state.dockRetryTimer = window.setTimeout(() => {
      state.dockRetryTimer = null;
      if (!state.dockRestoreRequested || state.docked || state.dockStarting) {
        scheduleDockRetry();
        return;
      }
      setDocked(true, { silent: true });
    }, delay);
  }

  async function startDockHelper() {
    if (typeof module === "undefined" || !module || typeof module.require !== "function") {
      throw new Error("当前 Eagle 无法启动联动吸附");
    }

    const childProcess = module.require("child_process");
    const nodePath = module.require("path");
    const nodeProcess = module.require("process");
    if (nodeProcess.platform !== "win32") {
      throw new Error("联动吸附目前仅支持 Windows");
    }

    const pluginHandle = await getPluginNativeHandle();
    const systemRoot = nodeProcess.env.SystemRoot || "C:\\Windows";
    const powershell = nodePath.join(
      systemRoot,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    const scriptPath = nodePath.join(window.eagle.plugin.path, "scripts", "window-link.ps1");
    const child = childProcess.spawn(
      powershell,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-PluginHandle",
        pluginHandle,
      ],
      {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const helper = {
      intentional: false,
      process: child,
      ready: false,
    };
    state.dockHelper = helper;

    await new Promise((resolve, reject) => {
      let errorOutput = "";
      let output = "";
      let settled = false;
      const timeout = window.setTimeout(() => {
        fail(new Error("联动吸附启动超时"));
      }, 4000);

      function finishReady(report) {
        if (settled) {
          return;
        }
        settled = true;
        helper.ready = true;
        window.clearTimeout(timeout);
        resolve(report);
      }

      function fail(error) {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        helper.intentional = true;
        try {
          child.kill();
        } catch (_error) {
          // Ignore a process that exited before cleanup.
        }
        reject(error);
      }

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        output += chunk;
        const lineEnd = output.indexOf("\n");
        if (lineEnd < 0) {
          return;
        }

        const line = output.slice(0, lineEnd).trim();
        try {
          const report = JSON.parse(line);
          if (!report || report.ok !== true) {
            throw new Error("联动助手未能完成初始化");
          }
          finishReady(report);
        } catch (error) {
          fail(error);
        }
      });
      child.stderr.on("data", (chunk) => {
        errorOutput = `${errorOutput}${chunk}`.slice(-1200);
      });
      child.once("error", fail);
      child.once("exit", (code) => {
        if (!settled) {
          const detail = errorOutput.trim();
          fail(new Error(detail || `联动助手已退出（${code ?? "unknown"}）`));
        }
      });
    });

    child.on("exit", () => {
      if (state.dockHelper !== helper) {
        return;
      }

      state.dockHelper = null;
      if (!helper.intentional) {
        state.docked = false;
        updateControlStates();
        scheduleDockRetry();
        showToast("联动吸附暂时中断，正在自动重连", "error");
      }
    });

    return helper;
  }

  async function setDocked(value, options) {
    const enabled = Boolean(value);
    const silent = Boolean(options && options.silent);

    if (!enabled) {
      state.docked = false;
      state.dockRestoreRequested = false;
      persistBoolean(STORAGE.linkedDocked, false);
      clearDockRetry();
      stopDockHelper();
      updateControlStates();
      return true;
    }

    state.dockRestoreRequested = true;
    persistBoolean(STORAGE.linkedDocked, true);
    if (!silent) {
      clearDockRetry();
    }

    if (state.docked || state.dockStarting) {
      return state.docked;
    }

    state.dockStarting = true;
    updateControlStates();
    try {
      await startDockHelper();
      state.docked = true;
      clearDockRetry();
      return true;
    } catch (error) {
      console.error("[QuickRail] linked docking failed", error);
      state.docked = false;
      stopDockHelper();
      scheduleDockRetry();
      if (!silent) {
        showToast(error.message || "吸附暂时无法启动，将自动重试", "error");
      }
      return false;
    } finally {
      state.dockStarting = false;
      updateControlStates();
    }
  }

  async function revealEagle() {
    try {
      if (window.eagle.app && typeof window.eagle.app.show === "function") {
        await window.eagle.app.show();
      }
    } catch (_error) {
      // Eagle may already be closing while the navigation promise resolves.
    }
  }

  async function setTopmost(value) {
    state.topmost = Boolean(value);
    persistBoolean(STORAGE.topmost, state.topmost);
    try {
      await window.eagle.window.setAlwaysOnTop(state.topmost);
    } catch (error) {
      console.warn("[QuickRail] always-on-top switch failed", error);
    }
    updateControlStates();
  }

  function isInteractiveRailTarget(target) {
    return Boolean(
      target &&
        typeof target.closest === "function" &&
        target.closest("button, input, a, [draggable='true'], .no-drag"),
    );
  }

  async function handleRailPointerDown(event) {
    if (
      state.windowDrag ||
      !Core.shouldStartWindowDrag({
        button: event.button,
        interactive: isInteractiveRailTarget(event.target),
        clientX: event.clientX,
        clientY: event.clientY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      })
    ) {
      return;
    }

    event.preventDefault();
    const drag = {
      active: true,
      latestScreenX: event.screenX,
      latestScreenY: event.screenY,
      originX: null,
      originY: null,
      pointerId: event.pointerId,
      startScreenX: event.screenX,
      startScreenY: event.screenY,
    };
    state.windowDrag = drag;
    elements.rail.classList.add("window-dragging");

    try {
      elements.rail.setPointerCapture(event.pointerId);
    } catch (_error) {
      // Pointer capture is best-effort; window-level listeners still handle release.
    }

    try {
      const position = await window.eagle.window.getPosition();
      if (state.windowDrag !== drag || !drag.active || !Array.isArray(position)) {
        return;
      }

      drag.originX = position[0];
      drag.originY = position[1];
      queueDraggedWindowPosition(drag);
    } catch (error) {
      console.warn("[QuickRail] window drag start failed", error);
      finishWindowDrag(event.pointerId);
    }
  }

  function handleRailPointerMove(event) {
    const drag = state.windowDrag;
    if (!drag || drag.pointerId !== event.pointerId || !drag.active) {
      return;
    }

    drag.latestScreenX = event.screenX;
    drag.latestScreenY = event.screenY;
    queueDraggedWindowPosition(drag);
  }

  function queueDraggedWindowPosition(drag) {
    if (!Number.isFinite(drag.originX) || !Number.isFinite(drag.originY)) {
      return;
    }

    state.windowMovePending = [
      Math.round(drag.originX + drag.latestScreenX - drag.startScreenX),
      Math.round(drag.originY + drag.latestScreenY - drag.startScreenY),
    ];
    flushWindowMove();
  }

  async function flushWindowMove() {
    if (state.windowMoveInFlight || !state.windowMovePending) {
      return;
    }

    const nextPosition = state.windowMovePending;
    state.windowMovePending = null;
    state.windowMoveInFlight = true;
    try {
      await window.eagle.window.setPosition(nextPosition[0], nextPosition[1]);
      saveWindowPosition({ x: nextPosition[0], y: nextPosition[1] });
    } catch (error) {
      console.warn("[QuickRail] window drag move failed", error);
    } finally {
      state.windowMoveInFlight = false;
      if (state.windowMovePending) {
        flushWindowMove();
      }
    }
  }

  function finishWindowDrag(pointerId) {
    const drag = state.windowDrag;
    if (!drag || (pointerId !== undefined && drag.pointerId !== pointerId)) {
      return;
    }

    drag.active = false;
    state.windowDrag = null;
    elements.rail.classList.remove("window-dragging");
    try {
      if (elements.rail.hasPointerCapture(drag.pointerId)) {
        elements.rail.releasePointerCapture(drag.pointerId);
      }
    } catch (_error) {
      // The browser may release capture before pointerup reaches this handler.
    }
  }

  async function applyWindowLayout(expanded, options) {
    let currentSize = null;

    try {
      currentSize = await window.eagle.window.getSize();
    } catch (_error) {
      currentSize = null;
    }

    const restoreRemembered = Boolean(options && options.restoreRemembered);
    const layoutSource =
      restoreRemembered && state.rememberedSize
        ? [state.rememberedSize.width, state.rememberedSize.height]
        : currentSize;

    const layout = Core.calculateWindowLayout({
      expanded,
      currentWidth: Array.isArray(layoutSource) ? layoutSource[0] : COMPACT_WIDTH,
      currentHeight: Array.isArray(layoutSource) ? layoutSource[1] : COMPACT_HEIGHT,
      compactHeight: state.compactHeight,
      minWidth: 620,
      compactMinHeight: COMPACT_HEIGHT,
      expandedMinHeight: EXPANDED_HEIGHT,
      defaultWidth: COMPACT_WIDTH,
    });
    const { width, height } = layout;
    state.compactHeight = layout.compactHeight;

    try {
      await window.eagle.window.setResizable(true);
      await window.eagle.window.setSize(width, height);
    } catch (error) {
      throw error;
    }

    try {
      await window.eagle.window.setResizable(true);
    } catch (error) {
      console.warn("[QuickRail] enable window resize failed", error);
    }
  }

  function updateControlStates() {
    const reconnecting = state.dockRestoreRequested && !state.docked;
    elements.dockButton.classList.toggle("enabled", state.dockRestoreRequested);
    elements.dockButton.classList.toggle("reconnecting", reconnecting);
    elements.dockButton.disabled = state.dockStarting;
    elements.dockButton.title = state.dockStarting
      ? "正在启用联动吸附…"
      : reconnecting
        ? "联动吸附已开启，正在自动重连；点击可关闭"
        : state.docked
        ? "联动吸附已开启：移动 Eagle 或快捷轨时一起移动；点击解除"
        : "联动吸附：移动 Eagle 或快捷轨时一起移动";
    elements.topmostButton.classList.toggle("enabled", state.topmost);
    elements.topmostButton.title = state.topmost ? "已在系统最前方，点击取消" : "保持在其他窗口前方";
  }

  function setManagerOpen(open) {
    if (state.pinLengthEdit) {
      cancelPinLengthEdit();
    }
    closePinContext();
    state.expanded = Boolean(open);
    const requestedMode = state.expanded;
    elements.appShell.classList.toggle("manager-open", state.expanded);
    elements.managerPanel.classList.toggle("open", state.expanded);
    elements.managerPanel.setAttribute("aria-hidden", String(!state.expanded));
    elements.manageButton.setAttribute("aria-expanded", String(state.expanded));

    state.resizeQueue = state.resizeQueue
      .catch(() => undefined)
      .then(async () => {
        if (state.expanded !== requestedMode) {
          return;
        }
        try {
          await applyWindowLayout(requestedMode);
        } catch (error) {
          console.warn("[QuickRail] resize failed", error);
          showToast("窗口尺寸调整失败，请重新打开插件", "error");
        }
      });

    if (state.expanded) {
      renderAll();
      window.setTimeout(() => elements.searchInput.focus(), 120);
    } else {
      elements.searchInput.value = "";
      renderFolderList();
    }

    return state.resizeQueue;
  }

  async function refreshLibrary(force) {
    if (state.syncInFlight || !window.eagle || !window.eagle.folder) {
      return;
    }

    state.syncInFlight = true;
    if (force) {
      setSyncStatus("同步中", false);
    }

    try {
      const roots = await window.eagle.folder.getAll();
      const folders = Core.flattenFolders(roots);
      const signature = Core.folderSignature(folders);
      const changed = force || signature !== state.folderSignature;

      if (changed) {
        state.folders = folders;
        state.folderMap = new Map(folders.map((folder) => [folder.id, folder]));
        state.folderSignature = signature;

        const collapsibleIds = new Set(
          folders.filter((folder) => folder.childCount > 0).map((folder) => folder.id),
        );
        const nextCollapsed = new Set(
          Array.from(state.collapsedIds).filter((id) => collapsibleIds.has(id)),
        );
        if (nextCollapsed.size !== state.collapsedIds.size) {
          state.collapsedIds = nextCollapsed;
          saveCollapsed();
        }

        const nextPinned = Core.normalizePinned(state.pinnedIds, state.folderMap.keys());
        const removedCount = state.pinnedIds.length - nextPinned.length;
        state.pinnedIds = nextPinned;
        if (removedCount > 0) {
          savePinned();
          showToast(`已移除 ${removedCount} 个失效快捷入口`);
        }
        renderAll();
      }

      setSyncStatus(`${folders.length} 个目录`, true);
    } catch (error) {
      console.error("[QuickRail] sync failed", error);
      setSyncStatus("同步失败", false);
    } finally {
      state.syncInFlight = false;
    }
  }

  async function refreshActiveFolder() {
    if (!window.eagle || !window.eagle.folder || state.syncInFlight) {
      return;
    }

    try {
      const selected = await window.eagle.folder.getSelected();
      let nextActive = null;

      if (Array.isArray(selected) && selected.length === 1 && selected[0]) {
        nextActive = selected[0].id;
      } else if (Date.now() - state.lastAllClickAt < 4000) {
        nextActive = Core.ALL_ID;
      }

      const observation = Core.observeFolderSelection(
        state.lastObservedFolderId,
        nextActive,
        state.hasObservedFolder,
      );
      state.hasObservedFolder = observation.observed;
      state.lastObservedFolderId = observation.lastId;
      if (observation.recordId) {
        recordFolderUse(observation.recordId, "eagle");
      }

      if (nextActive !== state.activeId) {
        state.activeId = nextActive;
        if (state.pinLengthEdit) {
          elements.pinnedList.querySelectorAll(".pin-item[data-id]").forEach((button) => {
            button.classList.toggle("active", button.dataset.id === nextActive);
          });
        } else {
          renderPinned();
        }
      }
    } catch (_error) {
      // Selection can be transient while a library is changing.
    }
  }

  async function loadLibraryIdentity() {
    state.currentLibraryKey = Core.safeText(
      window.eagle && window.eagle.library && window.eagle.library.path,
      "default",
    );

    try {
      const info = await window.eagle.library.info();
      state.libraryName = Core.safeText(info && info.name, "当前资源库");
    } catch (_error) {
      const parts = state.currentLibraryKey.split(/[\\/]/).filter(Boolean);
      state.libraryName = parts.at(-1) || "当前资源库";
    }

    elements.libraryName.textContent = state.libraryName;
    elements.libraryName.title = state.currentLibraryKey;
    if (state.pinLengthEdit) {
      cancelPinLengthEdit();
    }
    closePinContext();
    loadPinned();
    loadPinColors();
    loadPinWidths();
    loadCollapsed();
    loadUsage();
    state.hasObservedFolder = false;
    state.lastObservedFolderId = null;
  }

  function applyTheme(theme) {
    const normalized = String(theme || "").toUpperCase();
    const light = normalized === "LIGHT" || normalized === "LIGHTGRAY";
    elements.appShell.dataset.theme = light ? "light" : "dark";
  }

  function updateScrollNudges() {
    const list = elements.pinnedList;
    const overflow = list.scrollWidth > list.clientWidth + 2;
    elements.scrollLeftButton.classList.toggle("visible", overflow && list.scrollLeft > 2);
    elements.scrollRightButton.classList.toggle(
      "visible",
      overflow && list.scrollLeft + list.clientWidth < list.scrollWidth - 2,
    );
  }

  function bindEvents() {
    elements.rail.addEventListener("pointerdown", handleRailPointerDown);
    elements.rail.addEventListener("pointermove", handleRailPointerMove);
    elements.rail.addEventListener("pointerup", (event) => finishWindowDrag(event.pointerId));
    elements.rail.addEventListener("pointercancel", (event) => finishWindowDrag(event.pointerId));
    elements.rail.addEventListener("lostpointercapture", (event) =>
      finishWindowDrag(event.pointerId),
    );
    elements.manageButton.addEventListener("click", () => setManagerOpen(!state.expanded));
    elements.doneButton.addEventListener("click", () => setManagerOpen(false));
    elements.hideButton.addEventListener("click", async () => {
      cancelPinLengthEdit();
      closePinContext();
      state.manualHidden = true;
      await window.eagle.window.hide();
    });
    elements.pinContextPalette.addEventListener("click", (event) => {
      const button = event.target.closest("[data-pin-color]");
      if (!button || !elements.pinContextPalette.contains(button)) {
        return;
      }
      setPinColor(button.dataset.pinColor);
    });
    elements.pinContextRemoveButton.addEventListener("click", requestPinRemoval);
    elements.pinContextAdjustLengthButton.addEventListener("click", startPinLengthEdit);
    elements.pinContextResetLengthButton.addEventListener("click", resetPinLength);
    elements.pinContextConfirmRemoveButton.addEventListener("click", confirmPinRemoval);
    elements.pinContextCancelRemoveButton.addEventListener("click", () => {
      state.pinContextRemovePending = false;
      renderPinContext();
    });
    elements.pinContextCloseButton.addEventListener("click", closePinContext);
    elements.pinLengthConfirmButton.addEventListener("click", confirmPinLengthEdit);
    elements.pinLengthCancelButton.addEventListener("click", cancelPinLengthEdit);
    elements.dockButton.addEventListener("click", () =>
      setDocked(!state.dockRestoreRequested),
    );
    elements.topmostButton.addEventListener("click", () => setTopmost(!state.topmost));
    elements.orderTabButton.addEventListener("click", () => setManagerSideMode("order"));
    elements.usageTabButton.addEventListener("click", () => setManagerSideMode("usage"));
    elements.usagePeriodButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const period = button.dataset.usagePeriod;
        if (!Object.hasOwn(USAGE_PERIOD_LABELS, period)) {
          return;
        }
        state.usagePeriod = period;
        localStorage.setItem(STORAGE.usagePeriod, period);
        renderFolderList();
        renderSelected();
        renderUsage();
      });
    });
    elements.selectAllUsageButton.addEventListener("click", () => {
      const itemIds = [Core.ALL_ID, ...state.folders.map((folder) => folder.id)];
      state.pinnedIds = Core.sortPinnedByUsage(itemIds, currentUsageCounts());
      savePinned();
      renderAfterUsageSelection();
    });
    elements.clearUsageSelectionButton.addEventListener("click", () => {
      state.pinnedIds = [];
      savePinned();
      renderAfterUsageSelection();
    });
    elements.clearButton.addEventListener("click", () => {
      state.pinnedIds = [];
      savePinned();
      renderAll();
      showToast("已清空快捷入口");
    });
    elements.expandAllButton.addEventListener("click", () => {
      state.collapsedIds.clear();
      saveCollapsed();
      renderFolderList();
    });
    elements.collapseAllButton.addEventListener("click", () => {
      state.collapsedIds = new Set(
        state.folders.filter((folder) => folder.childCount > 0).map((folder) => folder.id),
      );
      saveCollapsed();
      renderFolderList();
    });
    elements.searchInput.addEventListener("input", renderFolderList);
    elements.pinnedList.addEventListener("scroll", updateScrollNudges, { passive: true });
    elements.pinnedList.addEventListener(
      "wheel",
      (event) => {
        const list = elements.pinnedList;
        if (list.scrollWidth <= list.clientWidth + 2) {
          return;
        }

        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
        if (delta === 0) {
          return;
        }

        const multiplier =
          event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? 28
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
              ? list.clientWidth
              : 1;
        list.scrollLeft += delta * multiplier;
        updateScrollNudges();
        event.preventDefault();
        event.stopPropagation();
      },
      { passive: false },
    );
    elements.scrollLeftButton.addEventListener("click", () => {
      elements.pinnedList.scrollBy({ left: -260, behavior: "smooth" });
    });
    elements.scrollRightButton.addEventListener("click", () => {
      elements.pinnedList.scrollBy({ left: 260, behavior: "smooth" });
    });

    [elements.folderList, elements.selectedList].forEach((scroller) => {
      scroller.addEventListener(
        "wheel",
        (event) => {
          if (scroller.scrollHeight <= scroller.clientHeight || event.deltaY === 0) {
            return;
          }
          const multiplier =
            event.deltaMode === WheelEvent.DOM_DELTA_LINE
              ? 28
              : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
                ? scroller.clientHeight
                : 1;
          scroller.scrollTop += event.deltaY * multiplier;
          event.preventDefault();
          event.stopPropagation();
        },
        { passive: false },
      );
    });

    document.addEventListener("keydown", (event) => {
      const isTyping = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);

      if (event.key === "Escape" && state.pinLengthEdit) {
        event.preventDefault();
        cancelPinLengthEdit();
        return;
      }

      if (event.key === "Escape" && state.pinContextId) {
        event.preventDefault();
        closePinContext();
        return;
      }

      if (event.key === "Escape" && state.expanded) {
        event.preventDefault();
        setManagerOpen(false);
        return;
      }

      if (event.key === "/" && state.expanded && !isTyping) {
        event.preventDefault();
        elements.searchInput.focus();
        return;
      }

      if (!isTyping && !state.pinLengthEdit && event.altKey && /^[1-9]$/.test(event.key)) {
        const id = state.pinnedIds[Number(event.key) - 1];
        if (id) {
          event.preventDefault();
          openItem(id);
        }
      }
    });

    window.addEventListener("resize", () => {
      updateScrollNudges();
      scheduleWindowSizeSave();
    });
  }

  function startTimers() {
    stopTimers();
    state.timers.push(window.setInterval(() => refreshLibrary(false), SYNC_INTERVAL));
    state.timers.push(window.setInterval(refreshActiveFolder, ACTIVE_INTERVAL));
    state.timers.push(
      window.setInterval(persistCurrentWindowPosition, POSITION_SAVE_INTERVAL),
    );
    state.timers.push(
      window.setInterval(() => {
        if (state.expanded && state.managerSideMode === "usage") {
          renderUsage();
        }
      }, USAGE_REFRESH_INTERVAL),
    );
  }

  function stopTimers() {
    state.timers.forEach((timer) => window.clearInterval(timer));
    state.timers = [];
  }

  function cleanupPlugin() {
    state.pinLengthEdit = null;
    renderPinLengthControls();
    closePinContext();
    stopTimers();
    clearDockRetry();
    stopDockHelper();
    window.clearTimeout(state.sizeSaveTimer);
    persistCurrentWindowPosition();
    persistCurrentWindowSize();
  }

  async function initializePlugin() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;
    bindEvents();
    applyTheme(window.eagle.app.theme);
    await loadLibraryIdentity();
    await refreshLibrary(true);
    await setTopmost(state.topmost);
    await applyWindowLayout(false, { restoreRemembered: true });
    await restoreRememberedWindowPosition();
    await persistCurrentWindowSize();
    await window.eagle.window.showInactive();
    await restoreRememberedWindowPosition();
    if (state.dockRestoreRequested) {
      await setDocked(true, { silent: true });
    }
    startTimers();

    if (localStorage.getItem(STORAGE.onboarding) !== "true") {
      localStorage.setItem(STORAGE.onboarding, "true");
      window.setTimeout(() => {
        showToast("点击“管理”选择常用文件夹，按住快捷条空白处可移动");
      }, 500);
    }
  }

  function handleLifecycleError(error) {
    console.error("[QuickRail] initialization failed", error);
    setSyncStatus("初始化失败", false);
    if (!state.lifecycleErrorReported) {
      state.lifecycleErrorReported = true;
      showToast("快捷轨初始化失败，请重新加载插件", "error");
    }
  }

  function bindEagleLifecycle() {
    window.eagle.onPluginCreate(() => {
      lifecycleGate.markCreated();
      lifecycleGate.whenReady().catch(handleLifecycleError);
    });

    window.eagle.onPluginRun(() => {
      lifecycleGate
        .whenReady(async () => {
          state.manualHidden = false;
          await setManagerOpen(false);
          await window.eagle.window.show();
          await refreshLibrary(true);
        })
        .catch(handleLifecycleError);
    });

    window.eagle.onPluginShow(() => {
      state.manualHidden = false;
      lifecycleGate.whenReady(() => refreshLibrary(true)).catch(handleLifecycleError);
    });

    window.eagle.onLibraryChanged(() => {
      lifecycleGate
        .whenReady(async () => {
          setSyncStatus("切换资源库", false);
          state.activeId = null;
          state.folderSignature = "";
          await loadLibraryIdentity();
          await refreshLibrary(true);
        })
        .catch(handleLifecycleError);
    });

    window.eagle.onThemeChanged(applyTheme);
    window.eagle.onPluginBeforeExit(cleanupPlugin);
  }

  function startDemo() {
    const demoRoots = [
      {
        id: "design",
        name: "设计项目",
        iconColor: "orange",
        children: [
          { id: "ui", name: "UI 灵感", iconColor: "blue", children: [] },
          { id: "brand", name: "品牌素材", iconColor: "purple", children: [] },
        ],
      },
      {
        id: "photo",
        name: "摄影归档",
        iconColor: "green",
        children: [{ id: "travel", name: "旅行", iconColor: "aqua", children: [] }],
      },
    ];

    state.folders = Core.flattenFolders(demoRoots);
    state.folderMap = new Map(state.folders.map((folder) => [folder.id, folder]));
    state.pinnedIds = [Core.ALL_ID, "ui", "brand", "travel"];
    state.libraryName = "视觉资料库 · 演示";
    elements.libraryName.textContent = state.libraryName;
    setSyncStatus(`${state.folders.length} 个目录`, true);
    bindEvents();
    renderAll();
  }

  if (window.eagle && window.eagle.folder) {
    bindEagleLifecycle();
  } else {
    startDemo();
  }
})();
