// ============================
// Shared: Game Picker Navigation
// ============================
function showGame(which) {
  document.getElementById("gamePicker").classList.add("hidden");
  document.getElementById("numbersGame").classList.add("hidden");
  document.getElementById("recallGame").classList.add("hidden");

  if (which === "numbers") document.getElementById("numbersGame").classList.remove("hidden");
  if (which === "recall") { document.getElementById("recallGame").classList.remove("hidden"); applyRecallDifficulty();
  const customWrap = $("recallCustomControls");
  if (customWrap) customWrap.classList.add("hidden"); }
}

function backToPicker() {
  // Stop timers from either game
  closeModal();
  if (numberGameState.activeTimeout) clearTimeout(numberGameState.activeTimeout);
  if (numberGameState.progressStopper) numberGameState.progressStopper();
  if (numberGameState.activeInterval) clearInterval(numberGameState.activeInterval);
  if (recallState.activeTimeout) clearTimeout(recallState.activeTimeout);
  if (recallState.progressStopper) recallState.progressStopper();
  if (recallState.activeInterval) clearInterval(recallState.activeInterval);

  document.getElementById("numbersGame").classList.add("hidden");
  document.getElementById("recallGame").classList.add("hidden");
  document.getElementById("gamePicker").classList.remove("hidden");
}

// ============================
// UI Helpers (Toast, Modal, Progress)
// ============================
const ui = {
  toastTimer: null,
  modalTimer: null,
};

function $(id) { return document.getElementById(id); }

function showToast(message, ms = 900) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  if (ui.toastTimer) clearTimeout(ui.toastTimer);
  ui.toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

function openModal({ title = "Result", bodyHTML = "", primaryText = "Next Round", onPrimary = null, autoCloseMs = null } = {}) {
  const modal = $("resultModal");
  const titleEl = $("modalTitle");
  const bodyEl = $("modalBody");
  const primary = $("modalPrimary");
  const closeBtn = $("modalClose");
  if (!modal || !titleEl || !bodyEl || !primary || !closeBtn) return;

  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHTML;
  primary.textContent = primaryText;

  const close = () => closeModal();

  closeBtn.onclick = close;

  // For success modals, require using the primary button
  const isSuccess = String(title).includes("Correct");
  closeBtn.style.display = isSuccess ? "none" : "";
  modal.onclick = (e) => { /* click outside disabled */ };

  primary.onclick = () => {
    close();
    if (typeof onPrimary === "function") onPrimary();
  };

  modal.classList.remove("hidden");

  if (ui.modalTimer) clearTimeout(ui.modalTimer);
  if (autoCloseMs) {
    ui.modalTimer = setTimeout(() => {
      close();
      if (typeof onPrimary === "function") onPrimary();
    }, autoCloseMs);
  }
}

function closeModal() {
  const modal = $("resultModal");
  if (!modal) return;
  modal.classList.add("hidden");
  if (ui.modalTimer) clearTimeout(ui.modalTimer);
  ui.modalTimer = null;
}

function setProgress(barEl, pct) {
  if (!barEl) return;
  const clamped = Math.max(0, Math.min(100, pct));
  barEl.style.width = clamped + "%";
}

function runProgress(barEl, durationMs, { phase = "show" } = {}) {
  if (!barEl) return () => {};
  // style phase
  barEl.classList.toggle("hide-phase", phase === "hide");
  setProgress(barEl, 0);

  const start = performance.now();
  const interval = setInterval(() => {
    const elapsed = performance.now() - start;
    const pct = (elapsed / durationMs) * 100;
    setProgress(barEl, pct);
    if (elapsed >= durationMs) {
      clearInterval(interval);
      setProgress(barEl, 100);
    }
  }, 50);

  return () => {
    clearInterval(interval);
    setProgress(barEl, 0);
    barEl.classList.remove("hide-phase");
  };
}


// ============================
// GAME 1: Number Game
// ============================
const numberGameState = {
  generatedItems: [],
  activeTimeout: null,
  activeInterval: null,
  correctCounter: 0,
  incorrectCounter: 0,
  streak: 0,
  bestStreak: 0,
  progressStopper: null,
};

