// Optional: set the public website address here when testing locally.
const PUBLIC_SITE_URL = "https://erick1326a.github.io/rentdle/";

function amsterdamDate(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);
    const part = type => parts.find(p => p.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
}

function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function offsetDate(value, days) {
    const date = new Date(value + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

const pageUrl = new URL(window.location.href);
const isTestMode = pageUrl.searchParams.get('test') === '1';
const todayId = amsterdamDate();
const requestedDate = pageUrl.searchParams.get('date');
const puzzleId = isTestMode && validDate(requestedDate) ? requestedDate : todayId;
const scheduledId = puzzleSchedule[puzzleId];
const matches = propertiesDatabase.filter(property => property.id === scheduledId);
const candidate = matches.length === 1 ? matches[0] : null;
const propertyData = candidate && Number.isFinite(candidate.actualRent) && candidate.actualRent > 0 &&
    Array.isArray(candidate.clues) && candidate.clues.length === 5 &&
    candidate.clues.every(clue => clue && ['image', 'text'].includes(clue.type) && typeof clue.text === 'string')
    ? candidate : null;
const maxGuesses = 5;
const storageKey = `rentdle:${isTestMode ? 'preview' : 'daily'}:${puzzleId}`;

function dateStillCurrent() {
    if (!isTestMode && amsterdamDate() !== puzzleId) {
        window.location.reload();
        return false;
    }
    return true;
}

function previewDate(date) {
    if (!validDate(date)) return;
    const url = new URL(window.location.href);
    url.searchParams.set('test', '1');
    url.searchParams.set('date', date);
    window.location.assign(url.href);
}

function setupTestPanel() {
    const local = pageUrl.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(pageUrl.hostname);
    document.getElementById('test-panel').hidden = !local && !isTestMode;
    document.getElementById('puzzle-date').textContent = `${isTestMode ? 'TEST MODE · Preview' : 'Daily puzzle'} · ${puzzleId}`;
    document.getElementById('test-date').value = puzzleId;
    document.getElementById('test-panel').open = isTestMode;
    document.getElementById('test-note').textContent = isTestMode
        ? 'Test mode: preview progress is separate from your daily game.'
        : 'Choose a date to enter test mode. Your daily progress stays saved.';
    document.getElementById('restart-preview').disabled = !isTestMode || !propertyData;
    document.getElementById('previous-date').addEventListener('click', () => previewDate(offsetDate(puzzleId, -1)));
    document.getElementById('next-date').addEventListener('click', () => previewDate(offsetDate(puzzleId, 1)));
    document.getElementById('test-date').addEventListener('change', event => previewDate(event.target.value));
    document.getElementById('open-preview').addEventListener('click', () => previewDate(document.getElementById('test-date').value));
    document.getElementById('restart-preview').addEventListener('click', () => {
        if (!isTestMode) return;
        gameState = freshState();
        saveState();
        if (resultModal.open) resultModal.close();
        initGame();
    });
    document.getElementById('return-today').addEventListener('click', () => {
        const url = new URL(window.location.href);
        url.searchParams.delete('test');
        url.searchParams.delete('date');
        window.location.assign(url.href);
    });
}


const resultModal = document.getElementById('result-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const closeModalBtn = document.getElementById('close-modal');

const clueContent = document.getElementById('clue-content');
const guessInput = document.getElementById('guess-input');
const submitBtn = document.getElementById('submit-guess');
const skipBtn = document.getElementById('skip-clue');
const historyContainer = document.getElementById('history-container');
const difficultySelect = document.getElementById('difficulty');
const prevClueBtn = document.getElementById('prev-clue');
const nextClueBtn = document.getElementById('next-clue');
const clueTracker = document.getElementById('clue-tracker');

function freshState() {
    return { puzzleId, propertyId: propertyData?.id || null, guesses: [], gameOver: false, isWin: false, difficulty: '50' };
}

function loadState() {
    const clean = freshState();
    if (!propertyData) return clean;
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        if (!saved || saved.puzzleId !== puzzleId || saved.propertyId !== propertyData.id ||
            !['25', '50', '100'].includes(saved.difficulty) || !Array.isArray(saved.guesses) ||
            saved.guesses.length > maxGuesses) return clean;
        clean.difficulty = saved.difficulty;
        for (const entry of saved.guesses) {
            if (!entry || clean.gameOver) return freshState();
            const guess = entry.guess;
            if (guess !== 'Skipped' && (!Number.isFinite(guess) || guess <= 0)) return freshState();
            const difference = guess - propertyData.actualRent;
            const feedback = guess === 'Skipped' ? '-' : Math.abs(difference) <= Number(clean.difficulty)
                ? 'Correct!' : difference > 0 ? 'Too high' : 'Too low';
            clean.guesses.push({ guess, feedback });
            clean.isWin = feedback === 'Correct!';
            clean.gameOver = clean.isWin || clean.guesses.length === maxGuesses;
        }
        return clean;
    } catch (_) { return clean; }
}

let gameState = loadState();
let viewingClueIndex = 0;

function saveState() {
    if (!propertyData) return;
    try { localStorage.setItem(storageKey, JSON.stringify(gameState)); }
    catch (_) {
        document.getElementById('save-notice').textContent = 'Progress cannot be saved in this browser. You can still play this visit.';
    }
}

function initGame() {
    historyContainer.replaceChildren();
    clueContent.replaceChildren();
    document.getElementById('show-result').classList.add('hidden');
    guessInput.value = '';
    guessInput.disabled = !propertyData;
    submitBtn.disabled = !propertyData;
    skipBtn.disabled = !propertyData;
    difficultySelect.value = gameState.difficulty;
    difficultySelect.disabled = !propertyData || gameState.guesses.length > 0;
    if (!propertyData) {
        const message = document.createElement('h2');
        message.textContent = 'No puzzle scheduled';
        const explanation = document.createElement('p');
        explanation.textContent = isTestMode ? `No playable property is assigned to ${puzzleId}. Choose another date.` : 'There is no puzzle available for today. Please check back later.';
        clueContent.appendChild(message);
        clueContent.appendChild(explanation);
        clueTracker.textContent = 'No clues available';
        prevClueBtn.disabled = true;
        nextClueBtn.disabled = true;
        return;
    }
    gameState.guesses.forEach((g, index) => renderHistoryItem(index + 1, g.guess, g.feedback));
    viewingClueIndex = Math.min(gameState.guesses.length, maxGuesses - 1);
    updateClueDisplay();
    if (gameState.gameOver) endGame(gameState.isWin);
}


function processGuess() {
    if (!dateStillCurrent() || !propertyData || gameState.gameOver) return;

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
    if (!dateStillCurrent() || !propertyData || gameState.gameOver) return;
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
    if (!propertyData) return;
    document.getElementById('result-eyebrow').textContent = (isTestMode ? 'TEST MODE' : 'RENTDLE') + ' · ' + puzzleId;
    guessInput.disabled = true;
    submitBtn.disabled = true;
    skipBtn.disabled = true;
    const difficulty = { '100': 'Easy', '50': 'Normal', '25': 'Hard' }[gameState.difficulty];
    modalTitle.textContent = isWin ? 'You found the rent!' : 'The rent, revealed';
    modalTitle.style.color = isWin ? '#86efac' : '#ffffff';
    modalMessage.textContent = isWin
        ? `${gameState.guesses.length}/${maxGuesses} attempts · ${difficulty} · Nicely done!`
        : `${maxGuesses}/${maxGuesses} attempts · ${difficulty} · Thanks for playing.`;
    document.getElementById('result-property-title').textContent = propertyData.title || 'Today’s property';
    document.getElementById('result-rent').textContent = new Intl.NumberFormat('en-IE', {
        style: 'currency', currency: 'EUR', maximumFractionDigits: 0
    }).format(propertyData.actualRent) + ' / month';
    document.getElementById('result-rent-note').textContent = propertyData.rentNote || 'Advertised monthly rent.';
    const details = document.getElementById('result-details');
    details.replaceChildren();
    propertyData.clues.filter(clue => clue.type === 'text').forEach(clue => {
        const item = document.createElement('li');
        item.textContent = clue.text.replace(/^Clue\s+\d+\/\d+:\s*/i, '');
        details.appendChild(item);
    });
    const link = document.getElementById('listing-link');
    let listingUrl = null;
    try {
        const url = new URL(propertyData.listingUrl);
        if (['https:', 'http:'].includes(url.protocol)) listingUrl = url.href;
    } catch (_) { /* A listing link is optional. */ }
    link.hidden = !listingUrl;
    if (listingUrl) link.href = listingUrl;
    else link.removeAttribute('href');
    document.getElementById('listing-unavailable').hidden = Boolean(listingUrl);
    document.getElementById('show-result').classList.remove('hidden');
    document.getElementById('share-status').textContent = '';
    document.getElementById('manual-share').hidden = true;
    if (!resultModal.open) resultModal.showModal();
    document.getElementById('share-result').focus();
}

function getShareUrl() {
    try {
        const url = new URL(PUBLIC_SITE_URL || window.location.href);
        if (!['https:', 'http:'].includes(url.protocol) ||
            /^(localhost|127(?:\.\d+){3}|\[::1\]|0\.0\.0\.0)$/i.test(url.hostname) ||
            url.hostname.endsWith('.localhost')) return '';
        // Never include query parameters, fragments, or credentials in shared links.
        return url.origin + url.pathname;
    } catch (_) { return ''; }
}

function buildShareText() {
    const difficulty = { '100': 'Easy', '50': 'Normal', '25': 'Hard' }[gameState.difficulty];
    const date = puzzleId;
    const score = gameState.isWin ? gameState.guesses.length : 'X';
    const squares = gameState.guesses.map(g => g.feedback === 'Correct!' ? '🟩' : g.guess === 'Skipped' ? '⬜' : '🟥').join('');
    return [`Rentdle${isTestMode ? " TEST" : ""} · ${date}`, `${score}/${maxGuesses} · ${difficulty}`, squares, getShareUrl()].filter(Boolean).join('\n');
}

async function shareResult() {
    if (!dateStillCurrent() || !propertyData || !gameState.gameOver) return;
    const button = document.getElementById('share-result');
    const status = document.getElementById('share-status');
    const text = buildShareText();
    const localNote = getShareUrl() ? '' : ' A website link will be included once Rentdle is hosted.';
    button.disabled = true;
    status.textContent = '';
    document.getElementById('manual-share').hidden = true;
    try {
        // Copy directly; do not open the operating system sharing panel.
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            try {
                await navigator.clipboard.writeText(text);
                status.textContent = 'Result copied! Paste it into a message.' + localNote;
                return;
            } catch (_) { /* Manual copying also works without clipboard permission. */ }
        }
        document.getElementById('manual-share').hidden = false;
        const field = document.getElementById('share-text');
        field.value = text;
        field.focus();
        field.select();
        status.textContent = 'Select and copy the result below.' + localNote;
    } finally {
        button.disabled = false;
    }
}


// Event Listeners
submitBtn.addEventListener('click', processGuess);
skipBtn.addEventListener('click', skipClue);
guessInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') processGuess();
});

