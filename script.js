const propertiesDatabase = [
    {
        actualRent: 1500,
        clues: [
            { type: 'image', src: '03092026.JPG', text: 'Clue 1/5: Exterior' },
            { type: 'image', src: '03092026_interior.JPG', text: 'Clue 2/5: Interior' }, 
            { type: 'text', text: 'Clue 3/5: Energy Label A+' },
            { type: 'text', text: 'Clue 4/5: 75m2, 2 Rooms, Delft' },
            { type: 'text', text: 'Clue 5/5: Built in 1750, Semi Furnished' }
        ]
    }
    // Add more properties here
];

const todayDate = new Date();
const dateInt = todayDate.getFullYear() * 10000 + (todayDate.getMonth() + 1) * 100 + todayDate.getDate();
const propertyIndex = dateInt % propertiesDatabase.length;
const propertyData = propertiesDatabase[propertyIndex];
const maxGuesses = 5;

const clueContent = document.getElementById('clue-content');
const guessInput = document.getElementById('guess-input');
const submitBtn = document.getElementById('submit-guess');
const skipBtn = document.getElementById('skip-clue');
const historyContainer = document.getElementById('history-container');
const difficultySelect = document.getElementById('difficulty');
const prevClueBtn = document.getElementById('prev-clue');
const nextClueBtn = document.getElementById('next-clue');
const clueTracker = document.getElementById('clue-tracker');

const dateString = todayDate.toDateString();
let gameState = JSON.parse(localStorage.getItem('rentdleState'));

if (!gameState || gameState.date !== dateString) {
    gameState = {
        date: dateString,
        guesses: [],
        gameOver: false,
        isWin: false,
        difficulty: '50' 
    };
    saveState();
}

let viewingClueIndex = gameState.guesses.length;

function saveState() {
    localStorage.setItem('rentdleState', JSON.stringify(gameState));
}

function initGame() {
    difficultySelect.value = gameState.difficulty;
    if (gameState.guesses.length > 0) {
        difficultySelect.disabled = true; // Lock difficulty after first guess
    }

    gameState.guesses.forEach((g, index) => {
        renderHistoryItem(index + 1, g.guess, g.feedback);
    });

    viewingClueIndex = Math.min(gameState.guesses.length, maxGuesses - 1);
    updateClueDisplay();

    if (gameState.gameOver) {
        endGame(gameState.isWin);
    }
}

function processGuess() {
    if (gameState.gameOver) return;

    const guessValue = parseInt(guessInput.value);
    if (isNaN(guessValue) || guessValue <= 0) {
        alert("Please enter a valid rent amount.");
        return;
    }

    difficultySelect.disabled = true;
    gameState.difficulty = difficultySelect.value;
    
    const margin = parseInt(gameState.difficulty);
    const difference = guessValue - propertyData.actualRent;
    const absDiff = Math.abs(difference);
    
    let feedback = "";
    if (absDiff <= margin) feedback = "Correct!";
    else if (difference > 0) feedback = "Too high";
    else feedback = "Too low";

    handleTurn(guessValue, feedback);
    guessInput.value = "";
}

function skipClue() {
    if (gameState.gameOver) return;
    difficultySelect.disabled = true;
    gameState.difficulty = difficultySelect.value;
    handleTurn("Skipped", "-");
}

function handleTurn(guess, feedback) {
    gameState.guesses.push({ guess, feedback });
    renderHistoryItem(gameState.guesses.length, guess, feedback);

    if (feedback === "Correct!") {
        gameState.isWin = true;
        gameState.gameOver = true;
        viewingClueIndex = gameState.guesses.length - 1;
        updateClueDisplay();
        endGame(true);
    } else if (gameState.guesses.length >= maxGuesses) {
        gameState.gameOver = true;
        viewingClueIndex = maxGuesses - 1;
        updateClueDisplay();
        endGame(false);
    } else {
        viewingClueIndex = gameState.guesses.length;
        updateClueDisplay();
    }
    saveState();
}

function updateClueDisplay() {
    const currentClue = propertyData.clues[viewingClueIndex];
    clueContent.innerHTML = '';
    
    if (currentClue.type === 'image') {
        const img = document.createElement('img');
        img.src = currentClue.src;
        img.id = 'property-image';
        clueContent.appendChild(img);
    }
    
    const textNode = document.createElement('h2');
    textNode.id = 'clue-text';
    textNode.textContent = currentClue.text;
    clueContent.appendChild(textNode);

    // Update navigation state
    clueTracker.textContent = `Clue ${viewingClueIndex + 1}/${maxGuesses}`;
    
    // Max clue user is allowed to see is their current turn, or all if game over
    const maxAllowedView = gameState.gameOver ? (maxGuesses - 1) : gameState.guesses.length;
    
    prevClueBtn.disabled = viewingClueIndex === 0;
    nextClueBtn.disabled = viewingClueIndex >= maxAllowedView || viewingClueIndex >= (maxGuesses - 1);
}

function renderHistoryItem(guessNumber, guess, feedback) {
    const historyItem = document.createElement('div');
    historyItem.style.backgroundColor = '#2a2a2a';
    historyItem.style.padding = '10px';
    historyItem.style.borderRadius = '4px';
    historyItem.style.border = '1px solid #444';
    
    let color = "white";
    if (feedback === "Correct!") color = "#4caf50";
    else if (feedback === "Too high") color = "#f44336";
    else if (feedback === "Too low") color = "#2196f3";
    else color = "#888";
    
    const guessText = guess === "Skipped" ? "Skipped" : `€${guess}`;
    historyItem.innerHTML = `Guess ${guessNumber}: ${guessText} <strong style="color: ${color}; float: right;">${feedback}</strong>`;
    historyContainer.appendChild(historyItem);
}

function endGame(isWin) {
    guessInput.disabled = true;
    submitBtn.disabled = true;
    skipBtn.disabled = true;
    
    // Check if result message already exists to avoid duplicates on refresh
    if (!document.getElementById('result-message')) {
        const resultMessage = document.createElement('h3');
        resultMessage.id = 'result-message';
        if (isWin) {
            resultMessage.textContent = `You won in ${gameState.guesses.length} guesses!`;
            resultMessage.style.color = '#4caf50';
        } else {
            resultMessage.textContent = `Game Over. The actual rent was €${propertyData.actualRent}.`;
            resultMessage.style.color = '#f44336';
        }
        document.getElementById('clue-container').appendChild(resultMessage);
    }
}

// Event Listeners
submitBtn.addEventListener('click', processGuess);
skipBtn.addEventListener('click', skipClue);
guessInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') processGuess();
});

prevClueBtn.addEventListener('click', () => {
    if (viewingClueIndex > 0) {
        viewingClueIndex--;
        updateClueDisplay();
    }
});

nextClueBtn.addEventListener('click', () => {
    const maxAllowedView = gameState.gameOver ? (maxGuesses - 1) : gameState.guesses.length;
    if (viewingClueIndex < maxAllowedView) {
        viewingClueIndex++;
        updateClueDisplay();
    }
});

difficultySelect.addEventListener('change', () => {
    gameState.difficulty = difficultySelect.value;
    saveState();
});

initGame();
