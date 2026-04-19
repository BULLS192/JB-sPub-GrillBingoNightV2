
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA9yquHti5JThomh-aVep1DKkgGZG2MpG0",
  authDomain: "jb-bingo.firebaseapp.com",
  projectId: "jb-bingo",
  storageBucket: "jb-bingo.firebasestorage.app",
  messagingSenderId: "912790789766",
  appId: "1:912790789766:web:d44b059b55e448eb9dfb07"
};

const columns = [
  { letter: "B", min: 1, max: 15 },
  { letter: "I", min: 16, max: 30 },
  { letter: "N", min: 31, max: 45 },
  { letter: "G", min: 46, max: 60 },
  { letter: "O", min: 61, max: 75 },
];
const FREE_INDEX = 12;
const STORAGE_KEY = "jb_bingo_tournaments";
const LAST_KEY = "jb_bingo_last_tournament";
const TOURNAMENTS_COLLECTION = "jb_bingo_tournaments";

const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
let app = null;
let db = null;
if (firebaseEnabled) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

const state = {
  remaining: [],
  called: [],
  current: null,
  mode: "random",
  autoMode: false,
  voiceOn: true,
  intervalSec: 5,
  timerId: null,
  patternMode: "preset",
  patterns: [],
  selectedPatternIndex: 0,
  customPattern: Array(25).fill(false),
  lastCallSource: null,
  undoStack: [],
};

state.customPattern[FREE_INDEX] = true;

