const SG_DISPATCH_PRIORITY = Object.freeze({
  MODAL_ESCAPE: 10,
  PERIODIC_SEND_BLOCK: 20,
  COMMAND_PALETTE: 30,
  ORCHESTRATOR: 40,
  SKILLS_PRESEND: 50,
  QUEUE_CHAINS: 60,
  UI_CONTROLS: 70
});

(() => {
  const _bucketsByTarget = new Map();
  const _entriesById = new Map();
  let _nextSeq = 1;

  function resolveTarget(target) {
    if (target === "window") return typeof window !== "undefined" ? window : null;
    if (target === "document") return typeof document !== "undefined" ? document : null;
    return target && typeof target.addEventListener === "function" ? target : null;
  }

  function dispatchBucket(bucket, ev) {
    if (!bucket || !bucket.entries || bucket.entries.length === 0) return;

    const ordered = bucket.entries
      .slice()
      .sort((a, b) => a.priority - b.priority || a.seq - b.seq);

    let immediateStopped = false;
    const hasOwnStop = Object.prototype.hasOwnProperty.call(ev, "stopImmediatePropagation");
    const prevOwnDesc = hasOwnStop ? Object.getOwnPropertyDescriptor(ev, "stopImmediatePropagation") : null;
    const protoStop = ev && ev.stopImmediatePropagation;

    let wrappedApplied = false;
    try {
      const wrappedStop = function () {
        immediateStopped = true;
        if (typeof protoStop === "function") {
          try {
            return protoStop.apply(this, arguments);
          } catch (_e) {}
        }
      };
      const curDesc = Object.getOwnPropertyDescriptor(ev, "stopImmediatePropagation");
      if (!curDesc || curDesc.configurable) {
        Object.defineProperty(ev, "stopImmediatePropagation", {
          value: wrappedStop,
          writable: true,
          enumerable: false,
          configurable: true
        });
        wrappedApplied = true;
      } else if (curDesc.writable) {
        ev.stopImmediatePropagation = wrappedStop;
        wrappedApplied = true;
      }
    } catch (_e) {}

    try {
      for (const entry of ordered) {
        if (immediateStopped) break;
        if (!bucket.entriesById.has(entry.id)) continue;
        try {
          entry.handler(ev);
        } catch (err) {
          console.error(`[SG.dispatcher] Handler "${entry.id}" error on ${bucket.eventType}:`, err);
        }
        if (immediateStopped || ev._stoppedImmediate || ev.immediatePropagationStopped || ev.cancelBubble === true && ev.immediateStopped) {
          if (immediateStopped || ev._stoppedImmediate || ev.immediatePropagationStopped) break;
        }
      }
    } finally {
      if (wrappedApplied) {
        try {
          if (prevOwnDesc) {
            Object.defineProperty(ev, "stopImmediatePropagation", prevOwnDesc);
          } else {
            delete ev.stopImmediatePropagation;
          }
        } catch (_e) {}
      }
    }
  }

  function removeEntryFromBucket(entry) {
    const eventMap = _bucketsByTarget.get(entry.targetObj);
    if (!eventMap) return;
    const bucket = eventMap.get(entry.eventType);
    if (!bucket) return;

    bucket.entriesById.delete(entry.id);
    const idx = bucket.entries.indexOf(entry);
    if (idx >= 0) bucket.entries.splice(idx, 1);

    if (bucket.entries.length === 0) {
      if (typeof entry.targetObj.removeEventListener === "function") {
        entry.targetObj.removeEventListener(entry.eventType, bucket.rootListener, true);
      }
      eventMap.delete(entry.eventType);
      if (eventMap.size === 0) {
        _bucketsByTarget.delete(entry.targetObj);
      }
    }
  }

  function unregister(id) {
    const existing = _entriesById.get(id);
    if (!existing) return false;
    _entriesById.delete(id);
    removeEntryFromBucket(existing);
    return true;
  }

  function register(id, target, eventType, handler, priority = SG_DISPATCH_PRIORITY.UI_CONTROLS) {
    if (!id || typeof handler !== "function" || !eventType) return false;
    const targetObj = resolveTarget(target);
    if (!targetObj) return false;

    if (_entriesById.has(id)) {
      unregister(id);
    }

    let eventMap = _bucketsByTarget.get(targetObj);
    if (!eventMap) {
      eventMap = new Map();
      _bucketsByTarget.set(targetObj, eventMap);
    }

    let bucket = eventMap.get(eventType);
    if (!bucket) {
      bucket = {
        eventType,
        entries: [],
        entriesById: new Map(),
        rootListener: null
      };
      bucket.rootListener = (ev) => dispatchBucket(bucket, ev);
      eventMap.set(eventType, bucket);
      targetObj.addEventListener(eventType, bucket.rootListener, true);
    }

    const entry = {
      id: String(id),
      targetObj,
      eventType: String(eventType),
      handler,
      priority: Number.isFinite(Number(priority)) ? Number(priority) : SG_DISPATCH_PRIORITY.UI_CONTROLS,
      seq: _nextSeq++
    };

    bucket.entries.push(entry);
    bucket.entriesById.set(entry.id, entry);
    _entriesById.set(entry.id, entry);
    return true;
  }

  function unregisterByPrefix(prefix) {
    const p = String(prefix || "");
    if (!p) return 0;
    let removed = 0;
    for (const id of Array.from(_entriesById.keys())) {
      if (id.startsWith(p)) {
        unregister(id);
        removed++;
      }
    }
    return removed;
  }

  function listRegistered() {
    const out = [];
    for (const e of _entriesById.values()) {
      out.push({
        id: e.id,
        eventType: e.eventType,
        priority: e.priority,
        seq: e.seq
      });
    }
    return out.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
  }

  if (typeof SG !== "undefined" && SG) {
    SG.dispatcher = Object.freeze({
      PRIORITY: SG_DISPATCH_PRIORITY,
      register,
      unregister,
      unregisterByPrefix,
      listRegistered
    });
  }
})();