function getRandomWord() {
  const words = [
    "time","year","people","way","day","man","thing","woman","life","child",
    "world","school","state","family","student","group","country","problem","hand",
    "part","place","case","week","company","system","program","question","work",
    "government","number","night","point","home","water","room","mother","area",
    "money","story","fact","month","lot","right","study","book","eye","job",
    "word","business","issue","side","kind","head","house","service","friend",
    "father","power","hour","game","line","end","member","law","car","city",
    "community","name","president","team","minute","idea","kid","body","information",
    "back","parent","face","others","level","office","door","health","person",
    "art","war","history","party","result","change","morning","reason","research",
    "girl","guy","moment","air","teacher","force","education","foot","industry",
    "future","plan","culture","action","sense","aspect","period","subject",
    "theory","matter","population","rate","test","relationship",
    "song","market","ring","duty","role","source","film","land",
    "class","age","scene","task","heart","trust","dream","path",
    "surface","court","voice","stage","space","type","front","fun","bed","police",
    "arm","plane","ship","basis","waste","ability"
  ];
  return words[Math.floor(Math.random() * words.length)];
}

function startNumberGame() {
  closeModal();
  if (numberGameState.progressStopper) numberGameState.progressStopper();
  if (numberGameState.activeTimeout) clearTimeout(numberGameState.activeTimeout);
  if (numberGameState.progressStopper) numberGameState.progressStopper();
  if (numberGameState.activeInterval) clearInterval(numberGameState.activeInterval);

  const type = document.getElementById("type").value;
  const quantity = parseInt(document.getElementById("quantity").value, 10);
  const duration = parseInt(document.getElementById("duration").value, 10) * 1000;

  numberGameState.generatedItems = [];

  for (let i = 0; i < quantity; i++) {
    if (type === "numbers") {
      numberGameState.generatedItems.push((Math.floor(Math.random() * 90) + 10).toString());
    } else if (type === "words") {
      numberGameState.generatedItems.push(getRandomWord());
    } else {
      const choice = Math.random() < 0.5 ? "number" : "word";
      numberGameState.generatedItems.push(
        choice === "number"
          ? (Math.floor(Math.random() * 90) + 10).toString()
          : getRandomWord()
      );
    }
  }

  let countdownTime = 3;
  document.getElementById("displayArea").innerText = "Starting in: " + countdownTime;
  setProgress($("numberProgress"), 0);

  numberGameState.activeInterval = setInterval(() => {
    countdownTime--;
    if (countdownTime > 0) {
      document.getElementById("displayArea").innerText = "Starting in: " + countdownTime;
  setProgress($("numberProgress"), 0);
    } else {
      clearInterval(numberGameState.activeInterval);
      document.getElementById("displayArea").innerText = numberGameState.generatedItems.join(", ");

      // progress for the visible phase
      if (numberGameState.progressStopper) numberGameState.progressStopper();
      numberGameState.progressStopper = runProgress($("numberProgress"), duration, { phase: "show" });

      numberGameState.activeTimeout = setTimeout(() => {
        if (numberGameState.progressStopper) numberGameState.progressStopper();
        document.getElementById("displayArea").innerText = "Now, try to remember!";
        createNumberInputs(quantity);
      }, duration);
    }
  }, 1000);
}

function createNumberInputs(quantity) {
  const inputArea = document.getElementById("inputArea");
  inputArea.innerHTML = "";

  for (let i = 0; i < quantity; i++) {
    const inputBox = document.createElement("input");
    inputBox.type = "text";
    inputBox.id = "box" + i;
    inputArea.appendChild(inputBox);

    if (document.getElementById("type").value === "numbers") {
      inputBox.addEventListener("input", function () {
        if (this.value.length === 2) {
          if (i < quantity - 1) {
            document.getElementById("box" + (i + 1)).focus();
          } else {
            document.querySelector(".check-btn").focus();
          }
        }
      });
    }
  }

  const submitButton = document.createElement("button");
  submitButton.innerText = "Check Answers";
  submitButton.onclick = checkNumberAnswers;
  submitButton.classList.add("check-btn");
  inputArea.appendChild(submitButton);

  document.getElementById("box0").focus();
}