const els = {
  calledCount: document.getElementById("calledCount"),
  remainingCount: document.getElementById("remainingCount"),
  progressCount: document.getElementById("progressCount"),
  currentCall: document.getElementById("currentCall"),
  historyColumns: document.getElementById("historyColumns"),
  boardGrid: document.getElementById("boardGrid"),
  nextBtn: document.getElementById("nextBtn"),
  autoBtn: document.getElementById("autoBtn"),
  voiceBtn: document.getElementById("voiceBtn"),
  resetBtn: document.getElementById("resetBtn"),
  undoBtn: document.getElementById("undoBtn"),
  newGameBtn: document.getElementById("newGameBtn"),
  speedSlider: document.getElementById("speedSlider"),
  speedValue: document.getElementById("speedValue"),
  lastFive: document.getElementById("lastFive"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  manualModeBtn: document.getElementById("manualModeBtn"),
  randomModeBtn: document.getElementById("randomModeBtn"),
  boardHint: document.getElementById("boardHint"),
  patternGrid: document.getElementById("patternGrid"),
  patternSelect: document.getElementById("patternSelect"),
  patternName: document.getElementById("patternName"),
  presetPatternBtn: document.getElementById("presetPatternBtn"),
  customPatternBtn: document.getElementById("customPatternBtn"),
  randomPatternBtn: document.getElementById("randomPatternBtn"),
  clearPatternBtn: document.getElementById("clearPatternBtn"),
  saveTournamentBtn: document.getElementById("saveTournamentBtn"),
  loadLastBtn: document.getElementById("loadLastBtn"),
  exportPdfBtn: document.getElementById("exportPdfBtn"),
  exportExcelBtn: document.getElementById("exportExcelBtn"),
  saveStatus: document.getElementById("saveStatus"),
  savedTournamentSelect: document.getElementById("savedTournamentSelect"),
  loadSelectedBtn: document.getElementById("loadSelectedBtn"),
  deleteSelectedBtn: document.getElementById("deleteSelectedBtn"),
  savedCount: document.getElementById("savedCount"),
  firebaseStatus: document.getElementById("firebaseStatus"),
  showHistoryBtn: document.getElementById("showHistoryBtn"),
  closeHistoryBtn: document.getElementById("closeHistoryBtn"),
  historyModal: document.getElementById("historyModal"),
  historyModalBody: document.getElementById("historyModalBody"),
  historyModalMeta: document.getElementById("historyModalMeta"),
};

function setFirebaseStatus(text) {
  if (els.firebaseStatus) els.firebaseStatus.textContent = text;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function getLetter(num) {
  if (num <= 15) return "B";
  if (num <= 30) return "I";
  if (num <= 45) return "N";
  if (num <= 60) return "G";
  return "O";
}
function speak(text) {
  if (!state.voiceOn || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}
function indexFromRC(row, col) { return row * 5 + col; }
function makePattern(name, indices) {
  const cells = Array(25).fill(false);
  indices.forEach((i) => { cells[i] = true; });
  cells[FREE_INDEX] = true;
  return { name, cells };
}
function lineRow(r) { return Array.from({ length: 5 }, (_, c) => indexFromRC(r, c)); }
function lineCol(c) { return Array.from({ length: 5 }, (_, r) => indexFromRC(r, c)); }

function generateBasePatterns() {
  const patterns = [];
  patterns.push(makePattern("Horizontal 1", lineRow(0)));
  patterns.push(makePattern("Horizontal 2", lineRow(1)));
  patterns.push(makePattern("Horizontal 3", lineRow(2)));
  patterns.push(makePattern("Horizontal 4", lineRow(3)));
  patterns.push(makePattern("Horizontal 5", lineRow(4)));
  patterns.push(makePattern("Vertical B", lineCol(0)));
  patterns.push(makePattern("Vertical I", lineCol(1)));
  patterns.push(makePattern("Vertical N", lineCol(2)));
  patterns.push(makePattern("Vertical G", lineCol(3)));
  patterns.push(makePattern("Vertical O", lineCol(4)));
  patterns.push(makePattern("Main Diagonal", [0, 6, 12, 18, 24]));
  patterns.push(makePattern("Reverse Diagonal", [4, 8, 12, 16, 20]));
  patterns.push(makePattern("Four Corners", [0, 4, 20, 24]));
  patterns.push(makePattern("Postage Stamp TL", [0, 1, 5, 6]));
  patterns.push(makePattern("Postage Stamp TR", [3, 4, 8, 9]));
  patterns.push(makePattern("Postage Stamp BL", [15, 16, 20, 21]));
  patterns.push(makePattern("Postage Stamp BR", [18, 19, 23, 24]));
  patterns.push(makePattern("Small X Center", [6, 8, 12, 16, 18]));
  patterns.push(makePattern("Large X", [0, 4, 6, 8, 12, 16, 18, 20, 24]));
  patterns.push(makePattern("Plus Sign", [2, 7, 10, 11, 12, 13, 14, 17, 22]));
  patterns.push(makePattern("Diamond", [2, 6, 8, 10, 12, 14, 16, 18, 22]));
  patterns.push(makePattern("Letter T", [0, 1, 2, 3, 4, 7, 12, 17, 22]));
  patterns.push(makePattern("Letter L", [0, 5, 10, 15, 20, 21, 22, 23, 24]));
  patterns.push(makePattern("Letter U", [0, 4, 5, 9, 10, 14, 15, 19, 21, 22, 23]));
  patterns.push(makePattern("Arrow Up", [2, 6, 7, 8, 10, 11, 12, 13, 14]));
  patterns.push(makePattern("Arrow Down", [10, 11, 12, 13, 14, 16, 17, 18, 22]));
  patterns.push(makePattern("Arrow Left", [0, 5, 10, 11, 12, 13, 14, 15, 20]));
  patterns.push(makePattern("Arrow Right", [4, 9, 10, 11, 12, 13, 14, 19, 24]));
  patterns.push(makePattern("Top Hat", [0, 1, 2, 3, 4, 5, 7, 9, 12]));
  patterns.push(makePattern("Bottom Bar", [20, 21, 22, 23, 24, 15, 17, 19, 12]));
  patterns.push(makePattern("Checker Burst", [0, 2, 4, 6, 8, 12, 16, 18, 20, 22, 24]));
  patterns.push(makePattern("Inner Box", [6, 7, 8, 11, 13, 16, 17, 18]));
  patterns.push(makePattern("Outer Box", [0, 1, 2, 3, 4, 5, 9, 10, 14, 15, 19, 20, 21, 22, 23, 24]));
  patterns.push(makePattern("Hourglass", [0, 4, 6, 8, 12, 16, 18, 20, 24]));
  patterns.push(makePattern("Pyramid", [2, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]));
  patterns.push(makePattern("Rocket", [2, 5, 7, 9, 10, 11, 12, 13, 14, 17, 22]));
  patterns.push(makePattern("Center Cross", [7, 11, 12, 13, 17]));
  patterns.push(makePattern("Corners + Center", [0, 4, 12, 20, 24]));
  patterns.push(makePattern("Double Diagonal Lite", [0, 4, 12, 20, 24]));
  return patterns;
}
function randomPatternCells() {
  const cells = Array(25).fill(false);
  cells[FREE_INDEX] = true;
  const count = 7 + Math.floor(Math.random() * 5);
  const pool = Array.from({ length: 25 }, (_, i) => i).filter((i) => i !== FREE_INDEX);
  const picks = shuffle(pool).slice(0, count - 1);
  picks.forEach((i) => { cells[i] = true; });
  if (Math.random() < 0.4) {
    picks.forEach((i) => {
      const r = Math.floor(i / 5);
      const c = i % 5;
      cells[indexFromRC(r, 4 - c)] = true;
    });
  }
  cells[FREE_INDEX] = true;
  return cells;
}
function signature(cells) { return cells.map((v) => (v ? "1" : "0")).join(""); }
function buildPatterns() {
  const patterns = [];
  const seen = new Set();
  generateBasePatterns().forEach((p) => {
    const sig = signature(p.cells);
    if (!seen.has(sig)) { seen.add(sig); patterns.push(p); }
  });
  let n = 1;
  while (patterns.length < 50) {
    const cells = randomPatternCells();
    const sig = signature(cells);
    if (!seen.has(sig)) { seen.add(sig); patterns.push({ name: `Custom Preset ${n}`, cells }); n += 1; }
  }

  const jbCells = [
    false, true,  true,  true,  true,
    false, true,  true,  false, true,
    false, true,  true,  true,  true,
    false, true,  true,  false, true,
    true,  true,  true,  true,  true
  ];
  jbCells[FREE_INDEX] = true;

  const blackoutCells = Array(25).fill(true);
  blackoutCells[FREE_INDEX] = true;

  if (patterns.length >= 38) {
    patterns[36] = { name: "JB", cells: jbCells };
    patterns[37] = { name: "Blackout", cells: blackoutCells };
  }

  return patterns.slice(0, 50);
}

function getActivePatternCells() {
  return state.patternMode === "preset" ? state.patterns[state.selectedPatternIndex].cells : state.customPattern;
}

function getTournamentSnapshot() {
  return {
    name: `JB Bingo ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`,
    savedAt: new Date().toISOString(),
    called: [...state.called],
    current: state.current,
    remaining: [...state.remaining],
    mode: state.mode,
    voiceOn: state.voiceOn,
    intervalSec: state.intervalSec,
    patternMode: state.patternMode,
    selectedPatternIndex: state.selectedPatternIndex,
    customPattern: [...state.customPattern],
    activePatternName: state.patternMode === "preset" ? state.patterns[state.selectedPatternIndex].name : "Custom Pattern",
    activePatternCells: getActivePatternCells(),
    eventLog: [...state.eventLog],
  };
}

function loadLocalTournaments() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveLocalTournaments(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
function setStatus(text) { els.saveStatus.textContent = text; }

async function loadStoredTournaments() {
  if (!firebaseEnabled) return loadLocalTournaments();
  try {
    const q = query(collection(db, TOURNAMENTS_COLLECTION), orderBy("savedAt", "desc"));
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    setFirebaseStatus("Firebase connected. Firestore sync enabled.");
    return list;
  } catch (error) {
    console.error("Firestore load failed, using local fallback.", error);
    setFirebaseStatus("Firebase load failed. Using local browser storage.");
    return loadLocalTournaments();
  }
}

async function persistTournament(snapshot) {
  if (!firebaseEnabled) {
    const all = loadLocalTournaments();
    all.push(snapshot);
    saveLocalTournaments(all);
    localStorage.setItem(LAST_KEY, JSON.stringify(snapshot));
    return snapshot;
  }
  try {
    const ref = await addDoc(collection(db, TOURNAMENTS_COLLECTION), snapshot);
    const saved = { id: ref.id, ...snapshot };
    localStorage.setItem(LAST_KEY, JSON.stringify(saved));
    setFirebaseStatus("Firebase connected. Firestore sync enabled.");
    return saved;
  } catch (error) {
    console.error("Firestore save failed, using local fallback.", error);
    setFirebaseStatus("Firebase save failed. Saved locally instead.");
    const all = loadLocalTournaments();
    all.push(snapshot);
    saveLocalTournaments(all);
    localStorage.setItem(LAST_KEY, JSON.stringify(snapshot));
    return snapshot;
  }
}

async function deleteTournamentByIndex(index) {
  const all = await loadStoredTournaments();
  if (!all.length || Number.isNaN(index) || !all[index]) return null;
  const tournament = all[index];
  if (!firebaseEnabled || !tournament.id) {
    const local = loadLocalTournaments();
    local.splice(index, 1);
    saveLocalTournaments(local);
    return tournament;
  }
  try {
    await deleteDoc(doc(db, TOURNAMENTS_COLLECTION, tournament.id));
    setFirebaseStatus("Firebase connected. Firestore sync enabled.");
    return tournament;
  } catch (error) {
    console.error("Firestore delete failed.", error);
    setFirebaseStatus("Firebase delete failed.");
    return null;
  }
}

async function populateSavedTournamentList() {
  const all = await loadStoredTournaments();
  if (!els.savedTournamentSelect) return;
  els.savedTournamentSelect.innerHTML = "";
  if (!all.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saved tournaments";
    els.savedTournamentSelect.appendChild(option);
    els.savedTournamentSelect.disabled = true;
    if (els.savedCount) els.savedCount.textContent = "0 saved tournaments.";
    if (els.loadSelectedBtn) els.loadSelectedBtn.disabled = true;
    if (els.deleteSelectedBtn) els.deleteSelectedBtn.disabled = true;
    return;
  }
  els.savedTournamentSelect.disabled = false;
  all.forEach((tournament, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    const savedAt = tournament.savedAt ? new Date(tournament.savedAt).toLocaleString() : "";
    option.textContent = `${tournament.name || "Untitled Tournament"}${savedAt ? " — " + savedAt : ""}`;
    els.savedTournamentSelect.appendChild(option);
  });
  if (els.savedCount) els.savedCount.textContent = `${all.length} saved tournament${all.length === 1 ? "" : "s"}.`;
  if (els.loadSelectedBtn) els.loadSelectedBtn.disabled = false;
  if (els.deleteSelectedBtn) els.deleteSelectedBtn.disabled = false;
}

function applyTournamentSnapshot(saved) {
  state.called = Array.isArray(saved.called) ? [...saved.called] : [];
  state.current = saved.current || null;
  state.remaining = Array.isArray(saved.remaining) ? [...saved.remaining] : [];
  state.mode = saved.mode || "random";
  state.voiceOn = Boolean(saved.voiceOn);
  state.intervalSec = Number(saved.intervalSec || 5);
  state.patternMode = saved.patternMode || "preset";
  state.selectedPatternIndex = Number(saved.selectedPatternIndex || 0);
  state.customPattern = Array.isArray(saved.customPattern) ? [...saved.customPattern] : Array(25).fill(false);
  state.customPattern[FREE_INDEX] = true;
  state.lastCallSource = null;
  state.undoStack = [];
  state.eventLog = Array.isArray(saved.eventLog) ? [...saved.eventLog] : [];
  els.speedSlider.value = String(state.intervalSec);
  els.patternSelect.value = String(state.selectedPatternIndex);
  stopAuto();
  renderAll();
}

async function saveTournament() {
  const customName = prompt("Tournament name", `JB Bingo ${new Date().toLocaleString()}`);
  if (customName === null) return;
  const snapshot = getTournamentSnapshot();
  snapshot.name = customName.trim() || snapshot.name;
  const saved = await persistTournament(snapshot);
  await populateSavedTournamentList();
  setStatus(`Saved: ${saved.name}`);
}

function loadLastTournament() {
  const raw = localStorage.getItem(LAST_KEY);
  if (!raw) {
    setStatus("No saved tournament found.");
    return;
  }
  const saved = JSON.parse(raw);
  applyTournamentSnapshot(saved);
  setStatus(`Loaded: ${saved.name || "Last tournament"}`);
}

function exportExcel() {
  const snapshot = getTournamentSnapshot();
  const summaryRows = [
    { Field: "Tournament Name", Value: snapshot.name },
    { Field: "Saved At", Value: snapshot.savedAt },
    { Field: "Current Call", Value: snapshot.current ? `${getLetter(snapshot.current)} ${snapshot.current}` : "" },
    { Field: "Called Count", Value: snapshot.called.length },
    { Field: "Remaining Count", Value: snapshot.remaining.length },
    { Field: "Mode", Value: snapshot.mode },
    { Field: "Pattern Mode", Value: snapshot.patternMode },
    { Field: "Pattern Name", Value: snapshot.activePatternName },
  ];
  const calledRows = snapshot.called.map((n, i) => ({
    Order: i + 1,
    Letter: getLetter(n),
    Number: n,
    Call: `${getLetter(n)}-${n}`,
  }));
  const auditRows = (snapshot.eventLog || []).map((e, i) => ({
    Order: i + 1,
    Timestamp: e.timestamp || "",
    Action: e.action || "",
    Letter: e.number ? getLetter(e.number) : "",
    Number: e.number || "",
    Call: e.number ? `${getLetter(e.number)}-${e.number}` : "",
    Mode: e.mode || "",
  }));
  const patternRows = snapshot.activePatternCells.map((active, index) => ({
    Row: Math.floor(index / 5) + 1,
    Column: (index % 5) + 1,
    Label: index === FREE_INDEX ? "FREE" : "",
    Active: active ? "X" : "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(calledRows), "Called Numbers");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(auditRows), "Audit Log");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(patternRows), "Pattern");
  XLSX.writeFile(wb, `${snapshot.name.replace(/[^a-z0-9-_ ]/gi, "_")}.xlsx`);
  setStatus("Excel exported.");
}

function exportPdf() {
  const snapshot = getTournamentSnapshot();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("JB's Pub & Grill Bingo Night", 14, 18);
  doc.setFontSize(11);
  doc.text(`Tournament: ${snapshot.name}`, 14, 28);
  doc.text(`Saved: ${new Date(snapshot.savedAt).toLocaleString()}`, 14, 35);
  doc.text(`Current Call: ${snapshot.current ? `${getLetter(snapshot.current)} ${snapshot.current}` : "-"}`, 14, 42);
  doc.text(`Pattern: ${snapshot.activePatternName}`, 14, 49);
  doc.text(`Called: ${snapshot.called.length} | Remaining: ${snapshot.remaining.length}`, 14, 56);

  const calledRows = snapshot.called.map((n, i) => [String(i + 1), getLetter(n), String(n), `${getLetter(n)}-${n}`]);
  doc.autoTable({
    startY: 64,
    head: [["Order", "Letter", "Number", "Call"]],
    body: calledRows.length ? calledRows : [["", "", "", "No numbers called yet"]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [23, 45, 100] }
  });

  const auditRows = (snapshot.eventLog || []).map((e, i) => [
    String(i + 1),
    e.timestamp ? new Date(e.timestamp).toLocaleString() : "",
    e.action || "",
    e.number ? `${getLetter(e.number)}-${e.number}` : "",
    e.mode || ""
  ]);
  let afterAuditY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : 80;
  doc.text("Audit Log", 14, afterAuditY);
  doc.autoTable({
    startY: afterAuditY + 4,
    head: [["#", "Date / Time", "Action", "Call", "Mode"]],
    body: auditRows.length ? auditRows : [["", "", "", "No logged events", ""]],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [23, 45, 100] }
  });

  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : 80;
  doc.text("Pattern Grid", 14, finalY);
  const cellSize = 12;
  const startX = 14;
  const startY = finalY + 6;
  snapshot.activePatternCells.forEach((active, idx) => {
    const row = Math.floor(idx / 5);
    const col = idx % 5;
    const x = startX + col * cellSize;
    const y = startY + row * cellSize;
    if (active) {
      doc.setFillColor(255, 199, 102);
      doc.rect(x, y, cellSize, cellSize, "F");
    } else {
      doc.setDrawColor(120, 120, 120);
      doc.rect(x, y, cellSize, cellSize);
    }
    if (idx === FREE_INDEX) {
      doc.setFontSize(6);
      doc.text("FREE", x + 2, y + 7);
      doc.setFontSize(11);
    }
  });

  doc.save(`${snapshot.name.replace(/[^a-z0-9-_ ]/gi, "_")}.pdf`);
  setStatus("PDF exported.");
}


function pushEvent(action, number = null, mode = "") {
  state.eventLog.push({
    timestamp: new Date().toISOString(),
    action,
    number,
    mode
  });
}

function renderHistoryModal() {
  const events = state.eventLog || [];
  els.historyModalBody.innerHTML = "";
  els.historyModalMeta.textContent = events.length
    ? `${events.length} event(s) recorded from first action to latest action.`
    : "No events yet.";
  if (!events.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5">No history recorded yet.</td>`;
    els.historyModalBody.appendChild(tr);
    return;
  }
  events.forEach((e, i) => {
    const tr = document.createElement("tr");
    const callText = e.number ? `${getLetter(e.number)}-${e.number}` : "—";
    const actionClass = e.action === "UNDO" ? "history-action-undo" : "history-action-call";
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${e.timestamp ? new Date(e.timestamp).toLocaleString() : ""}</td>
      <td class="${actionClass}">${e.action || ""}</td>
      <td>${callText}</td>
      <td>${e.mode || ""}</td>
    `;
    els.historyModalBody.appendChild(tr);
  });
}

function openHistoryModal() {
  renderHistoryModal();
  els.historyModal.classList.remove("hidden");
}

function closeHistoryModal() {
  els.historyModal.classList.add("hidden");
}

function setupBoard() {
  els.boardGrid.innerHTML = "";
  els.historyColumns.innerHTML = "";
  columns.forEach((col) => {
    const boardCol = document.createElement("div");
    boardCol.className = "board-column";
    const boardLetter = document.createElement("div");
    boardLetter.className = "board-letter";
    boardLetter.textContent = col.letter;
    boardCol.appendChild(boardLetter);
    const listEl = document.createElement("div");
    listEl.className = "number-list";
    for (let n = col.min; n <= col.max; n += 1) {
      const tile = document.createElement("button");
      tile.className = "number-tile";
      tile.id = `tile-${n}`;
      tile.type = "button";
      tile.textContent = String(n);
      tile.addEventListener("click", () => {
        if (state.mode !== "manual" || state.autoMode || state.called.includes(n)) return;
        drawSpecificNumber(n, "manual");
      });
      listEl.appendChild(tile);
    }
    boardCol.appendChild(listEl);
    els.boardGrid.appendChild(boardCol);

    const historyCol = document.createElement("div");
    historyCol.className = "history-column";
    historyCol.innerHTML = `<div class="history-letter">${col.letter}</div><div class="history-list" id="history-${col.letter}"></div>`;
    els.historyColumns.appendChild(historyCol);
  });
}
function setupPatternGrid() {
  els.patternGrid.innerHTML = "";
  for (let i = 0; i < 25; i += 1) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "pattern-cell";
    cell.addEventListener("click", () => {
      if (state.patternMode !== "custom" || i === FREE_INDEX) return;
      state.customPattern[i] = !state.customPattern[i];
      renderPatternGrid();
    });
    els.patternGrid.appendChild(cell);
  }
}
function populatePatternSelect() {
  els.patternSelect.innerHTML = "";
  state.patterns.forEach((pattern, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${String(index + 1).padStart(2, "0")} - ${pattern.name}`;
    els.patternSelect.appendChild(option);
  });
  els.patternSelect.value = String(state.selectedPatternIndex);
}
function renderCurrent() {
  if (!state.current) {
    els.currentCall.innerHTML = `<div class="placeholder">Ready</div><div class="placeholder-sub">Choose a mode to begin</div>`;
    return;
  }
  els.currentCall.innerHTML = `<span class="call-letter">${getLetter(state.current)}</span><span class="call-number">${state.current}</span>`;
}
function renderStats() {
  els.calledCount.textContent = `${state.called.length} / 75`;
  els.remainingCount.textContent = String(state.remaining.length);
  els.progressCount.textContent = `${Math.round((state.called.length / 75) * 100)}%`;
  els.speedValue.textContent = String(state.intervalSec);
  els.voiceBtn.textContent = `Voice: ${state.voiceOn ? "On" : "Off"}`;
  els.autoBtn.textContent = state.autoMode ? "Pause Auto" : "Start Auto";
  els.nextBtn.disabled = state.remaining.length === 0 || state.mode !== "random" || state.autoMode;
  els.autoBtn.disabled = state.remaining.length === 0;
  els.undoBtn.disabled = !(state.mode === "manual" && !state.autoMode && state.undoStack.length > 0);
  els.manualModeBtn.classList.toggle("active", state.mode === "manual" && !state.autoMode);
  els.randomModeBtn.classList.toggle("active", state.mode === "random" && !state.autoMode);
  els.autoBtn.classList.toggle("active", state.autoMode);
  els.boardHint.textContent = state.autoMode ? "Auto mode" : state.mode === "manual" ? "Manual mode: click board numbers" : "Random mode";
}
function renderHistory() {
  columns.forEach((col) => {
    const container = document.getElementById(`history-${col.letter}`);
    const nums = state.called.filter((n) => n >= col.min && n <= col.max);
    container.innerHTML = "";
    if (nums.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-pill";
      empty.textContent = "—";
      container.appendChild(empty);
      return;
    }
    nums.forEach((n) => {
      const pill = document.createElement("div");
      pill.className = "history-pill";
      pill.textContent = String(n);
      container.appendChild(pill);
    });
  });
}
function renderBoard() {
  for (let n = 1; n <= 75; n += 1) {
    const tile = document.getElementById(`tile-${n}`);
    tile.classList.remove("called", "current", "available-manual");
    if (state.called.includes(n)) tile.classList.add("called");
    if (state.current === n) tile.classList.add("current");
    if (state.mode === "manual" && !state.autoMode && !state.called.includes(n)) {
      tile.classList.add("available-manual");
      tile.title = `Click to call ${getLetter(n)} ${n}`;
    } else {
      tile.title = "";
    }
  }
}
function renderLastFive() {
  els.lastFive.innerHTML = "";
  const lastFive = state.called.slice(-5).reverse();
  for (let i = 0; i < 5; i += 1) {
    const item = document.createElement("div");
    item.className = "last-chip";
    item.textContent = lastFive[i] ? `${getLetter(lastFive[i])}-${lastFive[i]}` : "—";
    els.lastFive.appendChild(item);
  }
}
function renderPatternGrid() {
  const activeCells = getActivePatternCells();
  Array.from(els.patternGrid.children).forEach((cell, index) => {
    cell.classList.toggle("active", Boolean(activeCells[index]));
    cell.classList.toggle("free", index === FREE_INDEX);
    cell.classList.toggle("custom-enabled", state.patternMode === "custom" && index !== FREE_INDEX);
    cell.textContent = index === FREE_INDEX ? "FREE" : activeCells[index] ? "X" : "";
  });
  els.patternName.textContent = state.patternMode === "preset"
    ? `Pattern ${state.selectedPatternIndex + 1} of ${state.patterns.length}: ${state.patterns[state.selectedPatternIndex].name}`
    : "Custom pattern mode: click any squares to build a unique winning layout.";
  els.patternSelect.disabled = state.patternMode !== "preset";
  els.randomPatternBtn.disabled = state.patternMode !== "preset";
  els.clearPatternBtn.disabled = state.patternMode !== "custom";
  els.presetPatternBtn.classList.toggle("active", state.patternMode === "preset");
  els.customPatternBtn.classList.toggle("active", state.patternMode === "custom");
}
function updateRemainingPool() {
  state.remaining = shuffle(Array.from({ length: 75 }, (_, i) => i + 1).filter((n) => !state.called.includes(n)));
}
function drawSpecificNumber(num, source = null) {
  if (state.called.includes(num)) return;
  if (source === "manual") state.undoStack.push(num);
  else state.undoStack = [];
  state.current = num;
  state.called.push(num);
  state.remaining = state.remaining.filter((n) => n !== num);
  state.lastCallSource = source;
  pushEvent("CALL", num, source || "");
  speak(`${getLetter(num)} ${num}`);
  renderAll();
}
function callNextRandom(source = "random") {
  if (state.remaining.length === 0) return;
  drawSpecificNumber(state.remaining[0], source);
}
function undoLastManualCall() {
  if (!(state.mode === "manual" && !state.autoMode && state.undoStack.length > 0)) return;
  const removed = state.undoStack.pop();
  const calledIndex = state.called.lastIndexOf(removed);
  if (calledIndex === -1) return;
  state.called.splice(calledIndex, 1);
  state.remaining.push(removed);
  state.remaining.sort((a, b) => a - b);
  state.current = state.called.length ? state.called[state.called.length - 1] : null;
  state.lastCallSource = state.undoStack.length ? "manual" : null;
  pushEvent("UNDO", removed, "manual");
  renderAll();
  setStatus(`Undid manual call: ${getLetter(removed)} ${removed}`);
}
function setMode(mode) {
  if (state.autoMode) stopAuto();
  state.mode = mode;
  renderAll();
}
function startAuto() {
  if (state.remaining.length === 0) return;
  state.autoMode = true;
  state.mode = "random";
  if (state.timerId) window.clearInterval(state.timerId);
  state.timerId = window.setInterval(() => {
    if (state.remaining.length === 0) { stopAuto(); return; }
    callNextRandom("auto");
  }, state.intervalSec * 1000);
  renderAll();
}
function stopAuto() {
  state.autoMode = false;
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
  renderAll();
}
function resetGame() {
  const ok = window.confirm("Reset this game? This clears the current board and call history.");
  if (!ok) return;
  stopAuto();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  state.called = [];
  state.current = null;
  state.lastCallSource = null;
  state.undoStack = [];
  state.eventLog = [];
  updateRemainingPool();
  renderAll();
  setStatus("Game reset.");
}
async function startFreshGame() {
  const shouldSave = state.called.length > 0 || state.current !== null;
  if (shouldSave) {
    const snapshot = await persistTournament(getTournamentSnapshot());
    setStatus(`Saved current tournament and started a new game: ${snapshot.name}`);
  } else {
    setStatus("Started a new blank game.");
  }
  await populateSavedTournamentList();
  stopAuto();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  state.called = [];
  state.current = null;
  state.lastCallSource = null;
  state.undoStack = [];
  state.eventLog = [];
  updateRemainingPool();
  renderAll();
}
async function loadSelectedTournament() {
  const index = Number(els.savedTournamentSelect.value);
  const all = await loadStoredTournaments();
  if (!all.length || Number.isNaN(index) || !all[index]) {
    setStatus("No saved tournament selected.");
    return;
  }
  applyTournamentSnapshot(all[index]);
  localStorage.setItem(LAST_KEY, JSON.stringify(all[index]));
  setStatus(`Loaded: ${all[index].name || "Selected tournament"}`);
}
async function deleteSelectedTournament() {
  const index = Number(els.savedTournamentSelect.value);
  const all = await loadStoredTournaments();
  if (!all.length || Number.isNaN(index) || !all[index]) {
    setStatus("No saved tournament selected.");
    return;
  }
  const name = all[index].name || "Selected tournament";
  const ok = window.confirm(`Delete saved tournament "${name}"?`);
  if (!ok) return;
  const deleted = await deleteTournamentByIndex(index);
  await populateSavedTournamentList();
  if (deleted) setStatus(`Deleted: ${name}`);
}

function renderAll() {
  renderCurrent();
  renderStats();
  renderHistory();
  renderBoard();
  renderLastFive();
  renderPatternGrid();
}

els.nextBtn.addEventListener("click", () => callNextRandom("random"));
els.autoBtn.addEventListener("click", () => state.autoMode ? stopAuto() : startAuto());
els.voiceBtn.addEventListener("click", () => { state.voiceOn = !state.voiceOn; renderStats(); });
els.resetBtn.addEventListener("click", resetGame);
els.undoBtn.addEventListener("click", undoLastManualCall);
els.newGameBtn.addEventListener("click", startFreshGame);
els.speedSlider.addEventListener("input", (e) => {
  state.intervalSec = Number(e.target.value);
  renderStats();
  if (state.autoMode) startAuto();
});
els.fullscreenBtn.addEventListener("click", async () => {
  if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  else await document.exitFullscreen();
});
els.manualModeBtn.addEventListener("click", () => setMode("manual"));
els.randomModeBtn.addEventListener("click", () => setMode("random"));
els.patternSelect.addEventListener("change", (e) => {
  state.selectedPatternIndex = Number(e.target.value);
  renderPatternGrid();
});
els.presetPatternBtn.addEventListener("click", () => { state.patternMode = "preset"; renderPatternGrid(); });
els.customPatternBtn.addEventListener("click", () => { state.patternMode = "custom"; renderPatternGrid(); });
els.randomPatternBtn.addEventListener("click", () => {
  state.selectedPatternIndex = Math.floor(Math.random() * state.patterns.length);
  els.patternSelect.value = String(state.selectedPatternIndex);
  renderPatternGrid();
});
els.clearPatternBtn.addEventListener("click", () => {
  state.customPattern = Array(25).fill(false);
  state.customPattern[FREE_INDEX] = true;
  renderPatternGrid();
});
els.saveTournamentBtn.addEventListener("click", saveTournament);
els.loadLastBtn.addEventListener("click", loadLastTournament);
els.exportPdfBtn.addEventListener("click", exportPdf);
els.exportExcelBtn.addEventListener("click", exportExcel);
els.loadSelectedBtn.addEventListener("click", loadSelectedTournament);
els.deleteSelectedBtn.addEventListener("click", deleteSelectedTournament);
els.showHistoryBtn.addEventListener("click", openHistoryModal);
els.closeHistoryBtn.addEventListener("click", closeHistoryModal);
els.historyModal.addEventListener("click", (e) => { if (e.target.classList.contains("history-modal-backdrop")) closeHistoryModal(); });

async function init() {
  state.patterns = buildPatterns();
  populatePatternSelect();
  setupBoard();
  setupPatternGrid();
  updateRemainingPool();
  renderAll();
  setFirebaseStatus(firebaseEnabled ? "Connecting to Firebase..." : "Firebase not configured. Using local browser storage.");
  await populateSavedTournamentList();
  const saved = await loadStoredTournaments();
  setStatus(saved.length ? `${saved.length} tournament save(s) available.` : "No tournament saved yet.");
}
init();
