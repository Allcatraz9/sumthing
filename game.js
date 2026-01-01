/**
 * Sumthing - Math Puzzle Game
 * Core game logic and UI controller
 */

// ============================================
// Game State
// ============================================
const GameState = {
    // Current puzzle data
    grid: [],
    solution: [],
    playerState: [],
    rowTargets: [],
    colTargets: [],

    // Game settings
    size: 5,
    level: 1,
    mode: 'classic', // 'classic', 'zen', 'timed'

    // Statistics
    moves: 0,
    startTime: null,
    elapsedTime: 0,
    remainingTime: 0, // For Timed mode
    timerInterval: null,
    hintsUsed: 0,
    bestTimes: {}, // Store best times by level: { "1": 45, "2": 32 }

    // UI state
    isComplete: false,
    isDarkMode: false,
    soundEnabled: true,
    vibrationEnabled: true
};

// ============================================
// Sound Manager (Web Audio API)
// ============================================
const SoundManager = {
    ctx: null,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    play(freq, type = 'sine', duration = 0.1, volume = 0.1) {
        if (!GameState.soundEnabled) return;
        this.init();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    playClick() {
        this.play(600, 'sine', 0.1, 0.05);
    },

    playToggle(on) {
        this.play(on ? 800 : 400, 'sine', 0.1, 0.05);
    },

    playSuccess() {
        const now = this.ctx ? this.ctx.currentTime : 0;
        this.play(523.25, 'sine', 0.3, 0.1); // C5
        setTimeout(() => this.play(659.25, 'sine', 0.3, 0.1), 100); // E5
        setTimeout(() => this.play(783.99, 'sine', 0.4, 0.1), 200); // G5
    },

    playWin() {
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            setTimeout(() => this.play(freq, 'triangle', 0.5, 0.1), i * 150);
        });
    },

    playGameOver() {
        const notes = [440, 349.23, 293.66]; // A4, F4, D4
        notes.forEach((freq, i) => {
            setTimeout(() => this.play(freq, 'sawtooth', 0.6, 0.05), i * 200);
        });
    },

    // Background Music (Calm Ambient Loop)
    bgMusic: {
        nodes: [],
        isPlaying: false
    },

    startMusic() {
        if (!GameState.soundEnabled || this.bgMusic.isPlaying) return;
        this.init();

        this.bgMusic.isPlaying = true;

        // "River" palette: Flowing, soft, slightly melancholic but peaceful
        // Fmaj7 -> C -> Am -> G6
        const progression = [
            [174.61, 220.00, 261.63, 349.23], // Fmaj7 (F3, A3, C4, F4)
            [130.81, 164.81, 196.00, 261.63], // C major (C3, E3, G3, C4)
            [110.00, 146.83, 174.61, 220.00], // Am (A2, D3, F3, A3)
            [98.00, 146.83, 196.00, 246.94]   // G6 (G2, D3, G3, B3)
        ];

        let chordIndex = 0;

        const playFlowingNote = (freq, time, volume = 0.012) => {
            // Primary tone (warm sine)
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(freq, time);

            // Texture tone (soft triangle)
            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(freq * 1.001, time); // Slight detune for richness

            gain1.gain.setValueAtTime(0, time);
            gain1.gain.linearRampToValueAtTime(volume, time + 4);
            gain1.gain.linearRampToValueAtTime(0, time + 12);

            gain2.gain.setValueAtTime(0, time);
            gain2.gain.linearRampToValueAtTime(volume * 0.3, time + 4);
            gain2.gain.linearRampToValueAtTime(0, time + 12);

            osc1.connect(gain1);
            gain1.connect(this.ctx.destination);
            osc2.connect(gain2);
            gain2.connect(this.ctx.destination);

            osc1.start(time);
            osc1.stop(time + 12);
            osc2.start(time);
            osc2.stop(time + 12);

            this.bgMusic.nodes.push(osc1, osc2);
        };

        const loop = () => {
            if (!this.bgMusic.isPlaying) return;
            const time = this.ctx.currentTime;
            const chord = progression[chordIndex];

            // Arpeggiate the chord for a "river flow" effect
            chord.forEach((freq, i) => {
                playFlowingNote(freq, time + (i * 1.5));
            });

            chordIndex = (chordIndex + 1) % progression.length;
            setTimeout(loop, 7000); // Overlap for continuous flow
        };

        loop();
    },

    stopMusic() {
        this.bgMusic.isPlaying = false;
        this.bgMusic.nodes.forEach(node => {
            try { node.stop(); } catch (e) { }
        });
        this.bgMusic.nodes = [];
    }
};