function checkNumberAnswers() {
  let correct = true;

  for (let i = 0; i < numberGameState.generatedItems.length; i++) {
    const inputValue = document.getElementById("box" + i).value;
    if (inputValue !== numberGameState.generatedItems[i]) {
      correct = false;
      break;
    }
  }

  if (correct) {
    numberGameState.correctCounter++;
    numberGameState.streak++;
    numberGameState.bestStreak = Math.max(numberGameState.bestStreak, numberGameState.streak);

    document.getElementById("correctCount").innerText = "Correct: " + numberGameState.correctCounter;
    document.getElementById("numberStreak").innerText = "Streak: " + numberGameState.streak;
    document.getElementById("numberBestStreak").innerText = "Best: " + numberGameState.bestStreak;

    openModal({
      title: "✅ Correct",
      bodyHTML: `<p><b>Nice!</b> Ready for the next round?</p>`,
      primaryText: "Next Round",
      onPrimary: () => startNumberGame()
    });
} else {
    numberGameState.incorrectCounter++;
    numberGameState.streak = 0;

    document.getElementById("incorrectCount").innerText = "Incorrect: " + numberGameState.incorrectCounter;
    document.getElementById("numberStreak").innerText = "Streak: 0";
    document.getElementById("numberBestStreak").innerText = "Best: " + numberGameState.bestStreak;

    const body = `
      <p><b>Wrong.</b> Here's the correct sequence:</p>
      <div class="chip-row">
        ${numberGameState.generatedItems.map(w => `<span class="chip">${w}</span>`).join("")}
      </div>
    `;

    openModal({
      title: "❌ Incorrect",
      bodyHTML: body,
      primaryText: "Next Round",
      onPrimary: () => startNumberGame(),
      autoCloseMs: 4000
    });
  }
}

// ============================
// GAME 2: Word Recall (20 tile selection, ordered)
// ============================

const recallState = {
  nouns: [],
  activeTimeout: null,
  activeInterval: null,
  generatedWords: [],
  correctCounter: 0,
  incorrectCounter: 0,
  streak: 0,
  bestStreak: 0,
  progressStopper: null,

  // choice-mode state
  selectedWords: [],
  selectedButtons: [],
  choices: [],
};

// ============================
// Word Recall Difficulty Levels
// ============================
const recallLevels = {
  easy:       { quantity: 4, showSec: 5 },
  normal:     { quantity: 5, showSec: 6 },
  tough:      { quantity: 6, showSec: 7 },
  hard:       { quantity: 7, showSec: 8 },
  veryhard:   { quantity: 8, showSec: 9 },
  extreme:    { quantity: 9, showSec: 10 },
  impossible: { quantity: 10, showSec: 11 },
};

function applyRecallDifficulty() {
  const levelEl = $("recallDifficulty");
  const qtyEl = $("recallQuantity");
  const showEl = $("recallShow");
  const hideEl = $("recallHide");
  const customWrap = $("recallCustomControls");
  const startBtn = $("startRecallBtn");

  if (!levelEl) return;

  const level = levelEl.value;

  // If user hasn't chosen yet
  if (!level) {
    if (customWrap) customWrap.classList.add("hidden");
    if (startBtn) startBtn.disabled = true;
    if (qtyEl) qtyEl.disabled = true;
    if (showEl) showEl.disabled = true;
    if (hideEl) hideEl.disabled = true;
    return;
  }

  // Custom mode: show controls + allow editing
  if (level === "custom") {
    if (customWrap) customWrap.classList.remove("hidden");
    if (startBtn) startBtn.disabled = false;
    if (qtyEl) qtyEl.disabled = false;
    if (showEl) showEl.disabled = false;
    if (hideEl) hideEl.disabled = false;
    return;
  }

  // Preset level: set quantity/show, hide custom controls
  const preset = recallLevels[level];
  if (preset) {
    if (qtyEl) qtyEl.value = String(preset.quantity);
    if (showEl) showEl.value = String(preset.showSec);
  }

  if (customWrap) customWrap.classList.add("hidden");
  if (startBtn) startBtn.disabled = false;

  // Keep selects disabled so they can't be changed via keyboard
  if (qtyEl) qtyEl.disabled = true;
  if (showEl) showEl.disabled = true;
  if (hideEl) hideEl.disabled = true;
}



function normalizeWord(s) {
  return (s || "").trim().toLowerCase();
}

