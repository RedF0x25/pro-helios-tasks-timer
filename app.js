const TASKS = [
  { id: 1, name: "DEX Swap", intervalMinutes: 30, url: "https://swap.lunari.finance/" },
  { id: 2, name: "Deploy Contract", intervalMinutes: 60, url: "https://helios-simple-task.vercel.app/" },
  { id: 3, name: "Deploy NFT", intervalMinutes: 120, url: "https://mintpad.co/app/" },
  { id: 4, name: "Mint NFT", intervalMinutes: 60, url: "https://sweep.haus/Helios" },
  { id: 5, name: "Refinery Deposit", intervalMinutes: 60, url: "https://yield.lunari.finance/deepmine/refinery" },
  { id: 6, name: "Refinery Claim", intervalMinutes: 120, url: "https://yield.lunari.finance/deepmine/refinery" },
  { id: 7, name: "Token Deploy", intervalMinutes: 150, url: "https://portal.helioschain.network/token-deployer" },
  { id: 8, name: "Bridge Fund", intervalMinutes: 180, url: "https://portal.helioschain.network/bridge" },
  { id: 9, name: "Chronos Deploy", intervalMinutes: 4320, url: "https://helios-chronos-app-iota.vercel.app/" },
];

const STORAGE_KEY = "helios_pro_task_counter_v1";

let audioCtx;

let state = {
  paused: false,
  tasks: [],
  lastStatuses: {},
  globalMute: false,
  linkEditor: {
    taskId: null,
  },
  renameEditor: {
    taskId: null,
  },
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.tasks)) return;

    state.globalMute = !!parsed.globalMute;

    const defaultsById = new Map(TASKS.map((t) => [t.id, t]));
    const loaded = [];

    for (const saved of parsed.tasks) {
      const base = defaultsById.get(saved.id);
      if (!base) continue;
      loaded.push({
        ...base,
        ...saved,
        muted: !!saved.muted,
        url: saved.url ?? "",
      });
      defaultsById.delete(saved.id);
    }

    for (const base of defaultsById.values()) {
      loaded.push({ ...base, lastRun: null, muted: false, url: "" });
    }

    state.tasks = loaded;
  } catch (e) {
    console.error("Failed to load state", e);
  }
}

function saveState() {
  try {
    const payload = {
      globalMute: !!state.globalMute,
      tasks: state.tasks.map(({ id, name, intervalMinutes, lastRun, muted, url }) => ({
        id,
        name,
        intervalMinutes,
        lastRun,
        muted: !!muted,
        url: url ?? "",
      })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error("Failed to save state", e);
  }
}

function initState() {
  state.tasks = TASKS.map((t) => ({ ...t, lastRun: null, muted: false, url: "" }));
  loadState();
}

function ensureAudioCtx() {
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor) {
      audioCtx = new Ctor();
    }
  }
  return audioCtx;
}

