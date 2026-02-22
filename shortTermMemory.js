// ============================
// Shared: Game Picker Navigation
// ============================
function showGame(which) {
  document.getElementById("gamePicker").classList.add("hidden");
  document.getElementById("numbersGame").classList.add("hidden");
  document.getElementById("recallGame").classList.add("hidden");

  if (which === "numbers") document.getElementById("numbersGame").classList.remove("hidden");
  if (which === "recall") document.getElementById("recallGame").classList.remove("hidden");
}

function backToPicker() {
  // Stop timers from either game
  if (numberGameState.activeTimeout) clearTimeout(numberGameState.activeTimeout);
  if (numberGameState.activeInterval) clearInterval(numberGameState.activeInterval);
  if (recallState.activeTimeout) clearTimeout(recallState.activeTimeout);
  if (recallState.activeInterval) clearInterval(recallState.activeInterval);

  document.getElementById("numbersGame").classList.add("hidden");
  document.getElementById("recallGame").classList.add("hidden");
  document.getElementById("gamePicker").classList.remove("hidden");
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
  if (numberGameState.activeTimeout) clearTimeout(numberGameState.activeTimeout);
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

  numberGameState.activeInterval = setInterval(() => {
    countdownTime--;
    if (countdownTime > 0) {
      document.getElementById("displayArea").innerText = "Starting in: " + countdownTime;
    } else {
      clearInterval(numberGameState.activeInterval);
      document.getElementById("displayArea").innerText = numberGameState.generatedItems.join(", ");

      numberGameState.activeTimeout = setTimeout(() => {
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
    document.getElementById("correctCount").innerText = "Correct: " + numberGameState.correctCounter;
    alert("Correct!");
  } else {
    numberGameState.incorrectCounter++;
    document.getElementById("incorrectCount").innerText = "Incorrect: " + numberGameState.incorrectCounter;
    alert("Wrong! The correct answers were: " + numberGameState.generatedItems.join(", "));
  }

  setTimeout(startNumberGame, 2000);
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

  // NEW: choice-mode state
  selectedWords: [],
  choices: [],
};

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

    if (cleaned.length < 500) {
      throw new Error("nouns.txt too small (" + cleaned.length + ")");
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
  if (recallState.activeTimeout) clearTimeout(recallState.activeTimeout);
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

  recallState.activeInterval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      display.innerText = "Starting in: " + countdown;
    } else {
      clearInterval(recallState.activeInterval);

      // Show words
      display.innerText = recallState.generatedWords.join("  •  ");

      // Hide
      recallState.activeTimeout = setTimeout(() => {
        display.innerText = "…";

        // After hide duration, show the 20-tile selection UI
        recallState.activeTimeout = setTimeout(() => {
          recallState.selectedWords = [];
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

  // Reset button
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "reset-btn";
  resetBtn.innerText = "Reset Picks";
  resetBtn.onclick = () => {
    recallState.selectedWords = [];
    renderChoiceUI(quantity);
  };

  area.appendChild(slotsWrap);
  area.appendChild(grid);
  area.appendChild(resetBtn);

  display.innerText = "Tap the nouns in the SAME order they appeared.";
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
  const slot = document.getElementById("slot" + position);
  if (slot) slot.innerText = picked;

  // immediate order check
  const expected = normalizeWord(recallState.generatedWords[position]);
  const got = normalizeWord(picked);

  if (got !== expected) {
    recallState.incorrectCounter++;
    document.getElementById("recallIncorrectCount").innerText =
      "Incorrect: " + recallState.incorrectCounter;

    alert(
      "Wrong order.\n\nExpected #" +
        (position + 1) +
        ": " +
        recallState.generatedWords[position] +
        "\nYou chose: " +
        picked +
        "\n\nCorrect sequence was:\n" +
        recallState.generatedWords.join(", ")
    );

    setTimeout(startWordRecall, 1200);
    return;
  }

  // completed successfully
  if (recallState.selectedWords.length === quantity) {
    recallState.correctCounter++;
    document.getElementById("recallCorrectCount").innerText =
      "Correct: " + recallState.correctCounter;

    alert("Correct!");
    setTimeout(startWordRecall, 1200);
  }
}