// ============================================
// Puzzle Generator
// ============================================
const PuzzleGenerator = {
    generate(size) {
        const grid = [];
        const solution = [];
        const rowTargets = [];
        const colTargets = [];

        // Generate random numbers (1-9) for the grid
        for (let i = 0; i < size; i++) {
            grid[i] = [];
            solution[i] = [];
            for (let j = 0; j < size; j++) {
                grid[i][j] = Math.floor(Math.random() * 9) + 1;
                solution[i][j] = Math.random() < 0.6;
            }
        }

        // Ensure constraints: min 2 active AND at least 1 inactive per row
        for (let i = 0; i < size; i++) {
            let rowActive = solution[i].filter(x => x).length;
            // Ensure at least 2 active
            while (rowActive < 2) {
                const j = Math.floor(Math.random() * size);
                if (!solution[i][j]) {
                    solution[i][j] = true;
                    rowActive++;
                }
            }
            // Ensure at least 1 inactive (to prevent pre-solved state)
            if (rowActive === size) {
                const j = Math.floor(Math.random() * size);
                solution[i][j] = false;
                rowActive--;
            }
        }

        // Ensure constraints: min 2 active AND at least 1 inactive per column
        for (let j = 0; j < size; j++) {
            let colActive = 0;
            for (let i = 0; i < size; i++) if (solution[i][j]) colActive++;

            // Ensure at least 2 active
            while (colActive < 2) {
                const i = Math.floor(Math.random() * size);
                if (!solution[i][j]) {
                    // Before making it true, check if this would make a row all-active
                    // If it would, we might need to pick another cell or flip a different one in that row
                    solution[i][j] = true;
                    colActive++;
                }
            }

            // Ensure at least 1 inactive
            if (colActive === size) {
                const i = Math.floor(Math.random() * size);
                solution[i][j] = false;
                colActive--;
            }
        }

        // Final pass: Ensure no row became all-active due to column adjustments
        for (let i = 0; i < size; i++) {
            let rowActive = solution[i].filter(x => x).length;
            if (rowActive === size) {
                // Find a cell that can be flipped to false without violating colActive < 2
                let candidates = [];
                for (let j = 0; j < size; j++) {
                    let colActive = 0;
                    for (let k = 0; k < size; k++) if (solution[k][j]) colActive++;
                    if (colActive > 2) candidates.push(j);
                }

                if (candidates.length > 0) {
                    const j = candidates[Math.floor(Math.random() * candidates.length)];
                    solution[i][j] = false;
                } else {
                    // Force it anyway, 1 active is better than pre-solved
                    const j = Math.floor(Math.random() * size);
                    solution[i][j] = false;
                }
            }
        }

        // Calculate target sums
        for (let i = 0; i < size; i++) {
            let rowSum = 0;
            for (let j = 0; j < size; j++) {
                if (solution[i][j]) {
                    rowSum += grid[i][j];
                }
            }
            rowTargets.push(rowSum);
        }

        for (let j = 0; j < size; j++) {
            let colSum = 0;
            for (let i = 0; i < size; i++) {
                if (solution[i][j]) {
                    colSum += grid[i][j];
                }
            }
            colTargets.push(colSum);
        }

        return { grid, solution, rowTargets, colTargets };
    }
};