function playAlert(kind, taskId) {
  if (state.globalMute) return;
  const t = state.tasks.find((x) => x.id === taskId);
  if (t && t.muted) return;

  const ctx = ensureAudioCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  const now = ctx.currentTime;
  const duration = kind === "overdue" ? 0.35 : 0.22;
  const startFreq = kind === "overdue" ? 880 : 1320;
  const endFreq = kind === "overdue" ? 440 : 880;

  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.linearRampToValueAtTime(endFreq, now + duration);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.06, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function formatInterval(mins) {
  if (mins % (60 * 24) === 0) {
    const days = mins / (60 * 24);
    return days === 1 ? "every day" : `every ${days} days`;
  }
  if (mins % 60 === 0) {
    const hours = mins / 60;
    if (hours === 1) return "every 1 hour";
    return `every ${hours} hours`;
  }
  if (mins > 60 && mins % 30 === 0) {
    const hours = Math.floor(mins / 60);
    const rest = mins % 60;
    return `every ${hours}h ${rest}min`;
  }
  return `every ${mins} min`;
}

function formatTime(dt) {
  if (!dt) return "—";
  return dt.toLocaleString();
}

function formatCountdown(ms) {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => (n < 10 ? `0${n}` : String(n));
  if (h > 99) return `99:59:59`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function computeTaskStatus(task, now) {
  const intervalMs = task.intervalMinutes * 60 * 1000;
  const lastRun = task.lastRun ? new Date(task.lastRun) : null;

  const nextDue = lastRun ? lastRun.getTime() + intervalMs : null;

  if (!lastRun) {
    return {
      status: "now",
      label: "Run now",
      countdownMs: 0,
      nextDue: null,
    };
  }

  const diff = nextDue - now.getTime();

  if (diff <= 0) {
    return {
      status: "overdue",
      label: "Overdue",
      countdownMs: 0,
      nextDue,
    };
  }

  if (diff <= 60 * 1000) {
    return {
      status: "now",
      label: "Due now",
      countdownMs: diff,
      nextDue,
    };
  }

  if (diff <= 15 * 60 * 1000) {
    return {
      status: "soon",
      label: "Due soon",
      countdownMs: diff,
      nextDue,
    };
  }

  return {
    status: "ok",
    label: "On track",
    countdownMs: diff,
    nextDue,
  };
}

function renderTasks() {
  const grid = document.getElementById("tasks-grid");
  grid.innerHTML = "";

  const pausedOverlay = ensurePausedOverlay();
  pausedOverlay.classList.toggle("visible", state.paused);
  syncLinkEditor();
  syncRenameEditor();

  const filterOverdue = document.getElementById("filter-overdue-only").checked;
  const filterSoon = document.getElementById("filter-due-soon-only").checked;

  const now = new Date();

  let cntOverdue = 0;
  let cntSoon = 0;
  let cntOk = 0;
  let cntNow = 0;

  const taskInfos = state.tasks.map((task) => {
    const info = computeTaskStatus(task, now);
    if (info.status === "overdue") cntOverdue++;
    else if (info.status === "soon") cntSoon++;
    else if (info.status === "ok") cntOk++;
    else if (info.status === "now") cntNow++;
    return { task, info };
  });

  document.getElementById("summary-overdue").textContent = String(cntOverdue);
  document.getElementById("summary-soon").textContent = String(cntSoon);
  document.getElementById("summary-ok").textContent = String(cntOk);
  document.getElementById("summary-now").textContent = String(cntNow);

  for (const { task, info } of taskInfos) {
    const prevStatus = state.lastStatuses[task.id];
    if (prevStatus && prevStatus !== info.status) {
      if (info.status === "now" || info.status === "overdue") {
        playAlert(info.status, task.id);
      }
    }
    state.lastStatuses[task.id] = info.status;

    if (filterOverdue && info.status !== "overdue") continue;
    if (filterSoon && info.status !== "soon") continue;

    const card = document.createElement("article");
    card.className = `task-card task-${info.status}`;

    const pulse = document.createElement("div");
    pulse.className = "pulse-ring";
    card.appendChild(pulse);

    const header = document.createElement("div");
    header.className = "task-header";

    const titleWrap = document.createElement("div");
    const titleRow = document.createElement("div");
    titleRow.className = "task-title-row";

    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.name;

    const renameBtn = document.createElement("button");
    renameBtn.className = "btn btn-secondary btn-icon";
    renameBtn.type = "button";
    renameBtn.textContent = "✎";
    renameBtn.title = "Rename task";
    renameBtn.addEventListener("click", () => openRenameEditor(task.id));

    titleRow.appendChild(title);
    titleRow.appendChild(renameBtn);

    const interval = document.createElement("div");
    interval.className = "task-interval";
    interval.textContent = formatInterval(task.intervalMinutes);

    titleWrap.appendChild(titleRow);
    titleWrap.appendChild(interval);

    const chip = document.createElement("span");
    chip.className = `chip-status chip-${info.status}`;
    chip.textContent = info.label;

    header.appendChild(titleWrap);
    header.appendChild(chip);

    const body = document.createElement("div");
    body.className = "task-body";

    const countdownBox = document.createElement("div");
    const countdown = document.createElement("div");
    countdown.className = "countdown";
    countdown.textContent = state.paused
      ? "— — : — — : — —"
      : formatCountdown(info.countdownMs);

    const countdownLabel = document.createElement("div");
    countdownLabel.className = "countdown-label";
    countdownLabel.textContent = info.status === "overdue" ? "Over by" : "Time remaining";

    countdownBox.appendChild(countdown);
    countdownBox.appendChild(countdownLabel);

    const meta = document.createElement("div");
    meta.className = "task-meta";

    const rowLast = document.createElement("div");
    rowLast.className = "meta-row";
    const lastLabel = document.createElement("span");
    lastLabel.className = "meta-label";
    lastLabel.textContent = "Last run";
    const lastValue = document.createElement("span");
    lastValue.className = "meta-value";
    lastValue.textContent = formatTime(task.lastRun ? new Date(task.lastRun) : null);
    rowLast.appendChild(lastLabel);
    rowLast.appendChild(lastValue);

    const rowNext = document.createElement("div");
    rowNext.className = "meta-row";
    const nextLabel = document.createElement("span");
    nextLabel.className = "meta-label";
    nextLabel.textContent = "Next due";
    const nextValue = document.createElement("span");
    nextValue.className = "meta-value";
    nextValue.textContent = info.nextDue ? formatTime(new Date(info.nextDue)) : "after first run";
    rowNext.appendChild(nextLabel);
    rowNext.appendChild(nextValue);

    meta.appendChild(rowLast);
    meta.appendChild(rowNext);

    body.appendChild(countdownBox);
    body.appendChild(meta);

    const footer = document.createElement("div");
    footer.className = "task-footer";

    const footerLeft = document.createElement("div");
    footerLeft.className = "task-footer-left";

    const markBtn = document.createElement("button");
    markBtn.className = "btn btn-secondary btn-small";
    markBtn.textContent = task.lastRun ? "Mark now" : "Mark first run";
    markBtn.addEventListener("click", () => onMarkNow(task.id));

    const moveUpBtn = document.createElement("button");
    moveUpBtn.className = "btn btn-secondary btn-icon";
    moveUpBtn.type = "button";
    moveUpBtn.textContent = "↑";
    moveUpBtn.title = "Move up";
    moveUpBtn.addEventListener("click", () => onMoveTask(task.id, -1));

    const moveDownBtn = document.createElement("button");
    moveDownBtn.className = "btn btn-secondary btn-icon";
    moveDownBtn.type = "button";
    moveDownBtn.textContent = "↓";
    moveDownBtn.title = "Move down";
    moveDownBtn.addEventListener("click", () => onMoveTask(task.id, 1));

    const muteBtn = document.createElement("button");
    muteBtn.className = "btn btn-secondary btn-icon";
    muteBtn.type = "button";
    muteBtn.textContent = task.muted ? "🔇" : "🔈";
    muteBtn.title = task.muted ? "Unmute this task" : "Mute this task";
    muteBtn.addEventListener("click", () => onToggleTaskMute(task.id));

    const linkEditBtn = document.createElement("button");
    linkEditBtn.className = "btn btn-secondary btn-icon";
    linkEditBtn.type = "button";
    linkEditBtn.textContent = "🔗";
    linkEditBtn.title = task.url ? "Edit link" : "Set link";
    linkEditBtn.addEventListener("click", () => openLinkEditor(task.id));

    const openLinkBtn = document.createElement("button");
    openLinkBtn.className = "btn btn-secondary btn-icon";
    openLinkBtn.type = "button";
    openLinkBtn.textContent = "↗";
    openLinkBtn.title = task.url ? "Open link" : "No link set";
    openLinkBtn.disabled = !task.url;
    openLinkBtn.addEventListener("click", () => onOpenTaskLink(task.id));

    footerLeft.appendChild(markBtn);
    footerLeft.appendChild(moveUpBtn);
    footerLeft.appendChild(moveDownBtn);
    footerLeft.appendChild(muteBtn);
    footerLeft.appendChild(linkEditBtn);
    footerLeft.appendChild(openLinkBtn);

    const idPill = document.createElement("span");
    idPill.className = "task-id-pill";
    idPill.textContent = `Task #${task.id}`;

    footer.appendChild(footerLeft);
    footer.appendChild(idPill);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);

    grid.appendChild(card);
  }
}

function ensurePausedOverlay() {
  let el = document.getElementById("paused-overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "paused-overlay";
    el.className = "paused-overlay";
    el.textContent = "Timers paused (counts frozen visually only)";
    document.body.appendChild(el);
  }
  return el;
}

function onMarkNow(taskId) {
  const now = new Date();
  state.tasks = state.tasks.map((t) => (t.id === taskId ? { ...t, lastRun: now.toISOString() } : t));
  saveState();
  renderTasks();
}

function onResetAll() {
  if (!confirm("Reset last run times for all tasks?")) return;
  state.tasks = state.tasks.map((t) => ({ ...t, lastRun: null }));
  saveState();
  renderTasks();
}

function onMoveTask(taskId, delta) {
  const idx = state.tasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return;
  const target = idx + delta;
  if (target < 0 || target >= state.tasks.length) return;
  const copy = state.tasks.slice();
  const [item] = copy.splice(idx, 1);
  copy.splice(target, 0, item);
  state.tasks = copy;
  saveState();
  renderTasks();
}

function onToggleGlobalMute() {
  state.globalMute = !state.globalMute;
  const btn = document.getElementById("btn-mute-all");
  btn.textContent = state.globalMute ? "Unmute All" : "Mute All";
  saveState();
}

function onToggleTaskMute(taskId) {
  state.tasks = state.tasks.map((t) =>
    t.id === taskId ? { ...t, muted: !t.muted } : t
  );
  saveState();
  renderTasks();
}

function onOpenTaskLink(taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || !task.url) return;
  const url = task.url.trim();
  const finalUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  window.open(finalUrl, "_blank", "noopener");
}

