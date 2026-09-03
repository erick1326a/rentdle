// Database of properties
const propertiesDatabase = [
    {
        actualRent: 1950,
        clues: [
            { type: 'image', src: '03092026.jpg', text: 'Clue 1/5: Exterior' },
            { type: 'image', src: '03092026_interior.jpg', text: 'Clue 2/5: Interior' }, 
            { type: 'text', text: 'Clue 3/5: Energy Label A+' },
            { type: 'text', text: 'Clue 4/5: 75m2, 2 Rooms, Delft' },
            { type: 'text', text: 'Clue 5/5: Built in 1750, Semi Furnished' }
        ]
    },
    {
        actualRent: 2200,
        clues: [
            { type: 'text', text: 'Clue 1/5: Modern Apartment Complex' },
            { type: 'text', text: 'Clue 2/5: Open Kitchen Layout' }, 
            { type: 'text', text: 'Clue 3/5: Energy Label A++' },
            { type: 'text', text: 'Clue 4/5: 85m2, 3 Rooms, Amsterdam' },
            { type: 'text', text: 'Clue 5/5: Built in 2023, Fully Furnished' }
        ]
    },
    {
        actualRent: 950,
        clues: [
            { type: 'text', text: 'Clue 1/5: Brick Row House' },
            { type: 'text', text: 'Clue 2/5: Studio Layout' }, 
            { type: 'text', text: 'Clue 3/5: Energy Label C' },
            { type: 'text', text: 'Clue 4/5: 35m2, 1 Room, Utrecht' },
            { type: 'text', text: 'Clue 5/5: Built in 1980, Unfurnished' }
        ]
    }
];

// Unified date handling
const todayDate = new Date();
todayDate.setDate(todayDate.getDate() - 1); // Uncomment to test tomorrow

// Generate a deterministic number based on the local date (e.g., 20260903)
const dateInt = todayDate.getFullYear() * 10000 + (todayDate.getMonth() + 1) * 100 + todayDate.getDate();

const propertyIndex = dateInt % propertiesDatabase.length;
const propertyData = propertiesDatabase[propertyIndex];

const maxGuesses = 5;

// DOM Elements
const clueContainer = document.getElementById('clue-container');
const guessInput = document.getElementById('guess-input');
const submitBtn = document.getElementById('submit-guess');
const skipBtn = document.getElementById('skip-clue');
const historyContainer = document.getElementById('history-container');

// Local Storage Setup using the unified date
const dateString = todayDate.toDateString();
let gameState = JSON.parse(localStorage.getItem('rentdleState'));

if (!gameState || gameState.date !== dateString) {
    gameState = {
        date: dateString,
        guesses: [],
        gameOver: false,
        isWin: false
    };
    saveState();
}

function saveState() {
    localStorage.setItem('rentdleState', JSON.stringify(gameState));
}

// Initialize UI on page load
function initGame() {
    gameState.guesses.forEach((g, index) => {
        renderHistoryItem(index + 1, g.guess, g.feedback);
    });

    if (gameState.gameOver) {
        endGame(gameState.isWin);
    } else {
        showNextClue();
    }
}

function processGuess() {
    if (gameState.gameOver) return;

    const guessValue = parseInt(guessInput.value);
    if (isNaN(guessValue) || guessValue <= 0) {
        alert("Please enter a valid rent amount.");
        return;
    }

    const difference = guessValue - propertyData.actualRent;
    let feedback = "";
    
    if (difference === 0) feedback = "Correct!";
    else if (difference > 0) feedback = "Too high";
    else feedback = "Too low";

    handleTurn(guessValue, feedback);
    guessInput.value = "";
}

function skipClue() {
    if (gameState.gameOver) return;
    handleTurn("Skipped", "-");
}

function handleTurn(guess, feedback) {
    gameState.guesses.push({ guess, feedback });
    renderHistoryItem(gameState.guesses.length, guess, feedback);

    if (feedback === "Correct!") {
        gameState.isWin = true;
        gameState.gameOver = true;
        endGame(true);
    } else if (gameState.guesses.length >= maxGuesses) {
        gameState.gameOver = true;
        endGame(false);
    } else {
        showNextClue();
    }
    saveState();
}

function showNextClue() {
    const currentClue = propertyData.clues[gameState.guesses.length];
    clueContainer.innerHTML = '';
    
    if (currentClue.type === 'image') {
        const img = document.createElement('img');
        img.src = currentClue.src;
        img.id = 'property-image';
        clueContainer.appendChild(img);
    }
    
    const textNode = document.createElement('h2');
    textNode.id = 'clue-text';
    textNode.textContent = currentClue.text;
    clueContainer.appendChild(textNode);
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
    
    const resultMessage = document.createElement('h3');
    if (isWin) {
        resultMessage.textContent = `You won in ${gameState.guesses.length} guesses!`;
        resultMessage.style.color = '#4caf50';
    } else {
        resultMessage.textContent = `Game Over. The actual rent was €${propertyData.actualRent}.`;
        resultMessage.style.color = '#f44336';
    }
    clueContainer.appendChild(resultMessage);
}

// Event Listeners
submitBtn.addEventListener('click', processGuess);
skipBtn.addEventListener('click', skipClue);
guessInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        processGuess();
    }
});

// Start the game
initGame();