async function loadNounsIfNeeded() {
  if (recallState.nouns.length > 0) return;

  // Try to load nouns.txt from the same folder as the HTML
  try {
    const resp = await fetch("nouns.txt", { cache: "no-store" });
    if (!resp.ok) throw new Error("HTTP " + resp.status);

    const text = await resp.text();
    const lines = text
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);

    // De-dup + normalize casing on load (keeps original word shape, but de-dups case-insensitively)
    const seen = new Set();
    const cleaned = [];
    for (const w of lines) {
      const n = normalizeWord(w);
      if (!n) continue;
      if (seen.has(n)) continue;
      seen.add(n);
      cleaned.push(w);
    }

    if (cleaned.length < 300) {
      throw new Error("word list (nouns.txt) too small (" + cleaned.length + ")");
    }

    recallState.nouns = cleaned;
    return;
  } catch (e) {
    // Fallback only if fetch fails (common on file://)
    recallState.nouns = [
      "apple","river","mirror","engine","castle","pencil","window","garden","market","planet",
      "bridge","mountain","camera","wallet","stadium","forest","ocean","ladder","bottle","ticket"
    ];
  }
}

// Pick unique correct words for the round (no duplicates)
function getUniqueRoundWords(list, count) {
  const result = [];
  const usedIdx = new Set();

  // If the list is too small, just shuffle unique values
  if (count > list.length) count = list.length;

  while (result.length < count) {
    const idx = Math.floor(Math.random() * list.length);
    if (usedIdx.has(idx)) continue;
    usedIdx.add(idx);
    result.push(list[idx]);
  }
  return result;
}

// Build 20 choices (correct + distractors), no duplicates in the grid
function buildChoices(correctWords, pool, totalChoices = 20) {
  const correctNorm = correctWords.map(normalizeWord);
  const correctSet = new Set(correctNorm);

  const choices = [...correctWords]; // include all correct words
  const choiceNormSet = new Set(correctNorm);

  const target = Math.max(totalChoices, correctWords.length); // always at least include all correct

  while (choices.length < target) {
    const candidate = pool[Math.floor(Math.random() * pool.length)];
    const norm = normalizeWord(candidate);
    if (!norm) continue;
    if (correctSet.has(norm)) continue;       // don't add correct word as distractor
    if (choiceNormSet.has(norm)) continue;    // no duplicates
    choiceNormSet.add(norm);
    choices.push(candidate);
  }

  // Shuffle
  choices.sort(() => Math.random() - 0.5);
  return choices;
}

async function startWordRecall() {
  closeModal();
  if (recallState.activeTimeout) clearTimeout(recallState.activeTimeout);
  if (recallState.progressStopper) recallState.progressStopper();
  if (recallState.activeInterval) clearInterval(recallState.activeInterval);

  await loadNounsIfNeeded();

  const quantity = parseInt(document.getElementById("recallQuantity").value, 10);
  const showMs = parseInt(document.getElementById("recallShow").value, 10) * 1000;
  const hideMs = parseInt(document.getElementById("recallHide").value, 10) * 1000;

  // Pick unique correct words for this round
  recallState.generatedWords = getUniqueRoundWords(recallState.nouns, quantity);

  const display = document.getElementById("recallDisplayArea");
  const area = document.getElementById("recallInputArea");
  area.innerHTML = "";

  // Countdown
  let countdown = 2;
  display.innerText = "Starting in: " + countdown;
  setProgress($("recallProgress"), 0);

  recallState.activeInterval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      display.innerText = "Starting in: " + countdown;
  setProgress($("recallProgress"), 0);
    } else {
      clearInterval(recallState.activeInterval);

      // Show words
      display.innerText = recallState.generatedWords.join("  •  ");
      if (recallState.progressStopper) recallState.progressStopper();
      recallState.progressStopper = runProgress($("recallProgress"), showMs, { phase: "show" });

      // Hide
      recallState.activeTimeout = setTimeout(() => {
        display.innerText = "…";
        if (recallState.progressStopper) recallState.progressStopper();
        recallState.progressStopper = runProgress($("recallProgress"), hideMs, { phase: "hide" });

        // After hide duration, show the tile selection UI
        recallState.activeTimeout = setTimeout(() => {
          if (recallState.progressStopper) recallState.progressStopper();
          recallState.selectedWords = [];
          recallState.selectedButtons = [];
          // Use 20 tiles (or at least enough to include correct words)
          recallState.choices = buildChoices(recallState.generatedWords, recallState.nouns, 12);
          renderChoiceUI(quantity);
        }, hideMs);

      }, showMs);
    }
  }, 1000);
}