function getLinkEditorElements() {
  const container = document.getElementById("link-editor");
  if (!container) return null;
  return {
    container,
    backdropClose: container.querySelectorAll("[data-close-link-editor]"),
    form: document.getElementById("link-editor-form"),
    input: document.getElementById("link-editor-input"),
    taskName: document.getElementById("link-editor-task-name"),
    clearBtn: document.getElementById("link-editor-clear"),
  };
}

function openLinkEditor(taskId) {
  state.linkEditor.taskId = taskId;
  syncLinkEditor();
}

function closeLinkEditor() {
  state.linkEditor.taskId = null;
  syncLinkEditor();
}

function syncLinkEditor() {
  const els = getLinkEditorElements();
  if (!els) return;
  const { container, form, input, taskName } = els;
  const task = state.tasks.find((t) => t.id === state.linkEditor.taskId) || null;

  if (!task) {
    container.setAttribute("aria-hidden", "true");
    container.classList.remove("visible");
    return;
  }

  container.setAttribute("aria-hidden", "false");
  container.classList.add("visible");
  taskName.textContent = task.name;
  input.value = task.url || "";

  const handleSubmit = (ev) => {
    ev.preventDefault();
    const raw = input.value.trim();
    const nextUrl = raw.length ? raw : "";
    state.tasks = state.tasks.map((t) =>
      t.id === task.id ? { ...t, url: nextUrl } : t
    );
    saveState();
    closeLinkEditor();
    renderTasks();
  };

  const handleClear = () => {
    input.value = "";
    state.tasks = state.tasks.map((t) =>
      t.id === task.id ? { ...t, url: "" } : t
    );
    saveState();
    closeLinkEditor();
    renderTasks();
  };

  form.onsubmit = handleSubmit;
  const { clearBtn, backdropClose } = els;
  if (clearBtn) {
    clearBtn.onclick = handleClear;
  }
  backdropClose.forEach((btn) => {
    btn.onclick = () => closeLinkEditor();
  });
}

