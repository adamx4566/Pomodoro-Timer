const display = document.getElementById("display");
const startPauseBtn = document.getElementById("startPauseBtn");
const resetBtn = document.getElementById("resetBtn");
const skipBtn = document.getElementById("skipBtn");

const phaseLabel = document.getElementById("phaseLabel");
const cycleCountEl = document.getElementById("cycleCount");

const modeButtons = document.querySelectorAll(".mode-btn");

const workInput = document.getElementById("workInput");
const shortInput = document.getElementById("shortInput");
const longInput = document.getElementById("longInput");
const cyclesInput = document.getElementById("cyclesInput");
const autoStart = document.getElementById("autoStart");
const soundToggle = document.getElementById("soundToggle");
const applyBtn = document.getElementById("applyBtn");
const saveBtn = document.getElementById("saveBtn");

const DEFAULTS = {
  work: 25,
  short: 5,
  long: 15,
  cycles: 4,
  autoStart: true,
  sound: true
};

let config = loadConfig();
let phase = "work";
let remaining = mmToMs(config.work);
let timer = null;
let running = false;
let completedWorkCycles = 0;

renderTime(remaining);
updatePhaseUI();
updateCycleUI();

startPauseBtn.addEventListener("click", onStartPause);
resetBtn.addEventListener("click", onReset);
skipBtn.addEventListener("click", () => endPhase(true));

modeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const m = btn.dataset.mode;
    switchMode(m);
  });
});

applyBtn.addEventListener("click", () => {
  readSettingsIntoConfig(false);
  if (phase === "work") setRemaining(mmToMs(config.work));
  if (phase === "short") setRemaining(mmToMs(config.short));
  if (phase === "long") setRemaining(mmToMs(config.long));
});

saveBtn.addEventListener("click", () => {
  readSettingsIntoConfig(true);
  flashButton(saveBtn);
});

document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === " ") { e.preventDefault(); onStartPause(); }
  if (k === "r") { onReset(); }
  if (k === "n") { endPhase(true); }
});

function onStartPause(){
  if (running) {
    clearInterval(timer);
    timer = null;
    running = false;
    startPauseBtn.textContent = "Start";
  } else {
    const target = Date.now() + remaining;
    timer = setInterval(() => {
      const left = target - Date.now();
      if (left <= 0) {
        clearInterval(timer);
        timer = null;
        running = false;
        renderTime(0);
        chime();
        endPhase(false);
      } else {
        remaining = left;
        renderTime(left);
      }
    }, 200);
    running = true;
    startPauseBtn.textContent = "Pause";
  }
}

function onReset(){
  clearInterval(timer);
  timer = null;
  running = false;
  startPauseBtn.textContent = "Start";
  if (phase === "work") setRemaining(mmToMs(config.work));
  if (phase === "short") setRemaining(mmToMs(config.short));
  if (phase === "long") setRemaining(mmToMs(config.long));
}

function endPhase(skipped){
  if (phase === "work" && !skipped) {
    completedWorkCycles++;
    updateCycleUI();
  }

  if (phase === "work") {
    if (completedWorkCycles > 0 && completedWorkCycles % config.cycles === 0) {
      switchMode("long");
    } else {
      switchMode("short");
    }
  } else {
    switchMode("work");
  }

  if (config.autoStart) onStartPause();
}

function switchMode(next){
  phase = next;
  modeButtons.forEach(b => b.classList.toggle("active", b.dataset.mode === next));
  updatePhaseUI();

  if (next === "work") setRemaining(mmToMs(config.work));
  if (next === "short") setRemaining(mmToMs(config.short));
  if (next === "long") setRemaining(mmToMs(config.long));
  startPauseBtn.textContent = "Start";
  clearInterval(timer);
  timer = null;
  running = false;
}

function renderTime(ms){
  const totalSec = Math.max(0, Math.round(ms/1000));
  const m = Math.floor(totalSec/60).toString().padStart(2,"0");
  const s = (totalSec%60).toString().padStart(2,"0");
  display.textContent = `${m}:${s}`;
}

function setRemaining(ms){
  remaining = ms;
  renderTime(ms);
}

function updatePhaseUI(){
  const label = phase === "work" ? "Work" : phase === "short" ? "Short Break" : "Long Break";
  phaseLabel.textContent = label;
}

function updateCycleUI(){
  cycleCountEl.textContent = completedWorkCycles.toString();
}

function mmToMs(min){ return Math.max(0, Number(min)||0) * 60 * 1000; }

function readSettingsIntoConfig(persist){
  const next = {
    work: clampNum(workInput.value,1,120),
    short: clampNum(shortInput.value,1,60),
    long: clampNum(longInput.value,1,90),
    cycles: clampNum(cyclesInput.value,1,12),
    autoStart: !!autoStart.checked,
    sound: !!soundToggle.checked
  };
  config = next;
  if (persist) saveConfig(config);
}

function clampNum(v,min,max){
  const n = Math.floor(Number(v)||0);
  return Math.min(max, Math.max(min, n));
}

function loadConfig(){
  try {
    const raw = localStorage.getItem("pomodoro_config");
    if (!raw) return {...DEFAULTS};
    const parsed = JSON.parse(raw);
    const cfg = {...DEFAULTS, ...parsed};
    initSettingsUI(cfg);
    return cfg;
  } catch {
    initSettingsUI(DEFAULTS);
    return {...DEFAULTS};
  }
}

function saveConfig(cfg){
  localStorage.setItem("pomodoro_config", JSON.stringify(cfg));
}

function initSettingsUI(cfg){
  workInput.value = cfg.work;
  shortInput.value = cfg.short;
  longInput.value  = cfg.long;
  cyclesInput.value = cfg.cycles;
  autoStart.checked = cfg.autoStart;
  soundToggle.checked = cfg.sound;
}

function flashButton(btn){
  const prev = btn.textContent;
  btn.textContent = "Saved";
  setTimeout(()=>btn.textContent = prev, 900);
}

function chime(){
  if (!config.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.55);
  } catch {}
}
