let generatedItems = [];

function getRandomWord() {
    const     
    words = [
        "time", "year", "people", "way", "day", "man", "thing", "woman", "life", "child",
        "world", "school", "state", "family", "student", "group", "country", "problem", "hand",
        "part", "place", "case", "week", "company", "system", "program", "question", "work",
        "government", "number", "night", "point", "home", "water", "room", "mother", "area",
        "money", "story", "fact", "month", "lot", "right", "study", "book", "eye", "job",
        "word", "business", "issue", "side", "kind", "head", "house", "service", "friend",
        "father", "power", "hour", "game", "line", "end", "member", "law", "car", "city",
        "community", "name", "president", "team", "minute", "idea", "kid", "body", "information",
        "back", "parent", "face", "others", "level", "office", "door", "health", "person",
        "art", "war", "history", "party", "result", "change", "morning", "reason", "research",
        "girl", "guy", "moment", "air", "teacher", "force", "education", "foot", "industry",
        "future", "plan", "culture", "action", "sense", "aspect", "period", "subject",
        "theory", "matter", "community", "population", "rate", "minute", "test", "relationship",
        "idea", "song", "market", "friend", "ring", "duty", "role", "source", "film", "land",
        "class", "team", "age", "art", "scene", "task", "heart", "trust", "dream", "path",
        "surface", "court", "voice", "stage", "space", "type", "front", "fun", "bed", "police",
        "arm", "heart", "plane", "ship", "area", "part", "week", "basis", "waste", "ability"]
        return words[Math.floor(Math.random() * words.length)];
    }

    function startGame() {
        const type = document.getElementById("type").value;
        const quantity = parseInt(document.getElementById("quantity").value);
        const duration = parseInt(document.getElementById("duration").value) * 1000;
    
        generatedItems = [];
    
        for (let i = 0; i < quantity; i++) {
        if (type === "numbers") {
            generatedItems.push(Math.floor(Math.random() * 100).toString());
        } else if (type === "words") {
            generatedItems.push(getRandomWord());
        } else {
            const choice = Math.random() < 0.5 ? "number" : "word";
            if (choice === "number") {
                generatedItems.push(Math.floor(Math.random() * 100).toString());
            } else {
                generatedItems.push(getRandomWord());
            }
        }
    }

    document.getElementById("displayArea").innerText = generatedItems.join(", ");
    setTimeout(() => {
        document.getElementById("displayArea").innerText = "Now, try to remember!";
        createInputBoxes(quantity);
    }, duration);
}

function createInputBoxes(quantity) {
    const inputArea = document.getElementById("inputArea");
    inputArea.innerHTML = "";
    for (let i = 0; i < quantity; i++) {
        const inputBox = document.createElement("input");
        inputBox.setAttribute("type", "text");
        inputBox.setAttribute("id", "box" + i);
        inputArea.appendChild(inputBox);
    }
    const submitButton = document.createElement("button");
    submitButton.innerText = "Check Answers";
    submitButton.onclick = checkAnswers;
    inputArea.appendChild(submitButton);
}

function checkAnswers() {
    let correct = true;
    for (let i = 0; i < generatedItems.length; i++) {
        const inputValue = document.getElementById("box" + i).value;
        if (inputValue !== generatedItems[i]) {
            correct = false;
            break;
        }
    }
    if (correct) {
        alert("Correct!");
    } else {
        alert("Wrong! The correct answers were: " + generatedItems.join(", "));
    }
    
    // Wait for 2 seconds, then start the next round
    setTimeout(startGame, 2000);
}