function getRenameEditorElements() {
  const container = document.getElementById("rename-editor");
  if (!container) return null;
  return {
    container,
    form: document.getElementById("rename-editor-form"),
    input: document.getElementById("rename-editor-input"),
    taskName: document.getElementById("rename-editor-task-name"),
    backdropClose: container.querySelectorAll("[data-close-rename-editor]"),
  };
}

function openRenameEditor(taskId) {
  state.renameEditor.taskId = taskId;
  syncRenameEditor();
}

function closeRenameEditor() {
  state.renameEditor.taskId = null;
  syncRenameEditor();
}

function syncRenameEditor() {
  const els = getRenameEditorElements();
  if (!els) return;
  const { container, form, input, taskName, backdropClose } = els;
  const task = state.tasks.find((t) => t.id === state.renameEditor.taskId) || null;

  if (!task) {
    container.setAttribute("aria-hidden", "true");
    container.classList.remove("visible");
    return;
  }

  container.setAttribute("aria-hidden", "false");
  container.classList.add("visible");
  taskName.textContent = task.name;
  input.value = task.name;
  input.focus();
  input.select();

  form.onsubmit = (ev) => {
    ev.preventDefault();
    const next = input.value.trim();
    if (!next) return;
    state.tasks = state.tasks.map((t) => (t.id === task.id ? { ...t, name: next } : t));
    saveState();
    closeRenameEditor();
    renderTasks();
  };

  backdropClose.forEach((btn) => {
    btn.onclick = () => closeRenameEditor();
  });
}

function onTogglePause() {
  state.paused = !state.paused;
  const btn = document.getElementById("btn-pause");
  btn.textContent = state.paused ? "Resume Timers" : "Pause Timers";
  renderTasks();
}

function setupControls() {
  document.getElementById("btn-reset").addEventListener("click", onResetAll);
  document.getElementById("btn-pause").addEventListener("click", onTogglePause);
  document.getElementById("btn-mute-all").addEventListener("click", onToggleGlobalMute);

  const testBtn = document.getElementById("btn-test-sound");
  if (testBtn) {
    testBtn.addEventListener("click", () => {
      playAlert("now", state.tasks[0]?.id ?? null);
    });
  }

  document.getElementById("filter-overdue-only").addEventListener("change", renderTasks);
  document.getElementById("filter-due-soon-only").addEventListener("change", renderTasks);

  const linkEditor = document.getElementById("link-editor");
  if (linkEditor) {
    linkEditor.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        closeLinkEditor();
      }
    });
  }

  const renameEditor = document.getElementById("rename-editor");
  if (renameEditor) {
    renameEditor.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        closeRenameEditor();
      }
    });
  }
}

function startLoop() {
  renderTasks();
  setInterval(() => {
    if (!state.paused) {
      renderTasks();
    }
  }, 1000);
}

window.addEventListener("DOMContentLoaded", () => {
  initState();
  setupControls();
  startLoop();
});
