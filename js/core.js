(function exposeQuickRailCore(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.QuickRailCore = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createQuickRailCore() {
  "use strict";

  const ALL_ID = "__QUICKRAIL_ALL__";
  const PIN_COLOR_KEYS = new Set([
    "red",
    "orange",
    "yellow",
    "green",
    "aqua",
    "blue",
    "purple",
    "pink",
  ]);

  function safeText(value, fallback) {
    if (typeof value !== "string") {
      return fallback || "";
    }

    const trimmed = value.trim();
    return trimmed || fallback || "";
  }

  function flattenFolders(roots) {
    const rows = [];
    const visited = new Set();

    function visit(folder, ancestors, fallbackDepth, fallbackParent) {
      if (!folder || typeof folder.id !== "string" || visited.has(folder.id)) {
        return;
      }

      visited.add(folder.id);

      const name = safeText(folder.name, "未命名文件夹");
      const pathParts = ancestors.concat(name);
      const children = Array.isArray(folder.children) ? folder.children : [];

      rows.push({
        id: folder.id,
        name,
        parent: typeof folder.parent === "string" ? folder.parent : fallbackParent || null,
        depth: Math.max(0, fallbackDepth),
        path: pathParts.join(" / "),
        parentPath: ancestors.join(" / "),
        iconColor: safeText(folder.iconColor, ""),
        childCount: children.length,
      });

      children.forEach((child) => visit(child, pathParts, fallbackDepth + 1, folder.id));
    }

    (Array.isArray(roots) ? roots : []).forEach((folder) => visit(folder, [], 0, null));
    return rows;
  }

  function buildDistinctFolderLabels(items) {
    const folders = (Array.isArray(items) ? items : []).filter(
      (item) => item && typeof item.id === "string" && typeof item.name === "string",
    );
    const labels = new Map();
    const groups = new Map();

    folders.forEach((item) => {
      const name = safeText(item.name, "未命名文件夹");
      const key = name.toLocaleLowerCase();
      labels.set(item.id, { primary: name, context: "" });
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(item);
    });

    groups.forEach((group) => {
      if (group.length < 2) {
        return;
      }

      const parentParts = group.map((item) => {
        const name = safeText(item.name, "未命名文件夹");
        const parts = safeText(item.path, name)
          .split(/\s*\/\s*/)
          .map((part) => part.trim())
          .filter(Boolean);
        if (parts.at(-1)?.toLocaleLowerCase() === name.toLocaleLowerCase()) {
          parts.pop();
        }
        return parts;
      });
      const depths = parentParts.map(() => 1);
      let contexts = parentParts.map(
        (parts, index) => parts.slice(-depths[index]).join(" › ") || "当前资源库",
      );

      while (true) {
        const collisions = new Map();
        contexts.forEach((context, index) => {
          const key = context.toLocaleLowerCase();
          if (!collisions.has(key)) {
            collisions.set(key, []);
          }
          collisions.get(key).push(index);
        });
        const duplicated = Array.from(collisions.values()).filter(
          (indices) => indices.length > 1,
        );
        if (duplicated.length === 0) {
          break;
        }

        let expanded = false;
        duplicated.flat().forEach((index) => {
          if (depths[index] < parentParts[index].length) {
            depths[index] += 1;
            expanded = true;
          }
        });
        if (!expanded) {
          break;
        }
        contexts = parentParts.map(
          (parts, index) => parts.slice(-depths[index]).join(" › ") || "当前资源库",
        );
      }

      const finalCollisions = new Map();
      contexts.forEach((context, index) => {
        const key = context.toLocaleLowerCase();
        if (!finalCollisions.has(key)) {
          finalCollisions.set(key, []);
        }
        finalCollisions.get(key).push(index);
      });
      finalCollisions.forEach((indices) => {
        if (indices.length < 2) {
          return;
        }
        indices.forEach((index) => {
          const id = group[index].id;
          const suffix = id.slice(-4) || id;
          contexts[index] = `${contexts[index]} · #${suffix}`;
        });
      });

      group.forEach((item, index) => {
        labels.set(item.id, {
          primary: safeText(item.name, "未命名文件夹"),
          context: contexts[index],
        });
      });
    });

    return labels;
  }

  function normalizePinned(ids, validIds, options) {
    const keepMissing = Boolean(options && options.keepMissing);
    const valid = validIds instanceof Set ? validIds : new Set(validIds || []);
    const seen = new Set();
    const result = [];

    (Array.isArray(ids) ? ids : []).forEach((id) => {
      if (typeof id !== "string" || seen.has(id)) {
        return;
      }

      if (id !== ALL_ID && !keepMissing && !valid.has(id)) {
        return;
      }

      seen.add(id);
      result.push(id);
    });

    return result;
  }

  function togglePinned(ids, id) {
    const source = Array.isArray(ids) ? ids.slice() : [];
    const index = source.indexOf(id);

    if (index >= 0) {
      source.splice(index, 1);
    } else {
      source.push(id);
    }

    return source;
  }

  function normalizePinColors(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    const normalized = {};
    Object.entries(value).forEach(([id, color]) => {
      if (id && PIN_COLOR_KEYS.has(color)) {
        normalized[id] = color;
      }
    });
    return normalized;
  }

  function normalizePinWidth(value, options) {
    if (!Number.isFinite(value)) {
      return null;
    }

    const source = options || {};
    const minWidth = Number.isFinite(source.minWidth) ? source.minWidth : 64;
    const maxWidth = Number.isFinite(source.maxWidth) ? source.maxWidth : 260;
    return Math.min(maxWidth, Math.max(minWidth, Math.round(value)));
  }

  function normalizePinWidths(value, options) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    const normalized = {};
    Object.entries(value).forEach(([id, width]) => {
      const normalizedWidth = normalizePinWidth(width, options);
      if (id && normalizedWidth !== null) {
        normalized[id] = normalizedWidth;
      }
    });
    return normalized;
  }

  function movePinned(ids, draggedId, targetId) {
    const source = Array.isArray(ids) ? ids.slice() : [];
    const from = source.indexOf(draggedId);
    const targetBeforeRemoval = source.indexOf(targetId);

    if (from < 0 || targetBeforeRemoval < 0 || draggedId === targetId) {
      return source;
    }

    source.splice(from, 1);
    const target = source.indexOf(targetId);
    source.splice(target, 0, draggedId);
    return source;
  }

  function filterFolders(folders, keyword) {
    const normalized = safeText(keyword, "").toLocaleLowerCase();

    if (!normalized) {
      return Array.isArray(folders) ? folders.slice() : [];
    }

    return (Array.isArray(folders) ? folders : []).filter((folder) => {
      const haystack = `${folder.name || ""}\n${folder.path || ""}`.toLocaleLowerCase();
      return haystack.includes(normalized);
    });
  }

  function getVisibleFolders(folders, collapsedIds, keyword) {
    const source = Array.isArray(folders) ? folders : [];
    const query = safeText(keyword, "");

    if (query) {
      return filterFolders(source, query);
    }

    const collapsed = collapsedIds instanceof Set ? collapsedIds : new Set(collapsedIds || []);
    const visible = [];
    let hiddenBelowDepth = null;

    source.forEach((folder) => {
      const depth = Number.isFinite(folder.depth) ? Math.max(0, folder.depth) : 0;

      if (hiddenBelowDepth !== null && depth <= hiddenBelowDepth) {
        hiddenBelowDepth = null;
      }

      if (hiddenBelowDepth !== null) {
        return;
      }

      visible.push(folder);
      if (folder.childCount > 0 && collapsed.has(folder.id)) {
        hiddenBelowDepth = depth;
      }
    });

    return visible;
  }

  function folderSignature(folders) {
    return JSON.stringify(
      (Array.isArray(folders) ? folders : []).map((folder) => [
        folder.id,
        folder.name,
        folder.parent,
        folder.iconColor,
        folder.path,
      ]),
    );
  }

  function calculateWindowLayout(options) {
    const source = options || {};
    const minWidth = Number.isFinite(source.minWidth) ? source.minWidth : 620;
    const compactMinHeight = Number.isFinite(source.compactMinHeight)
      ? source.compactMinHeight
      : 58;
    const expandedMinHeight = Number.isFinite(source.expandedMinHeight)
      ? source.expandedMinHeight
      : 610;
    const defaultWidth = Number.isFinite(source.defaultWidth) ? source.defaultWidth : 760;
    const currentWidth = Number.isFinite(source.currentWidth) ? source.currentWidth : defaultWidth;
    const currentHeight = Number.isFinite(source.currentHeight)
      ? source.currentHeight
      : compactMinHeight;
    const compactHeight = Number.isFinite(source.compactHeight)
      ? source.compactHeight
      : compactMinHeight;

    return {
      width: Math.max(minWidth, currentWidth),
      height: source.expanded
        ? Math.max(expandedMinHeight, currentHeight)
        : Math.max(compactMinHeight, compactHeight),
      compactHeight: source.expanded
        ? Math.max(compactMinHeight, currentHeight)
        : Math.max(compactMinHeight, compactHeight),
    };
  }

  function normalizeRememberedWindowSize(value, options) {
    if (
      !value ||
      typeof value !== "object" ||
      !Number.isFinite(value.width) ||
      !Number.isFinite(value.height)
    ) {
      return null;
    }

    const source = options || {};
    const minWidth = Number.isFinite(source.minWidth) ? source.minWidth : 620;
    const minHeight = Number.isFinite(source.minHeight) ? source.minHeight : 58;
    const maxWidth = Number.isFinite(source.maxWidth) ? source.maxWidth : 10000;
    const maxHeight = Number.isFinite(source.maxHeight) ? source.maxHeight : 10000;

    return {
      width: Math.min(maxWidth, Math.max(minWidth, Math.round(value.width))),
      height: Math.min(maxHeight, Math.max(minHeight, Math.round(value.height))),
    };
  }

  function normalizeRememberedWindowPosition(value, options) {
    if (
      !value ||
      typeof value !== "object" ||
      !Number.isFinite(value.x) ||
      !Number.isFinite(value.y)
    ) {
      return null;
    }

    const source = options || {};
    const minCoordinate = Number.isFinite(source.minCoordinate)
      ? source.minCoordinate
      : -100000;
    const maxCoordinate = Number.isFinite(source.maxCoordinate)
      ? source.maxCoordinate
      : 100000;

    return {
      x: Math.min(maxCoordinate, Math.max(minCoordinate, Math.round(value.x))),
      y: Math.min(maxCoordinate, Math.max(minCoordinate, Math.round(value.y))),
    };
  }

  function dockRetryDelay(attempt) {
    const normalizedAttempt = Number.isFinite(attempt)
      ? Math.max(0, Math.floor(attempt))
      : 0;
    const delays = [1000, 2000, 4000, 8000, 15000];
    return delays[normalizedAttempt] || 30000;
  }

  function rememberWindowSize(previous, current, expanded) {
    const normalizedCurrent = normalizeRememberedWindowSize(current);
    if (!normalizedCurrent) {
      return normalizeRememberedWindowSize(previous);
    }

    const normalizedPrevious = normalizeRememberedWindowSize(previous);
    return {
      width: normalizedCurrent.width,
      height:
        expanded && normalizedPrevious ? normalizedPrevious.height : normalizedCurrent.height,
    };
  }

  function sendOpenAllToHost(ipcRenderer, parentId) {
    if (
      !ipcRenderer ||
      typeof ipcRenderer.sendTo !== "function" ||
      !Number.isFinite(parentId)
    ) {
      return false;
    }

    ipcRenderer.sendTo(parentId, "show-and-search");
    return true;
  }

  function shouldStartWindowDrag(options) {
    const source = options || {};
    const edgeInset = Number.isFinite(source.edgeInset) ? Math.max(0, source.edgeInset) : 6;
    const width = Number.isFinite(source.viewportWidth) ? source.viewportWidth : 0;
    const height = Number.isFinite(source.viewportHeight) ? source.viewportHeight : 0;
    const x = Number.isFinite(source.clientX) ? source.clientX : -1;
    const y = Number.isFinite(source.clientY) ? source.clientY : -1;

    return (
      source.button === 0 &&
      !source.interactive &&
      width > edgeInset * 2 &&
      height > edgeInset * 2 &&
      x >= edgeInset &&
      y >= edgeInset &&
      x <= width - edgeInset &&
      y <= height - edgeInset
    );
  }

  function nativeWindowHandleToDecimal(value) {
    let bytes = null;

    if (value && typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value)) {
      bytes = Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    } else if (Array.isArray(value)) {
      bytes = value.slice();
    } else if (value && Array.isArray(value.data)) {
      bytes = value.data.slice();
    }

    if (!bytes || bytes.length === 0 || bytes.length > 8) {
      return null;
    }

    let handle = 0n;
    for (let index = 0; index < bytes.length; index += 1) {
      const byte = bytes[index];
      if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
        return null;
      }
      handle |= BigInt(byte) << BigInt(index * 8);
    }

    return handle > 0n ? handle.toString() : null;
  }

  function createPluginLifecycleGate(initializer) {
    const initialize = typeof initializer === "function" ? initializer : () => undefined;
    let created = false;
    let readyPromise = null;

    return {
      markCreated() {
        created = true;
      },
      whenReady(callback) {
        if (!created) {
          return Promise.resolve(false);
        }

        if (!readyPromise) {
          readyPromise = Promise.resolve().then(initialize);
        }

        return readyPromise.then(() =>
          typeof callback === "function" ? callback() : true,
        );
      },
    };
  }

  function usageWindowMs(period) {
    const hour = 60 * 60 * 1000;
    const windows = {
      day: 24 * hour,
      week: 7 * 24 * hour,
      month: 30 * 24 * hour,
    };
    return windows[period] || windows.month;
  }

  function normalizeUsageEvents(events, options) {
    const source = options || {};
    const now = Number.isFinite(source.now) ? source.now : Date.now();
    const maxAge = Number.isFinite(source.maxAge)
      ? Math.max(0, source.maxAge)
      : usageWindowMs("month");
    const maxEvents = Number.isFinite(source.maxEvents)
      ? Math.max(1, Math.round(source.maxEvents))
      : 20000;
    const oldest = now - maxAge;
    const latest = now + 60 * 1000;

    return (Array.isArray(events) ? events : [])
      .filter(
        (event) =>
          event &&
          typeof event.id === "string" &&
          event.id.length > 0 &&
          Number.isFinite(event.at) &&
          event.at >= oldest &&
          event.at <= latest,
      )
      .map((event) => ({
        id: event.id,
        at: Math.round(event.at),
        source: event.source === "quickrail" ? "quickrail" : "eagle",
      }))
      .sort((left, right) => left.at - right.at)
      .slice(-maxEvents);
  }

  function countFolderUsage(events, period, nowValue) {
    const now = Number.isFinite(nowValue) ? nowValue : Date.now();
    const oldest = now - usageWindowMs(period);
    const counts = new Map();

    (Array.isArray(events) ? events : []).forEach((event) => {
      if (
        !event ||
        typeof event.id !== "string" ||
        !event.id ||
        !Number.isFinite(event.at) ||
        event.at < oldest ||
        event.at > now
      ) {
        return;
      }
      counts.set(event.id, (counts.get(event.id) || 0) + 1);
    });

    return counts;
  }

  function sortPinnedByUsage(ids, counts) {
    const source = Array.isArray(ids) ? ids.slice() : [];
    const usageCounts = counts instanceof Map ? counts : new Map();

    return source
      .map((id, index) => ({
        count: Number(usageCounts.get(id)) || 0,
        id,
        index,
      }))
      .sort((left, right) => right.count - left.count || left.index - right.index)
      .map((entry) => entry.id);
  }

  function observeFolderSelection(previousId, nextId, hasObserved) {
    const normalizedPrevious = typeof previousId === "string" ? previousId : null;
    const normalizedNext = typeof nextId === "string" ? nextId : null;

    if (!hasObserved) {
      return {
        observed: true,
        lastId: normalizedNext,
        recordId: null,
      };
    }

    return {
      observed: true,
      lastId: normalizedNext,
      recordId:
        normalizedNext && normalizedNext !== normalizedPrevious
          ? normalizedNext
          : null,
    };
  }

  return {
    ALL_ID,
    buildDistinctFolderLabels,
    calculateWindowLayout,
    countFolderUsage,
    createPluginLifecycleGate,
    dockRetryDelay,
    filterFolders,
    flattenFolders,
    folderSignature,
    getVisibleFolders,
    movePinned,
    nativeWindowHandleToDecimal,
    normalizePinColors,
    normalizePinWidth,
    normalizePinWidths,
    normalizeRememberedWindowPosition,
    normalizeRememberedWindowSize,
    normalizePinned,
    normalizeUsageEvents,
    observeFolderSelection,
    rememberWindowSize,
    safeText,
    sendOpenAllToHost,
    shouldStartWindowDrag,
    sortPinnedByUsage,
    togglePinned,
    usageWindowMs,
  };
});
