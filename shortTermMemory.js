let generatedItems = [];
let activeTimeout = null;
let activeInterval = null;
let correctCounter = 0;
let incorrectCounter = 0;


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
        // Clear any active timers from previous games
        if (activeTimeout) {
            clearTimeout(activeTimeout);
        }
        if (activeInterval) {
            clearInterval(activeInterval);
        }
    
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
    
        // Start the countdown before showing the items
        let countdownTime = 3;  // 3 seconds countdown
        document.getElementById("displayArea").innerText = "Starting in: " + countdownTime;
    
        activeInterval = setInterval(() => {
            countdownTime--;
            if(countdownTime > 0) {
                document.getElementById("displayArea").innerText = "Starting in: " + countdownTime;
            } else {
                clearInterval(activeInterval);
                document.getElementById("displayArea").innerText = generatedItems.join(", ");
                activeTimeout = setTimeout(() => {
                    document.getElementById("displayArea").innerText = "Now, try to remember!";
                    createInputBoxes(quantity);
                }, duration);
            }
        }, 1000);
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
    
        // Set focus on the first input box
        document.getElementById("box0").focus();
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
            correctCounter++;
            document.getElementById("correctCount").innerText = "Correct: " + correctCounter;
            alert("Correct!");
        } else {
            incorrectCounter++;
            document.getElementById("incorrectCount").innerText = "Incorrect: " + incorrectCounter;
            alert("Wrong! The correct answers were: " + generatedItems.join(", "));
        }
    
        // Wait for 2 seconds, then start the next round
        setTimeout(startGame, 2000);
    }
    