// ============================================
// Game Controller
// ============================================
const Game = {
    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.applyTheme();
        this.updateContinueButton();
        this.applySettingsUI();
        this.initLoadingScreen();
    },

    initLoadingScreen() {
        const loader = document.getElementById('loadingScreen');
        if (loader) {
            // Stay for at least 3 seconds to show off the brand
            setTimeout(() => {
                loader.classList.add('fade-out');
                setTimeout(() => loader.remove(), 800);
            }, 3000);
        }
    },

    applySettingsUI() {
        const soundToggle = document.getElementById('soundToggle');
        if (soundToggle) {
            soundToggle.classList.toggle('active', GameState.soundEnabled);
        }

        const vibrationToggle = document.getElementById('vibrationToggle');
        if (vibrationToggle) {
            vibrationToggle.classList.toggle('active', GameState.vibrationEnabled);
        }

        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            darkModeToggle.classList.toggle('active', GameState.isDarkMode);
        }

        // Apply active mode button
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === GameState.mode);
        });
    },

    // Check if there's a saved game to continue
    hasSavedGame() {
        try {
            const data = JSON.parse(localStorage.getItem('sumthing_game'));
            return data && data.grid && data.grid.length > 0;
        } catch (e) {
            return false;
        }
    },

    updateContinueButton() {
        const continueBtn = document.getElementById('continueBtn');
        if (continueBtn) {
            if (this.hasSavedGame()) {
                continueBtn.style.display = 'flex';
                continueBtn.disabled = false;
            } else {
                continueBtn.style.display = 'none';
            }
        }
    },

    startGame() {
        document.getElementById('startScreen').classList.remove('active');
        document.getElementById('gameScreen').classList.add('active');
        this.loadLevel(GameState.level);
        this.render();
    },

    // Resume a saved game
    continueGame() {
        if (!this.loadGameState()) {
            // No saved game, start new
            this.startGame();
            return;
        }

        document.getElementById('startScreen').classList.remove('active');
        document.getElementById('gameScreen').classList.add('active');

        // Resume timer from saved elapsed time
        GameState.startTime = Date.now() - GameState.elapsedTime;
        if (GameState.mode !== 'zen') {
            this.startTimer();
        }

        this.updateDisplay();
        this.render();
    },

    backToMenu() {
        this.stopTimer();
        // Save current game state so it can be resumed
        this.saveGameState();
        document.getElementById('gameScreen').classList.remove('active');
        document.getElementById('startScreen').classList.add('active');
        this.updateContinueButton();
        this.closeAllModals();
    },

    loadLevel(level) {
        let size = 5;
        if (level >= 6) size = 6;
        if (level >= 11) size = 7;
        if (level >= 16) size = 8;

        GameState.size = size;
        GameState.level = level;

        // Set CSS variable for grid size
        document.documentElement.style.setProperty('--grid-size', size);

        // UI Adjustments for modes
        const timerContainer = document.querySelector('.status-item:last-child');
        const bestTimeContainer = document.getElementById('bestTimeContainer');
        const timerLabel = document.getElementById('timerLabel');

        if (GameState.mode === 'zen') {
            timerContainer.style.opacity = '0';
            if (bestTimeContainer) bestTimeContainer.style.display = 'none';
        } else {
            timerContainer.style.opacity = '1';
            if (timerLabel) {
                timerLabel.textContent = GameState.mode === 'timed' ? 'Timer' : 'Time';
            }

            if (GameState.mode === 'classic') {
                if (bestTimeContainer) bestTimeContainer.style.display = 'flex';
            } else {
                if (bestTimeContainer) bestTimeContainer.style.display = 'none';
            }
        }

        const puzzle = PuzzleGenerator.generate(size);
        GameState.grid = puzzle.grid;
        GameState.solution = puzzle.solution;
        GameState.rowTargets = puzzle.rowTargets;
        GameState.colTargets = puzzle.colTargets;

        // Initialize player state (all cells start active)
        GameState.playerState = [];
        for (let i = 0; i < size; i++) {
            GameState.playerState[i] = [];
            for (let j = 0; j < size; j++) {
                GameState.playerState[i][j] = true;
            }
        }

        GameState.moves = 0;
        GameState.hintsUsed = 0;
        GameState.isComplete = false;
        GameState.elapsedTime = 0;
        GameState.startTime = Date.now();

        this.stopTimer();

        // Setup initial time for Timed mode
        if (GameState.mode === 'timed') {
            // 60s for 5x5, +30s per size increase
            GameState.remainingTime = (GameState.size - 3) * 30;
        }

        GameState.startTime = Date.now();
        if (GameState.mode !== 'zen') {
            this.startTimer();
        }

        this.updateDisplay();
    },

    toggleCell(row, col) {
        if (GameState.isComplete) return;

        GameState.playerState[row][col] = !GameState.playerState[row][col];
        GameState.moves++;

        // Sound feedback
        SoundManager.playToggle(GameState.playerState[row][col]);

        // Haptic feedback
        if (GameState.vibrationEnabled && navigator.vibrate) {
            navigator.vibrate(10);
        }

        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            cell.classList.add('pop');
            setTimeout(() => cell.classList.remove('pop'), 200);
        }

        this.render();
        this.checkLineCompletion(row, col);

        // AUTO-CHECK for puzzle completion after each move!
        if (this.checkSolution()) {
            this.onPuzzleSolved();
        }
    },

    checkLineCompletion(row, col) {
        const rowCorrect = this.isRowCorrect(row);
        const colCorrect = this.isColCorrect(col);

        if (rowCorrect || colCorrect) {
            SoundManager.playSuccess();
        }

        if (rowCorrect) {
            for (let j = 0; j < GameState.size; j++) {
                const cell = document.querySelector(`[data-row="${row}"][data-col="${j}"]`);
                if (cell && GameState.playerState[row][j]) {
                    cell.classList.add('line-complete');
                    setTimeout(() => cell.classList.remove('line-complete'), 500);
                }
            }
        }

        if (colCorrect) {
            for (let i = 0; i < GameState.size; i++) {
                const cell = document.querySelector(`[data-row="${i}"][data-col="${col}"]`);
                if (cell && GameState.playerState[i][col]) {
                    cell.classList.add('line-complete');
                    setTimeout(() => cell.classList.remove('line-complete'), 500);
                }
            }
        }
    },

    getRowSum(row) {
        let sum = 0;
        for (let j = 0; j < GameState.size; j++) {
            if (GameState.playerState[row][j]) {
                sum += GameState.grid[row][j];
            }
        }
        return sum;
    },

    getColSum(col) {
        let sum = 0;
        for (let i = 0; i < GameState.size; i++) {
            if (GameState.playerState[i][col]) {
                sum += GameState.grid[i][col];
            }
        }
        return sum;
    },

    isRowCorrect(row) {
        return this.getRowSum(row) === GameState.rowTargets[row];
    },

    isColCorrect(col) {
        return this.getColSum(col) === GameState.colTargets[col];
    },

    checkSolution() {
        for (let i = 0; i < GameState.size; i++) {
            if (!this.isRowCorrect(i) || !this.isColCorrect(i)) {
                return false;
            }
        }
        return true;
    },

    onPuzzleSolved() {
        if (GameState.isComplete) return; // Prevent double trigger

        GameState.isComplete = true;
        this.stopTimer();

        // Sound feedback for win
        SoundManager.playWin();

        // Clear saved game state (puzzle is done)
        this.clearGameState();

        // Save Best Time for Classic mode
        if (GameState.mode === 'classic') {
            const currentLevel = GameState.level.toString();
            const timeInSeconds = Math.floor(GameState.elapsedTime / 1000);

            if (!GameState.bestTimes[currentLevel] || timeInSeconds < GameState.bestTimes[currentLevel]) {
                GameState.bestTimes[currentLevel] = timeInSeconds;
                this.saveSettings();
            }
        }

        // Haptic feedback for win
        if (GameState.vibrationEnabled && navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 200]);
        }

        this.showConfetti();

        // Reset modal state (in case we came from a "Time's Up" before)
        const modal = document.getElementById('winModal');
        modal.querySelector('h2').textContent = "Puzzle Solved!";
        modal.querySelector('.modal-icon').textContent = "🎉";

        const nextBtn = document.getElementById('nextLevelBtn');
        const retryBtn = document.getElementById('retryBtn');
        if (nextBtn) nextBtn.style.display = 'flex';
        if (retryBtn) retryBtn.style.display = 'none';

        document.getElementById('winTime').textContent = this.formatTime(GameState.elapsedTime);
        document.getElementById('winMoves').textContent = GameState.moves;

        setTimeout(() => {
            document.getElementById('winModal').classList.add('active');
        }, 600);
    },

    showConfetti() {
        const colors = ['#667eea', '#00d9a5', '#f093fb', '#ffc107', '#ff6b6b', '#764ba2'];
        const shapes = ['circle', 'square'];

        for (let i = 0; i < 60; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + 'vw';
                confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDuration = (2.5 + Math.random() * 2) + 's';
                confetti.style.borderRadius = shapes[Math.floor(Math.random() * shapes.length)] === 'circle' ? '50%' : '2px';
                confetti.style.width = (8 + Math.random() * 8) + 'px';
                confetti.style.height = confetti.style.width;
                document.body.appendChild(confetti);

                setTimeout(() => confetti.remove(), 4500);
            }, i * 40);
        }
    },

    giveHint() {
        if (GameState.hintsUsed >= 3 || GameState.isComplete) return;

        for (let i = 0; i < GameState.size; i++) {
            for (let j = 0; j < GameState.size; j++) {
                if (GameState.playerState[i][j] !== GameState.solution[i][j]) {
                    GameState.playerState[i][j] = GameState.solution[i][j];
                    GameState.hintsUsed++;

                    const cell = document.querySelector(`[data-row="${i}"][data-col="${j}"]`);
                    if (cell) {
                        cell.classList.add('pop');
                        setTimeout(() => cell.classList.remove('pop'), 200);
                    }

                    this.render();
                    this.updateDisplay();

                    // Check if hint solved the puzzle
                    if (this.checkSolution()) {
                        this.onPuzzleSolved();
                    }
                    return;
                }
            }
        }
    },

    resetPuzzle() {
        for (let i = 0; i < GameState.size; i++) {
            for (let j = 0; j < GameState.size; j++) {
                GameState.playerState[i][j] = true;
            }
        }
        GameState.moves = 0;
        GameState.isComplete = false;
        GameState.elapsedTime = 0;
        GameState.startTime = Date.now();
        this.stopTimer(); // Ensure old timer is stopped
        if (GameState.mode !== 'zen') {
            this.startTimer();
        }
        this.render();
        this.updateDisplay();
    },

    nextLevel() {
        GameState.level++;

        document.getElementById('winModal').classList.remove('active');
        this.loadLevel(GameState.level);
        this.render();
    },

    newGame() {
        GameState.level = 1;
        this.startGame();
    },

    // ============================================
    // Theme Management
    // ============================================
    toggleTheme() {
        GameState.isDarkMode = !GameState.isDarkMode;
        this.applyTheme();
        this.saveProgress();
    },

    applyTheme() {
        if (GameState.isDarkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.querySelector('.sun-icon')?.style.setProperty('display', 'none');
            document.querySelector('.moon-icon')?.style.setProperty('display', 'block');
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.querySelector('.sun-icon')?.style.setProperty('display', 'block');
            document.querySelector('.moon-icon')?.style.setProperty('display', 'none');
        }

        // Update toggle switch in settings
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            darkModeToggle.classList.toggle('active', GameState.isDarkMode);
        }
    },

    // ============================================
    // Timer Functions
    // ============================================
    startTimer() {
        this.stopTimer();
        GameState.timerInterval = setInterval(() => {
            if (GameState.mode === 'timed') {
                // Countdown
                const now = Date.now();
                const diff = now - GameState.startTime;
                const remaining = (GameState.remainingTime * 1000) - diff;

                if (remaining <= 0) {
                    GameState.elapsedTime = GameState.remainingTime * 1000;
                    document.getElementById('timerDisplay').textContent = "00:00";
                    this.onGameOver();
                    return;
                }

                GameState.elapsedTime = diff;
                document.getElementById('timerDisplay').textContent =
                    this.formatTime(remaining);
            } else {
                // Count up
                GameState.elapsedTime = Date.now() - GameState.startTime;
                document.getElementById('timerDisplay').textContent =
                    this.formatTime(GameState.elapsedTime);
            }
        }, 1000);
    },

    onGameOver() {
        this.stopTimer();
        GameState.isComplete = true;

        // Sound feedback for game over
        SoundManager.playGameOver();

        // Show game over modal instead of win modal
        const modal = document.getElementById('winModal');
        modal.querySelector('h2').textContent = "Time's Up!";
        modal.querySelector('.modal-icon').textContent = "⏰";

        const nextBtn = document.getElementById('nextLevelBtn');
        const retryBtn = document.getElementById('retryBtn');
        if (nextBtn) nextBtn.style.display = 'none';
        if (retryBtn) retryBtn.style.display = 'flex';

        document.getElementById('winTime').textContent = this.formatTime(GameState.remainingTime * 1000);
        document.getElementById('winMoves').textContent = GameState.moves;

        modal.classList.add('active');
    },

    stopTimer() {
        if (GameState.timerInterval) {
            clearInterval(GameState.timerInterval);
            GameState.timerInterval = null;
        }
    },

    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },

    // ============================================
    // Rendering - Unified Grid Approach
    // ============================================
    render() {
        this.renderUnifiedBoard();
    },

    /**
     * Renders the entire game board as a single unified CSS grid
     * Layout: (size+1) columns x (size+1) rows
     * 
     * Row 0: [empty corner] [col target 0] [col target 1] ... [col target N]
     * Row 1: [cell 0,0] [cell 0,1] ... [cell 0,N] [row target 0]
     * Row 2: [cell 1,0] [cell 1,1] ... [cell 1,N] [row target 1]
     * ...
     */
    renderUnifiedBoard() {
        const boardEl = document.getElementById('gameBoard');
        boardEl.innerHTML = '';

        const size = GameState.size;

        // Set grid template: (size) cells + 1 for row targets columns, 
        // and (size) cells + 1 for col targets rows
        boardEl.style.gridTemplateColumns = `repeat(${size}, var(--cell-size)) calc(var(--cell-size) * 0.7)`;
        boardEl.style.gridTemplateRows = `calc(var(--cell-size) * 0.75) repeat(${size}, var(--cell-size))`;

        // Row 0: Column targets
        for (let j = 0; j < size; j++) {
            const target = document.createElement('div');
            target.className = 'target col-target';
            target.textContent = GameState.colTargets[j];

            const currentSum = this.getColSum(j);
            if (currentSum === GameState.colTargets[j]) {
                target.classList.add('correct');
            } else if (currentSum > GameState.colTargets[j]) {
                target.classList.add('incorrect');
            }

            // Target Feedback on tap
            target.addEventListener('click', () => {
                const diff = GameState.colTargets[j] - currentSum;
                let message = `Current column sum: ${currentSum}`;
                if (diff > 0) message += ` (Need ${diff} more)`;
                else if (diff < 0) message += ` (Over by ${Math.abs(diff)})`;
                else message += ` (Solved!)`;

                this.showToast(message, diff === 0 ? 'success' : 'info');
            });

            boardEl.appendChild(target);
        }

        // Empty corner for row 0, last column (no target in top-right)
        const corner = document.createElement('div');
        corner.className = 'corner-spacer';
        boardEl.appendChild(corner);

        // Rows 1 to size: Cells + Row target
        for (let i = 0; i < size; i++) {
            // Cells in this row
            for (let j = 0; j < size; j++) {
                const cell = document.createElement('button');
                cell.className = 'cell';
                cell.dataset.row = i;
                cell.dataset.col = j;
                cell.textContent = GameState.grid[i][j];

                if (!GameState.playerState[i][j]) {
                    cell.classList.add('disabled');
                }

                cell.addEventListener('click', () => this.toggleCell(i, j));
                boardEl.appendChild(cell);
            }

            // Row target at end of this row
            const rowTarget = document.createElement('div');
            rowTarget.className = 'target row-target';
            rowTarget.textContent = GameState.rowTargets[i];

            const rowSum = this.getRowSum(i);
            if (rowSum === GameState.rowTargets[i]) {
                rowTarget.classList.add('correct');
            } else if (rowSum > GameState.rowTargets[i]) {
                rowTarget.classList.add('incorrect');
            }

            // Target Feedback on tap
            rowTarget.addEventListener('click', () => {
                const diff = GameState.rowTargets[i] - rowSum;
                let message = `Current row sum: ${rowSum}`;
                if (diff > 0) message += ` (Need ${diff} more)`;
                else if (diff < 0) message += ` (Over by ${Math.abs(diff)})`;
                else message += ` (Solved!)`;

                this.showToast(message, diff === 0 ? 'success' : 'info');
            });

            boardEl.appendChild(rowTarget);
        }
    },

    updateDisplay() {
        document.getElementById('levelDisplay').textContent = GameState.level;
        document.getElementById('sizeDisplay').textContent = `${GameState.size}×${GameState.size}`;

        // Timer display (depends on mode)
        let displayTime = GameState.elapsedTime;
        if (GameState.mode === 'timed') {
            displayTime = Math.max(0, (GameState.remainingTime * 1000) - GameState.elapsedTime);
        }
        document.getElementById('timerDisplay').textContent = this.formatTime(displayTime);

        // Best time display (Classic mode)
        const bestTimeDisplay = document.getElementById('bestTimeDisplay');
        if (bestTimeDisplay && GameState.mode === 'classic') {
            const best = GameState.bestTimes[GameState.level.toString()];
            bestTimeDisplay.textContent = best ? this.formatTime(best * 1000) : '--:--';
        }

        // Hint button update
        const hintBtn = document.getElementById('hintBtn');
        if (hintBtn) {
            const span = hintBtn.querySelector('span');
            if (span) span.textContent = `Hint (${Math.max(0, 3 - GameState.hintsUsed)})`;
            hintBtn.disabled = GameState.hintsUsed >= 3;
            hintBtn.style.opacity = GameState.hintsUsed >= 3 ? '0.5' : '1';
        }
    },

    // ============================================
    // Event Listeners
    // ============================================
    setupEventListeners() {
        // Start screen buttons
        document.getElementById('playBtn').addEventListener('click', () => {
            SoundManager.playClick();
            SoundManager.startMusic();
            this.newGame();
        });
        document.getElementById('continueBtn').addEventListener('click', () => {
            SoundManager.playClick();
            SoundManager.startMusic();
            this.continueGame();
        });
        document.getElementById('startHowToPlayBtn').addEventListener('click', () => {
            SoundManager.playClick();
            document.getElementById('tutorialModal').classList.add('active');
        });
        document.getElementById('settingsStartBtn').addEventListener('click', () => {
            SoundManager.playClick();
            document.getElementById('settingsModal').classList.add('active');
        });

        // Game screen buttons
        document.getElementById('hintBtn').addEventListener('click', () => {
            SoundManager.playClick();
            this.giveHint();
        });
        document.getElementById('resetBtn').addEventListener('click', () => {
            SoundManager.playClick();
            this.resetPuzzle();
        });
        document.getElementById('backBtn').addEventListener('click', () => {
            SoundManager.playClick();
            this.onBackButton();
        });
        document.getElementById('themeToggle').addEventListener('click', () => {
            SoundManager.playClick();
            this.toggleTheme();
        });

        // Win/Game Over modal
        document.getElementById('retryBtn').addEventListener('click', () => {
            SoundManager.playClick();
            this.closeAllModals();
            this.loadLevel(GameState.level);
        });
        document.getElementById('nextLevelBtn').addEventListener('click', () => {
            SoundManager.playClick();
            this.nextLevel();
        });
        document.getElementById('backToMenuBtn').addEventListener('click', () => {
            SoundManager.playClick();
            this.backToMenu();
        });

        // Quit Modal (Exit App)
        document.getElementById('confirmQuitBtn').addEventListener('click', () => {
            SoundManager.playClick();
            if (window.Capacitor && window.Capacitor.Plugins.App) {
                window.Capacitor.Plugins.App.exitApp();
            } else {
                this.backToMenu(); // Fallback for browser
            }
        });
        document.getElementById('cancelQuitBtn').addEventListener('click', () => {
            SoundManager.playClick();
            document.getElementById('quitModal').classList.remove('active');
        });

        // Settings modal
        document.getElementById('closeSettingsBtn').addEventListener('click', () => {
            SoundManager.playClick();
            this.closeAllModals();
        });
        document.getElementById('darkModeToggle').addEventListener('click', (e) => {
            SoundManager.playClick();
            e.target.closest('.toggle-switch').classList.toggle('active');
            this.toggleTheme();
        });
        document.getElementById('soundToggle').addEventListener('click', (e) => {
            SoundManager.playClick();
            const toggle = e.target.closest('.toggle-switch');
            toggle.classList.toggle('active');
            GameState.soundEnabled = toggle.classList.contains('active');

            if (GameState.soundEnabled) {
                SoundManager.startMusic();
            } else {
                SoundManager.stopMusic();
            }

            this.saveSettings();
        });
        document.getElementById('vibrationToggle').addEventListener('click', (e) => {
            SoundManager.playClick();
            const toggle = e.target.closest('.toggle-switch');
            toggle.classList.toggle('active');
            GameState.vibrationEnabled = toggle.classList.contains('active');
            this.saveProgress();
        });

        // Tutorial modal
        document.getElementById('closeTutorialBtn').addEventListener('click', () => {
            SoundManager.playClick();
            this.closeAllModals();
        });

        // Mode selector (in start menu)
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                SoundManager.playClick();
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                GameState.mode = e.target.dataset.mode;
                this.saveSettings();
            });
        });

        // Close modals on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    // Don't close win modal by clicking outside
                    if (modal.id !== 'winModal') {
                        modal.classList.remove('active');
                    }
                }
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    },

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    },

    // ============================================
    // Persistence - Settings (always saved)
    // ============================================
    saveSettings() {
        const data = {
            level: GameState.level,
            mode: GameState.mode,
            isDarkMode: GameState.isDarkMode,
            soundEnabled: GameState.soundEnabled,
            vibrationEnabled: GameState.vibrationEnabled,
            bestTimes: GameState.bestTimes
        };
        localStorage.setItem('sumthing_settings', JSON.stringify(data));
    },

    loadSettings() {
        try {
            const data = JSON.parse(localStorage.getItem('sumthing_settings'));
            if (data) {
                GameState.level = data.level || 1;
                GameState.mode = data.mode || 'classic';
                GameState.isDarkMode = data.isDarkMode || false;
                GameState.soundEnabled = data.soundEnabled !== false;
                GameState.vibrationEnabled = data.vibrationEnabled !== false;
                GameState.bestTimes = data.bestTimes || {};
            } else {
                GameState.soundEnabled = true;
                GameState.vibrationEnabled = true;
            }
            this.applySettingsUI();
        } catch (e) {
            console.log('No saved settings found');
            GameState.soundEnabled = true;
            GameState.vibrationEnabled = true;
            this.applySettingsUI();
        }
    },

    // ============================================
    // Persistence - Game State (for resume)
    // ============================================
    saveGameState() {
        const data = {
            grid: GameState.grid,
            solution: GameState.solution,
            playerState: GameState.playerState,
            rowTargets: GameState.rowTargets,
            colTargets: GameState.colTargets,
            size: GameState.size,
            level: GameState.level,
            moves: GameState.moves,
            elapsedTime: GameState.elapsedTime,
            hintsUsed: GameState.hintsUsed,
            isComplete: GameState.isComplete
        };
        localStorage.setItem('sumthing_game', JSON.stringify(data));
    },

    loadGameState() {
        try {
            const data = JSON.parse(localStorage.getItem('sumthing_game'));
            if (data && data.grid && data.grid.length > 0) {
                GameState.grid = data.grid;
                GameState.solution = data.solution;
                GameState.playerState = data.playerState;
                GameState.rowTargets = data.rowTargets;
                GameState.colTargets = data.colTargets;
                GameState.size = data.size;
                GameState.level = data.level;
                GameState.moves = data.moves || 0;
                GameState.elapsedTime = data.elapsedTime || 0;
                GameState.hintsUsed = data.hintsUsed || 0;
                GameState.isComplete = data.isComplete || false;

                document.documentElement.style.setProperty('--grid-size', GameState.size);
                return true;
            }
        } catch (e) {
            console.log('No saved game found');
        }
        return false;
    },

    clearGameState() {
        localStorage.removeItem('sumthing_game');
    },

    // Wrapper for backward compatibility
    saveProgress() {
        this.saveSettings();
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            info: '💡',
            warning: '⚠️'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || '✨'}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    onBackButton() {
        const gameActive = document.getElementById('gameScreen').classList.contains('active');
        const startActive = document.getElementById('startScreen').classList.contains('active');
        const anyModalActive = !!document.querySelector('.modal.active');

        if (anyModalActive) {
            this.closeAllModals();
        } else if (gameActive) {
            // Just go back to menu without asking
            this.backToMenu();
        } else if (startActive) {
            // Sarcastic Max Payne style quotes
            const quitQuotes = [
                "The numbers will miss you. Well, some of them.",
                "Go ahead. Real life is way more interesting. Obviously.",
                "I'll just sit here in the dark. Don't mind me.",
                "Math is hard. I totally get it.",
                "Running away from your problems? Classic move.",
                "I'm sure you have much more important things to do.",
                "Real life doesn't have a 'Hint' button, you know.",
                "Oh, was this a bit too much for you?",
                "The solution was right there. But sure, leave.",
                "Fine. Go be productive. See if I care.",
                "I thought we had something special. Just another 'Sumthing' I guess."
            ];

            const randomQuote = quitQuotes[Math.floor(Math.random() * quitQuotes.length)];
            const quitMsgEl = document.getElementById('quitMessage');
            if (quitMsgEl) quitMsgEl.textContent = randomQuote;

            document.getElementById('quitModal').classList.add('active');
        }
    }
};

// ============================================
// Capacitor Integration (Back Button)
// ============================================
if (window.Capacitor) {
    const { App } = window.Capacitor.Plugins;
    if (App) {
        App.addListener('backButton', () => {
            Game.onBackButton();
        });
    }
}

// ============================================
// Initialize on DOM Ready
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    Game.init();
});