prevClueBtn.addEventListener('click', () => {
    if (!dateStillCurrent() || !propertyData) return;
    if (viewingClueIndex > 0) {
        viewingClueIndex--;
        updateClueDisplay();
    }
});

nextClueBtn.addEventListener('click', () => {
    if (!dateStillCurrent() || !propertyData) return;
    const maxAllowedView = gameState.gameOver ? (maxGuesses - 1) : gameState.guesses.length;
    if (viewingClueIndex < maxAllowedView) {
        viewingClueIndex++;
        updateClueDisplay();
    }
});

difficultySelect.addEventListener('change', () => {
    if (!dateStillCurrent() || !propertyData) return;
    gameState.difficulty = difficultySelect.value;
    saveState();
});

closeModalBtn.addEventListener('click', () => {
    resultModal.close();
    document.getElementById('show-result').focus();
});
document.getElementById('share-result').addEventListener('click', shareResult);
document.getElementById('show-result').addEventListener('click', () => {
    if (dateStillCurrent() && propertyData && gameState.gameOver) endGame(gameState.isWin);
});
resultModal.addEventListener('close', () => document.getElementById('show-result').focus());
setupTestPanel();
initGame();
setInterval(dateStillCurrent, 30000);
window.addEventListener('focus', dateStillCurrent);
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) dateStillCurrent();
});