function renderChoiceUI(quantity) {
  const display = document.getElementById("recallDisplayArea");
  const area = document.getElementById("recallInputArea");
  area.innerHTML = "";

  // Slots
  const slotsWrap = document.createElement("div");
  slotsWrap.className = "recall-slots";

  for (let i = 0; i < quantity; i++) {
    const slot = document.createElement("div");
    slot.className = "recall-slot";
    slot.id = "slot" + i;
    slot.innerText = (i + 1).toString();
    slotsWrap.appendChild(slot);
  }

  // Grid
  const grid = document.createElement("div");
  grid.className = "recall-grid";

  recallState.choices.forEach((word) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-tile";
    btn.innerText = word;
    btn.dataset.word = word;
    btn.onclick = () => onChoicePicked(btn, quantity);
    grid.appendChild(btn);
  });

  // Undo button
  const undoBtn = document.createElement("button");
  undoBtn.type = "button";
  undoBtn.className = "undo-btn";
  undoBtn.innerText = "Undo";
  undoBtn.onclick = () => undoLastPick(quantity);

  // Reset button
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "reset-btn";
  resetBtn.innerText = "Reset Picks";
  resetBtn.onclick = () => {
    recallState.selectedWords = [];
    recallState.selectedButtons = [];
    renderChoiceUI(quantity);
  };

  area.appendChild(slotsWrap);
  area.appendChild(grid);
  area.appendChild(undoBtn);
  area.appendChild(resetBtn);

  display.innerText = "Tap the words in the SAME order they appeared.";
}


function undoLastPick(quantity) {
  if (!recallState.selectedWords.length) return;

  const lastIndex = recallState.selectedWords.length - 1;
  recallState.selectedWords.pop();

  const btn = recallState.selectedButtons.pop();
  if (btn) {
    btn.disabled = false;
    btn.classList.remove("picked");
  }

  const slot = document.getElementById("slot" + lastIndex);
  if (slot) slot.innerText = (lastIndex + 1).toString();

  // If user undoes, keep display instruction fresh
  const display = document.getElementById("recallDisplayArea");
  if (display) display.innerText = "Tap the words in the SAME order they appeared.";
}

function onChoicePicked(buttonEl, quantity) {
  const picked = buttonEl.dataset.word;
  const position = recallState.selectedWords.length;

  if (position >= quantity) return;

  // disable tile after picking
  buttonEl.disabled = true;
  buttonEl.classList.add("picked");

  // fill slot
  recallState.selectedWords.push(picked);
  recallState.selectedButtons.push(buttonEl);
  const slot = document.getElementById("slot" + position);
  if (slot) slot.innerText = picked;

  // immediate order check
  const expected = normalizeWord(recallState.generatedWords[position]);
  const got = normalizeWord(picked);

  if (got !== expected) {
    recallState.incorrectCounter++;
    recallState.streak = 0;
    document.getElementById("recallIncorrectCount").innerText =
      "Incorrect: " + recallState.incorrectCounter;
    document.getElementById("recallStreak").innerText = "Streak: 0";
    document.getElementById("recallBestStreak").innerText = "Best: " + recallState.bestStreak;

    const expectedWord = recallState.generatedWords[position];
    const body = `
      <p><b>Wrong order.</b></p>
      <p>Expected #${position + 1}: <span class="chip">${expectedWord}</span></p>
      <p>You chose: <span class="chip bad">${picked}</span></p>
      <hr />
      <p><b>Correct sequence:</b></p>
      <div class="chip-row">
        ${recallState.generatedWords.map(w => `<span class="chip">${w}</span>`).join("")}
      </div>
    `;

    openModal({
      title: "❌ Try again",
      bodyHTML: body,
      primaryText: "Next Round",
      onPrimary: () => startWordRecall(),
      autoCloseMs: 4000
    });

    return;
  }

  // completed successfully
  if (recallState.selectedWords.length === quantity) {
    recallState.correctCounter++;
    recallState.streak++;
    recallState.bestStreak = Math.max(recallState.bestStreak, recallState.streak);
    document.getElementById("recallCorrectCount").innerText =
      "Correct: " + recallState.correctCounter;
    document.getElementById("recallStreak").innerText = "Streak: " + recallState.streak;
    document.getElementById("recallBestStreak").innerText = "Best: " + recallState.bestStreak;

    openModal({
      title: "✅ Correct",
      bodyHTML: `<p><b>Correct!</b> Ready for the next round?</p>`,
      primaryText: "Next Round",
      onPrimary: () => startWordRecall()
    });
}
}

// Apply default difficulty on load
window.addEventListener("DOMContentLoaded", () => {
  applyRecallDifficulty();
  const customWrap = $("recallCustomControls");
  if (customWrap) customWrap.classList.add("hidden");
});
