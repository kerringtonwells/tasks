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
// GAME 1: Number Game (Your existing game, minimally adjusted)
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
  // Clear any active timers from previous rounds
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

  // Countdown
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
// GAME 2: Word Recall (NEW)
// ============================

const recallState = {
  nouns: [],
  activeTimeout: null,
  activeInterval: null,
  generatedWords: [],
  correctCounter: 0,
  incorrectCounter: 0,
};

async function loadNounsIfNeeded() {
  if (recallState.nouns.length > 0) return;

  // Option A (recommended): nouns.txt (one noun per line)
  try {
    const resp = await fetch("nouns.txt", { cache: "no-store" });
    if (resp.ok) {
      const text = await resp.text();
      const lines = text
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean);

      if (lines.length >= 100) {
        recallState.nouns = lines;
        return;
      }
    }
  } catch (e) {
    // ignore; fallback below
  }

  // Option B: fallback list (replace this with your full list if you want)
  recallState.nouns = [
    "apple","river","mirror","engine","castle","pencil","window","garden","market","planet",
    "bridge","mountain","camera","wallet","stadium","forest","ocean","ladder","bottle","ticket"
  ];
}

function pickRandomNoun() {
  const list = recallState.nouns;
  return list[Math.floor(Math.random() * list.length)];
}

function normalizeWord(s) {
  return (s || "")
    .trim()
    .toLowerCase();
}

async function startWordRecall() {
  if (recallState.activeTimeout) clearTimeout(recallState.activeTimeout);
  if (recallState.activeInterval) clearInterval(recallState.activeInterval);

  await loadNounsIfNeeded();

  const quantity = parseInt(document.getElementById("recallQuantity").value, 10);
  const showMs = parseInt(document.getElementById("recallShow").value, 10) * 1000;
  const hideMs = parseInt(document.getElementById("recallHide").value, 10) * 1000;

  // Build word list (ensure uniqueness if you want; currently can repeat)
  //recallState.generatedWords = [];
  //for (let i = 0; i < quantity; i++) {
    //recallState.generatedWords.push(pickRandomNoun());
  //}
  // Shuffle a copy of the noun list
  const shuffled = [...recallState.nouns]
    .sort(() => 0.5 - Math.random());

  // Take the first "quantity" words
  recallState.generatedWords = shuffled.slice(0, quantity);

  const display = document.getElementById("recallDisplayArea");
  const inputArea = document.getElementById("recallInputArea");
  inputArea.innerHTML = "";

  // Optional small countdown
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

      // After show duration, hide the words
      recallState.activeTimeout = setTimeout(() => {
        display.innerText = "…";

        // After hide duration, show inputs
        recallState.activeTimeout = setTimeout(() => {
          display.innerText = "Type the nouns in order:";
          createRecallInputs(quantity);
        }, hideMs);

      }, showMs);
    }
  }, 1000);
}

function createRecallInputs(quantity) {
  const inputArea = document.getElementById("recallInputArea");
  inputArea.innerHTML = "";

  for (let i = 0; i < quantity; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.id = "recallBox" + i;
    input.placeholder = `#${i + 1}`;
    inputArea.appendChild(input);

    // Enter key moves to next
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (i < quantity - 1) {
          document.getElementById("recallBox" + (i + 1)).focus();
        } else {
          document.querySelector(".recall-check-btn").focus();
        }
      }
    });
  }

  const btn = document.createElement("button");
  btn.innerText = "Check Answers";
  btn.classList.add("recall-check-btn");
  btn.onclick = checkRecallAnswers;
  inputArea.appendChild(btn);

  document.getElementById("recallBox0").focus();
}

function checkRecallAnswers() {
  const expected = recallState.generatedWords.map(normalizeWord);

  let correct = true;
  for (let i = 0; i < expected.length; i++) {
    const typed = normalizeWord(document.getElementById("recallBox" + i).value);
    if (typed !== expected[i]) {
      correct = false;
      break;
    }
  }

  if (correct) {
    recallState.correctCounter++;
    document.getElementById("recallCorrectCount").innerText = "Correct: " + recallState.correctCounter;
    alert("Correct!");
  } else {
    recallState.incorrectCounter++;
    document.getElementById("recallIncorrectCount").innerText = "Incorrect: " + recallState.incorrectCounter;
    alert("Wrong! Correct sequence was: " + recallState.generatedWords.join(", "));
  }

  setTimeout(startWordRecall, 2000);
}
