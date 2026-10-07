/**
 * Wumpus World - UI Controller & DOM Renderer
 * Manages screen transitions, board rendering, HUD updates, minimap radar,
 * AI reasoning panel, combat logs, directional arrow aiming, and touch/keyboard input.
 */

class UIManager {
    constructor() {
        this.currentScreen = 'screen-home';
        this.selectedMode = 'SINGLE';
        this.selectedDifficulty = 'easy';
        this.selectedLevel = 1;
        this.selectedAiDifficulty = 'normal';
        this.selectedGridSize = 4;
        this.isAiming = false;
        this.minimapExpanded = false;
        this.gridZoom = 1.0;
        this.showCoords = true;

        this.init();
    }

    init() {
        this.bindNavigationEvents();
        this.bindGameInputEvents();
        this.bindViewportControls();
        this.bindEngineCallbacks();
        this.loadSettingsToUI();
        this.renderLeaderboard();
        this.renderAchievements();
        this.setupInteractiveTutorial();
    }

    // ==================== SCREEN ROUTING ====================

    goToMainMenu() {
        // 1. Cancel aiming mode
        this.cancelAimingMode();

        // 2. Close all modal overlays
        this.closeModal('modal-pause');
        this.closeModal('modal-aiming');
        this.closeModal('modal-credits');

        // 3. Clear temporary achievement toasts / popups
        document.querySelectorAll('.achievement-toast').forEach(toast => toast.remove());

        // 4. Reset current game session (preserves achievements, unlocked levels, claimed rewards, settings)
        if (window.GameEngine) {
            window.GameEngine.resetSession();
        }

        // 5. Hide all screens (closes victory, gameover, gameplay, etc.)
        document.querySelectorAll('.game-screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // 6. Return to HOME screen
        const homeScreen = document.getElementById('screen-home');
        if (homeScreen) {
            homeScreen.classList.add('active');
            this.currentScreen = 'screen-home';
        }

        // 7. Tactile UI sound
        if (window.GameAudio) {
            window.GameAudio.playClick();
        }
    }

    showScreen(screenId) {
        document.querySelectorAll('.game-screen').forEach(screen => {
            screen.classList.remove('active');
        });

        const target = document.getElementById(screenId);
        if (target) {
            target.classList.add('active');
            this.currentScreen = screenId;
        }

        if (window.GameAudio) {
            window.GameAudio.playClick();
        }

        // If navigating to leaderboard or achievements, refresh their views
        if (screenId === 'screen-leaderboard') this.renderLeaderboard();
        if (screenId === 'screen-achievements') this.renderAchievements();
        if (screenId === 'screen-settings') this.loadSettingsToUI();
    }

    bindNavigationEvents() {
        // Main Menu buttons
        document.getElementById('btn-play-game')?.addEventListener('click', () => {
            this.showScreen('screen-mode');
        });

        document.getElementById('btn-how-to-play')?.addEventListener('click', () => {
            this.showScreen('screen-how-to-play');
        });

        document.getElementById('btn-leaderboard')?.addEventListener('click', () => {
            this.showScreen('screen-leaderboard');
        });

        document.getElementById('btn-achievements')?.addEventListener('click', () => {
            this.showScreen('screen-achievements');
        });

        document.getElementById('btn-settings')?.addEventListener('click', () => {
            this.showScreen('screen-settings');
        });

        document.getElementById('btn-credits')?.addEventListener('click', () => {
            this.openModal('modal-credits');
        });

        // Mode Selection - handles both .mode-card and [data-mode]
        document.querySelectorAll('.mode-card, .selection-card[data-mode]').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.mode-card, .selection-card[data-mode]').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedMode = card.dataset.mode;
                if (window.GameAudio) window.GameAudio.playClick();
            });
        });

        document.getElementById('btn-mode-next')?.addEventListener('click', () => {
            // Update difficulty screen hints based on mode
            const aiDiffGroup = document.getElementById('ai-difficulty-group');
            if (aiDiffGroup) {
                aiDiffGroup.style.display = (this.selectedMode === 'VS_AI' || this.selectedMode === 'AI_VS_AI') ? 'block' : 'none';
            }
            // Pre-select the furthest level the player has unlocked
            this.selectedLevel = window.GameStorage.getHighestUnlockedLevel(window.WumpusLevels.count);
            this.renderLevelSelect();
            this.showScreen('screen-difficulty');
        });

        document.getElementById('btn-mode-back')?.addEventListener('click', () => {
            this.goToMainMenu();
        });

        // Level selection cards are rendered dynamically (see renderLevelSelect)
        this.renderLevelSelect();

        document.querySelectorAll('.ai-diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.ai-diff-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedAiDifficulty = btn.dataset.aiDiff;
            });
        });

        document.getElementById('btn-start-expedition')?.addEventListener('click', () => {
            this.startNewGameSession();
        });

        document.getElementById('btn-diff-back')?.addEventListener('click', () => {
            this.showScreen('screen-mode');
        });

        // Generic back buttons -> return to home using centralized goToMainMenu
        document.querySelectorAll('.btn-back-home').forEach(btn => {
            btn.addEventListener('click', () => {
                this.goToMainMenu();
            });
        });

        // Audio Mute buttons in HUD & Home
        const toggleAudio = () => {
            if (window.GameAudio) {
                const muted = window.GameAudio.toggleMute();
                this.updateAudioIcons(muted);
            }
        };

        document.getElementById('btn-mute-toggle')?.addEventListener('click', toggleAudio);
        document.getElementById('hud-mute-btn')?.addEventListener('click', toggleAudio);

        // Pause Menu
        document.getElementById('hud-pause-btn')?.addEventListener('click', () => {
            this.openPauseModal();
        });

        document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
            this.closeModal('modal-pause');
            window.GameEngine.resumeGame();
        });

        document.getElementById('btn-pause-restart')?.addEventListener('click', () => {
            this.closeModal('modal-pause');
            this.startNewGameSession();
        });

        document.getElementById('btn-pause-how-to-play')?.addEventListener('click', () => {
            this.closeModal('modal-pause');
            this.showScreen('screen-how-to-play');
        });

        document.getElementById('btn-pause-abandon')?.addEventListener('click', () => {
            this.goToMainMenu();
        });

        // Minimap toggle
        document.getElementById('btn-toggle-minimap')?.addEventListener('click', () => {
            this.minimapExpanded = !this.minimapExpanded;
            const container = document.getElementById('minimap-container');
            if (container) {
                container.classList.toggle('expanded', this.minimapExpanded);
            }
        });

        // Modals close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal-overlay');
                if (modal) modal.classList.remove('active');
            });
        });

        // Game Over and Victory screen buttons
        document.getElementById('btn-gameover-retry')?.addEventListener('click', () => {
            this.startNewGameSession();
        });
        document.getElementById('btn-gameover-menu')?.addEventListener('click', () => {
            this.goToMainMenu();
        });

        document.getElementById('btn-victory-again')?.addEventListener('click', () => {
            this.startNewGameSession();
        });
        document.getElementById('btn-victory-next')?.addEventListener('click', () => {
            const next = this.nextLevelAfterVictory;
            if (next && window.GameStorage.isLevelUnlocked(next)) {
                this.selectedLevel = next;
                this.startNewGameSession();
            }
        });
        document.getElementById('btn-victory-levels')?.addEventListener('click', () => {
            this.renderLevelSelect();
            this.showScreen('screen-difficulty');
        });
        document.getElementById('btn-victory-menu')?.addEventListener('click', () => {
            this.goToMainMenu();
        });

        // AI vs AI Simulation speed buttons
        document.querySelectorAll('.sim-speed-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sim-speed-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const speed = parseInt(btn.dataset.speed, 10);
                window.GameEngine.setSimulationSpeed(speed);
            });
        });

        document.getElementById('btn-sim-step')?.addEventListener('click', () => {
            window.GameEngine.stepSimulationOnce();
        });
    }

    updateAudioIcons(muted) {
        const icons = document.querySelectorAll('.audio-icon');
        icons.forEach(icon => {
            icon.textContent = muted ? '🔇' : '🔊';
        });
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    }

    openPauseModal() {
        window.GameEngine.pauseGame();
        this.openModal('modal-pause');
    }

    // ==================== GAME SETUP & ENGINE BINDINGS ====================

    startNewGameSession() {
        this.showScreen('screen-game');

        // Configure UI panels based on mode
        const aiPanel = document.getElementById('ai-reasoning-panel');
        const simControls = document.getElementById('sim-controls-panel');
        const p2HudCard = document.getElementById('hud-player2-card');

        if (this.selectedMode === 'VS_AI' || this.selectedMode === 'AI_VS_AI') {
            if (aiPanel) aiPanel.style.display = 'flex';
        } else {
            if (aiPanel) aiPanel.style.display = 'none';
        }

        if (this.selectedMode === 'AI_VS_AI') {
            if (simControls) simControls.style.display = 'flex';
        } else {
            if (simControls) simControls.style.display = 'none';
        }

        if (this.selectedMode === 'VS_FRIEND' || this.selectedMode === 'VS_AI' || this.selectedMode === 'AI_VS_AI') {
            if (p2HudCard) p2HudCard.style.display = 'flex';
        } else {
            if (p2HudCard) p2HudCard.style.display = 'none';
        }

        // Clear Event Log
        const logContainer = document.getElementById('combat-log-content');
        if (logContainer) logContainer.innerHTML = '';

        // Start Engine
        window.GameEngine.startNewGame({
            mode: this.selectedMode,
            difficulty: this.selectedDifficulty,
            aiDifficulty: this.selectedAiDifficulty,
            gridSize: this.selectedGridSize,
            level: this.selectedLevel
        });

        this.renderBoard();
        this.updateHUD();
        this.updateMinimap();
    }

    bindEngineCallbacks() {
        const engine = window.GameEngine;

        engine.onEventLog = (msg, type) => {
            this.addCombatLog(msg, type);
        };

        engine.onTurnChange = (activePlayer) => {
            this.updateHUD();
            this.renderBoard();
            this.updateMinimap();
        };

        engine.onCellUpdate = (player) => {
            this.updateHUD();
            this.renderBoard();
            this.updateMinimap();
        };

        engine.onAIMove = (aiPlayer, decision) => {
            this.updateAIPanel(aiPlayer, decision);
        };

        engine.onVictory = (data) => {
            this.showVictoryScreen(data);
        };

        engine.onGameOver = (data) => {
            this.showGameOverScreen(data);
        };
    }

    // ==================== BOARD RENDERING ====================

    renderBoard() {
        const container = document.getElementById('dungeon-grid');
        if (!container || !window.GameEngine.board) return;

        const board = window.GameEngine.board;
        const size = board.size;
        const p1 = window.GameEngine.players[0];
        const p2 = window.GameEngine.players[1];
        const activePlayer = window.GameEngine.getActivePlayer();

        container.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
        container.style.gridTemplateRows = `repeat(${size}, 1fr)`;
        container.innerHTML = '';

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const cell = board.getCell(x, y);
                const cellDiv = document.createElement('div');
                cellDiv.className = 'dungeon-cell';
                cellDiv.dataset.x = x;
                cellDiv.dataset.y = y;

                const isP1Here = p1 && p1.isAlive && !p1.hasEscaped && p1.x === x && p1.y === y;
                const isP2Here = p2 && p2.isAlive && !p2.hasEscaped && p2.x === x && p2.y === y;
                const isActiveHere = activePlayer && activePlayer.x === x && activePlayer.y === y;

                // Fog of War evaluation
                if (!cell.explored) {
                    cellDiv.classList.add('fog-shrouded');
                } else {
                    cellDiv.classList.add('explored');

                    // Visited footprints
                    if (cell.visitedBy.length > 0) {
                        cellDiv.classList.add('visited');
                    }

                    // Entrance Ladder
                    if (x === 0 && y === 0) {
                        cellDiv.innerHTML += `<div class="cell-icon entrance-icon" title="Cave Entrance / Ladder">🪜</div>`;
                    }

                    // Hazards and Clues (only reveal if visited or slain)
                    if (cell.visitedBy.length > 0) {
                        if (cell.hasBreeze) cellDiv.innerHTML += `<div class="clue-tag breeze-tag" title="Breeze Detected">💨</div>`;
                        if (cell.hasStench) cellDiv.innerHTML += `<div class="clue-tag stench-tag" title="Stench Detected">☣️</div>`;
                    }

                    // If stepped in Pit
                    if (cell.isPit && cell.visitedBy.length > 0) {
                        cellDiv.classList.add('pit-cell');
                        cellDiv.innerHTML += `<div class="cell-hazard pit-hazard">🕳️<span class="hazard-label">PIT</span></div>`;
                    }

                    // Gold
                    if (cell.hasGold && cell.goldRef && !cell.goldRef.collected) {
                        // In Wumpus World, glitter is revealed when entering
                        if (cell.visitedBy.length > 0 || (isActiveHere)) {
                            cellDiv.innerHTML += `<div class="cell-item gold-item animate-pulse">💰<span class="gold-sparkle">✨</span></div>`;
                        }
                    }

                    // Wumpus
                    if (cell.isWumpus && cell.wumpusRef) {
                        if (!cell.wumpusRef.alive) {
                            cellDiv.classList.add('wumpus-slain');
                            cellDiv.innerHTML += `<div class="cell-hazard wumpus-dead">💀<span class="slain-label">SLAIN</span></div>`;
                        } else if (cell.visitedBy.length > 0) {
                            cellDiv.classList.add('wumpus-alive');
                            cellDiv.innerHTML += `<div class="cell-hazard wumpus-beast animate-pulse">👹<span class="hazard-label">WUMPUS</span></div>`;
                        }
                    }
                }

                // Coordinate watermark
                if (this.showCoords) {
                    const coordSpan = document.createElement('span');
                    coordSpan.className = 'cell-coord';
                    coordSpan.textContent = `${x},${y}`;
                    cellDiv.appendChild(coordSpan);
                }

                // Render Player Tokens
                if (isP1Here) {
                    const token = document.createElement('div');
                    token.className = `player-token token-p1 ${isActiveHere ? 'active-turn' : ''}`;
                    token.innerHTML = `<img src="assets/hero_knight.jpg" class="token-avatar" alt="P1" /><span class="token-badge">P1</span>`;
                    cellDiv.appendChild(token);
                }

                if (isP2Here) {
                    const token = document.createElement('div');
                    token.className = `player-token token-p2 ${isActiveHere ? 'active-turn' : ''}`;
                    token.innerHTML = `<img src="assets/hero_ranger.jpg" class="token-avatar" alt="P2" /><span class="token-badge">P2</span>`;
                    cellDiv.appendChild(token);
                }

                // Torchlight dynamic glow on active player's cell
                if (isActiveHere) {
                    cellDiv.classList.add('torch-illuminated');
                }

                container.appendChild(cellDiv);
            }
        }

        this.applyGridZoom();
    }

    bindViewportControls() {
        document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
            this.gridZoom = Math.min(1.4, Math.round((this.gridZoom + 0.1) * 10) / 10);
            this.applyGridZoom();
            if (window.GameAudio) window.GameAudio.playClick();
        });

        document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
            this.gridZoom = Math.max(0.6, Math.round((this.gridZoom - 0.1) * 10) / 10);
            this.applyGridZoom();
            if (window.GameAudio) window.GameAudio.playClick();
        });

        document.getElementById('btn-zoom-fit')?.addEventListener('click', () => {
            this.gridZoom = 1.0;
            this.applyGridZoom();
            if (window.GameAudio) window.GameAudio.playClick();
        });

        document.getElementById('btn-toggle-coords')?.addEventListener('click', () => {
            this.showCoords = !this.showCoords;
            this.renderBoard();
            if (window.GameAudio) window.GameAudio.playClick();
        });
    }

    applyGridZoom() {
        const grid = document.getElementById('dungeon-grid');
        const zoomText = document.getElementById('zoom-level-text');
        if (grid) {
            grid.style.transform = `scale(${this.gridZoom})`;
        }
        if (zoomText) {
            zoomText.textContent = `${Math.round(this.gridZoom * 100)}%`;
        }
    }

    // ==================== HUD UPDATES ====================

    updateHUD() {
        const engine = window.GameEngine;
        if (!engine || !engine.board) return;

        const p1 = engine.players[0];
        const p2 = engine.players[1];
        const active = engine.getActivePlayer();

        // Player 1 HUD
        if (p1) {
            document.getElementById('hud-p1-name').textContent = p1.name;
            document.getElementById('hud-p1-health').textContent = '❤️'.repeat(Math.max(0, p1.health)) || '☠️ Dead';
            document.getElementById('hud-p1-arrows').textContent = p1.arrows;
            document.getElementById('hud-p1-gold').textContent = p1.hasGold ? 'YES 💰' : 'NO';
            document.getElementById('hud-p1-score').textContent = p1.score;
            document.getElementById('hud-p1-pos').textContent = `(${p1.x}, ${p1.y})`;
            document.getElementById('hud-player1-card')?.classList.toggle('active-turn', active.id === p1.id);

            // Active Perk in HUD
            const perkElem = document.getElementById('hud-p1-perk');
            const perkTextElem = document.getElementById('hud-p1-perk-text');
            if (perkElem && perkTextElem) {
                let activeReward = null;
                if (engine.level && window.GameStorage) {
                    const activeRewards = window.GameStorage.getActiveRewardsForLevel(engine.level);
                    if (activeRewards && activeRewards.length > 0) {
                        activeReward = activeRewards[0];
                    }
                }
                if (activeReward) {
                    perkElem.style.display = 'inline-flex';
                    perkTextElem.textContent = `${activeReward.perkTitle} (${activeReward.perkDescription})`;
                    perkElem.title = `Active Cavern Perk: ${activeReward.perkTitle} - ${activeReward.perkDescription}`;
                } else {
                    perkElem.style.display = 'none';
                }
            }
        }

        // Player 2 / AI HUD
        if (p2) {
            document.getElementById('hud-p2-name').textContent = p2.name;
            document.getElementById('hud-p2-health').textContent = '❤️'.repeat(Math.max(0, p2.health)) || '☠️ Dead';
            document.getElementById('hud-p2-arrows').textContent = p2.arrows;
            document.getElementById('hud-p2-gold').textContent = p2.hasGold ? 'YES 💰' : 'NO';
            document.getElementById('hud-p2-score').textContent = p2.score;
            document.getElementById('hud-p2-pos').textContent = `(${p2.x}, ${p2.y})`;
            document.getElementById('hud-player2-card')?.classList.toggle('active-turn', active.id === p2.id);
        }

        // Active Turn Badge
        const turnBadge = document.getElementById('hud-turn-badge');
        if (turnBadge) {
            turnBadge.textContent = `${active.name}'s Turn`;
            turnBadge.className = `turn-indicator-badge ${active.id === 'p1' ? 'badge-p1' : 'badge-p2'}`;
        }

        // Timer
        const timerElem = document.getElementById('hud-timer');
        if (timerElem) {
            timerElem.textContent = engine.formatTime(engine.timerSeconds);
        }

        // Environmental Percept Clues for Active Player
        const percepts = engine.board.getPerceptsAt(active.x, active.y) || {};

        this.setPerceptBadge('percept-stench', percepts.stench);
        this.setPerceptBadge('percept-breeze', percepts.breeze);
        this.setPerceptBadge('percept-glitter', percepts.glitter);
        this.setPerceptBadge('percept-scream', engine.board.wumpusScream);
    }

    setPerceptBadge(elemId, isActive) {
        const badge = document.getElementById(elemId);
        if (badge) {
            badge.classList.toggle('active-clue', !!isActive);
            if (elemId === 'percept-breeze') {
                badge.title = isActive ? 'Breeze detected. A pit may be in an adjacent cell.' : 'No breeze detected in this chamber.';
            } else if (elemId === 'percept-stench') {
                badge.title = isActive ? 'Stench detected. The living Wumpus may be in an adjacent cell.' : 'No stench detected in this chamber.';
            } else if (elemId === 'percept-glitter') {
                badge.title = isActive ? 'Glitter detected. There is gold in this chamber.' : 'No glitter detected in this chamber.';
            } else if (elemId === 'percept-scream') {
                badge.title = isActive ? 'Scream echoes. A Wumpus has been killed!' : 'Silence in the dark depths.';
            }
        }
    }

    // ==================== MINIMAP RADAR ====================

    updateMinimap() {
        const radarCanvas = document.getElementById('minimap-radar');
        if (!radarCanvas || !window.GameEngine.board) return;

        const board = window.GameEngine.board;
        const size = board.size;
        const ctx = radarCanvas.getContext('2d');
        const w = radarCanvas.width;
        const h = radarCanvas.height;
        const cellSize = w / size;

        ctx.clearRect(0, 0, w, h);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const cell = board.getCell(x, y);
                const rx = x * cellSize;
                const ry = y * cellSize;

                if (!cell.explored) {
                    // Unknown fog
                    ctx.fillStyle = '#0a0c14';
                    ctx.fillRect(rx, ry, cellSize, cellSize);
                } else {
                    // Explored stone
                    ctx.fillStyle = cell.visitedBy.length > 0 ? '#1f2434' : '#141824';
                    ctx.fillRect(rx, ry, cellSize, cellSize);

                    // If hazard known
                    if (cell.isPit && cell.visitedBy.length > 0) {
                        ctx.fillStyle = '#ef4444';
                        ctx.fillRect(rx + 2, ry + 2, cellSize - 4, cellSize - 4);
                    }
                    if (cell.isWumpus && cell.visitedBy.length > 0) {
                        ctx.fillStyle = cell.wumpusRef && cell.wumpusRef.alive ? '#dc2626' : '#6b7280';
                        ctx.fillRect(rx + 2, ry + 2, cellSize - 4, cellSize - 4);
                    }
                    if (cell.hasGold && cell.goldRef && !cell.goldRef.collected && cell.visitedBy.length > 0) {
                        ctx.fillStyle = '#ffd166';
                        ctx.beginPath();
                        ctx.arc(rx + cellSize / 2, ry + cellSize / 2, cellSize / 4, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                // Grid borders
                ctx.strokeStyle = '#2b3245';
                ctx.lineWidth = 1;
                ctx.strokeRect(rx, ry, cellSize, cellSize);
            }
        }

        // Draw Player blips
        const p1 = window.GameEngine.players[0];
        const p2 = window.GameEngine.players[1];

        if (p1 && p1.isAlive && !p1.hasEscaped) {
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(p1.x * cellSize + cellSize / 2, p1.y * cellSize + cellSize / 2, cellSize / 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
        }

        if (p2 && p2.isAlive && !p2.hasEscaped) {
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.arc(p2.x * cellSize + cellSize / 2, p2.y * cellSize + cellSize / 2, cellSize / 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
        }
    }

    // ==================== AI REASONING PANEL ====================

    updateAIPanel(aiPlayer, decision) {
        if (!decision) return;

        const posElem = document.getElementById('ai-current-pos');
        const perceptsElem = document.getElementById('ai-percepts-readout');
        const wumpusElem = document.getElementById('ai-possible-wumpus');
        const pitsElem = document.getElementById('ai-possible-pits');
        const riskElem = document.getElementById('ai-risk-meter');
        const riskPctElem = document.getElementById('ai-risk-pct');
        const decisionElem = document.getElementById('ai-decision-text');
        const confElem = document.getElementById('ai-confidence-bar');
        const confPctElem = document.getElementById('ai-conf-pct');
        const logElem = document.getElementById('ai-thought-log');

        if (posElem) posElem.textContent = `(${decision.position.x}, ${decision.position.y})`;
        if (perceptsElem) perceptsElem.textContent = decision.percepts.length > 0 ? decision.percepts.join(', ') : 'NONE';
        if (wumpusElem) wumpusElem.textContent = decision.possibleWumpus.length > 0 ? decision.possibleWumpus.join(' | ') : 'None suspected';
        if (pitsElem) pitsElem.textContent = decision.possiblePit.length > 0 ? decision.possiblePit.join(' | ') : 'None suspected';

        if (riskElem) riskElem.style.width = `${decision.risk}%`;
        if (riskPctElem) riskPctElem.textContent = `${decision.risk}%`;

        if (decisionElem) decisionElem.textContent = decision.decision;
        if (confElem) confElem.style.width = `${decision.confidence}%`;
        if (confPctElem) confPctElem.textContent = `${decision.confidence}%`;

        // Update thought stream
        if (logElem && aiPlayer.aiAgent && aiPlayer.aiAgent.thoughtLog) {
            logElem.innerHTML = aiPlayer.aiAgent.thoughtLog.map(t => `
                <div class="thought-entry">
                    <span class="thought-time">[${t.time}]</span>
                    <span class="thought-msg">${t.text}</span>
                </div>
            `).join('');
        }
    }

    // ==================== COMBAT / EVENT LOG ====================

    addCombatLog(message, type = 'info') {
        const logContent = document.getElementById('combat-log-content');
        if (!logContent) return;

        const entry = document.createElement('div');
        entry.className = `log-line log-${type}`;
        entry.innerHTML = `<span class="log-bullet">▸</span> <span class="log-text">${message}</span>`;

        logContent.appendChild(entry);
        logContent.scrollTop = logContent.scrollHeight;
    }

    // ==================== CONTROLS & INPUTS ====================

    bindGameInputEvents() {
        // Keyboard Controls
        window.addEventListener('keydown', (e) => {
            if (this.currentScreen !== 'screen-game') return;
            const engine = window.GameEngine;
            if (engine.gameState !== 'PLAYING') return;

            // Pause
            if (e.key === 'Escape') {
                this.openPauseModal();
                return;
            }

            const active = engine.getActivePlayer();
            if (active.type === 'ai') return; // AI's turn

            // In VS_FRIEND mode, P1 uses WASD and P2 uses Arrow Keys
            const isP1 = active.id === 'p1';
            const isP2 = active.id === 'p2';

            if (this.isAiming) {
                // Aiming arrow keys
                if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                    this.executeShoot('UP');
                } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                    this.executeShoot('DOWN');
                } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                    this.executeShoot('LEFT');
                } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                    this.executeShoot('RIGHT');
                }
                return;
            }

            // Standard Controls
            if (isP1) {
                if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
                    engine.movePlayer('UP');
                } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
                    engine.movePlayer('DOWN');
                } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
                    engine.movePlayer('LEFT');
                } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
                    engine.movePlayer('RIGHT');
                } else if (e.key === 'e' || e.key === 'E') {
                    engine.grabGold();
                } else if (e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    this.toggleAimingMode();
                } else if (e.key === 'Enter') {
                    engine.escapeCavern();
                }
            } else if (isP2) {
                if (e.key === 'ArrowUp') {
                    engine.movePlayer('UP');
                } else if (e.key === 'ArrowDown') {
                    engine.movePlayer('DOWN');
                } else if (e.key === 'ArrowLeft') {
                    engine.movePlayer('LEFT');
                } else if (e.key === 'ArrowRight') {
                    engine.movePlayer('RIGHT');
                } else if (e.key === 'Enter') {
                    engine.grabGold();
                } else if (e.key === 'Shift' || e.key === '/') {
                    this.toggleAimingMode();
                }
            }
        });

        // Virtual On-Screen Mobile D-Pad Buttons
        document.getElementById('btn-dpad-up')?.addEventListener('click', () => {
            if (this.isAiming) this.executeShoot('UP');
            else window.GameEngine.movePlayer('UP');
        });
        document.getElementById('btn-dpad-down')?.addEventListener('click', () => {
            if (this.isAiming) this.executeShoot('DOWN');
            else window.GameEngine.movePlayer('DOWN');
        });
        document.getElementById('btn-dpad-left')?.addEventListener('click', () => {
            if (this.isAiming) this.executeShoot('LEFT');
            else window.GameEngine.movePlayer('LEFT');
        });
        document.getElementById('btn-dpad-right')?.addEventListener('click', () => {
            if (this.isAiming) this.executeShoot('RIGHT');
            else window.GameEngine.movePlayer('RIGHT');
        });

        // Action Buttons
        document.getElementById('btn-act-shoot')?.addEventListener('click', () => {
            this.toggleAimingMode();
        });
        document.getElementById('btn-act-grab')?.addEventListener('click', () => {
            window.GameEngine.grabGold();
        });
        document.getElementById('btn-act-escape')?.addEventListener('click', () => {
            window.GameEngine.escapeCavern();
        });

        // Aiming modal direction buttons
        document.querySelectorAll('.aim-dir-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const dir = btn.dataset.dir;
                this.executeShoot(dir);
            });
        });

        document.getElementById('btn-aim-cancel')?.addEventListener('click', () => {
            this.cancelAimingMode();
        });
    }

    toggleAimingMode() {
        const player = window.GameEngine.getActivePlayer();
        if (player.arrows <= 0) {
            this.addCombatLog('No arrows remaining in quiver!', 'warning');
            return;
        }

        this.isAiming = true;
        const modal = document.getElementById('modal-aiming');
        if (modal) modal.classList.add('active');
        this.addCombatLog('Aiming bow... Select firing direction!', 'info');
    }

    cancelAimingMode() {
        this.isAiming = false;
        const modal = document.getElementById('modal-aiming');
        if (modal) modal.classList.remove('active');
    }

    executeShoot(direction) {
        this.cancelAimingMode();
        window.GameEngine.shootArrow(direction);
    }

    // ==================== ENDGAME SCREENS ====================

    // ==================== LEVEL SELECT ====================

    renderLevelSelect() {
        const grid = document.getElementById('level-grid');
        if (!grid || !window.WumpusLevels) return;
        const store = window.GameStorage;

        // Make sure the current selection is actually playable
        if (!store.isLevelUnlocked(this.selectedLevel)) {
            this.selectedLevel = store.getHighestUnlockedLevel(window.WumpusLevels.count);
        }

        grid.innerHTML = window.WumpusLevels.all.map(l => {
            const unlocked = store.isLevelUnlocked(l.id);
            const result = store.getLevelResult(l.id);
            const selected = unlocked && l.id === this.selectedLevel;
            const badge = !unlocked
                ? '🔒 Locked'
                : result ? `✔ Cleared · Best ${result.bestScore}` : `${l.size} × ${l.size} Grid`;
            const desc = unlocked
                ? `${l.size} × ${l.size} Grid. ${l.pits} Pits, ${l.wumpusCount} Wumpus${l.wumpusCount > 1 ? 'es' : ''}, ${l.goldCount} Gold, ${l.arrows} Arrows. ${l.blurb}`
                : `Clear Level ${l.id - 1} to unlock this cavern.`;

            let activeRewardHtml = '';
            if (unlocked) {
                const activeRewards = store.getActiveRewardsForLevel(l.id);
                if (activeRewards && activeRewards.length > 0) {
                    const r = activeRewards[0];
                    activeRewardHtml = `
                        <div class="active-reward-badge" title="Reward active in this cavern">
                            <span class="reward-tag">ACTIVE REWARD</span>
                            <strong>${r.perkTitle}</strong>
                            <span>${r.perkDescription}</span>
                        </div>`;
                }
            }

            return `
                <div class="selection-card level-card${selected ? ' selected' : ''}${unlocked ? '' : ' locked'}${result ? ' completed' : ''}"
                     data-level="${l.id}" aria-disabled="${unlocked ? 'false' : 'true'}">
                    <span class="level-number">LEVEL ${l.id}</span>
                    <div class="card-icon">${unlocked ? l.icon : '🔒'}</div>
                    <h3 class="card-title">${unlocked ? l.name : '???'}</h3>
                    <p class="card-desc">${desc}</p>
                    ${activeRewardHtml}
                    <span class="card-badge">${badge}</span>
                </div>`;
        }).join('');

        grid.querySelectorAll('.level-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = parseInt(card.dataset.level, 10);
                if (!store.isLevelUnlocked(id)) {
                    card.classList.remove('shake-locked');
                    void card.offsetWidth;
                    card.classList.add('shake-locked');
                    if (window.GameAudio) window.GameAudio.playArrowHitWall();
                    return;
                }
                this.selectedLevel = id;
                grid.querySelectorAll('.level-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                if (window.GameAudio) window.GameAudio.playClick();
            });
        });

        const done = window.WumpusLevels.all.filter(l => store.isLevelCompleted(l.id)).length;
        const txt = document.getElementById('level-progress-text');
        if (txt) txt.textContent = `Campaign progress: ${done} / ${window.WumpusLevels.count} levels cleared`;
    }

    showVictoryScreen(data) {
        const { winner, players, time, explorePct, mode } = data;

        document.getElementById('victory-winner-title').textContent = `${winner.name} Triumphs!`;
        document.getElementById('victory-score').textContent = winner.score;
        document.getElementById('victory-time').textContent = time;
        document.getElementById('victory-moves').textContent = winner.moves;
        document.getElementById('victory-arrows').textContent = `${winner.arrowsUsed} used (${winner.arrows} left)`;
        document.getElementById('victory-gold').textContent = winner.hasGold ? 'Secured 💰' : 'None';
        document.getElementById('victory-explore').textContent = `${explorePct}%`;

        // Victory Level Reward Panel (Strictly 0 or 1 reward per completed level)
        const rewardCard = document.getElementById('victory-reward-card');
        const levelNum = data.level;
        let reward = data.levelReward;
        if (!reward && levelNum && window.GameStorage) {
            reward = window.GameStorage.getLevelReward(levelNum);
        }

        if (rewardCard) {
            if (reward && levelNum) {
                rewardCard.style.display = 'block';
                const levelNumSpan = document.getElementById('victory-reward-level-num');
                const iconBox = document.getElementById('victory-reward-icon');
                const titleElem = document.getElementById('victory-reward-title');
                const descElem = document.getElementById('victory-reward-desc');
                const claimBtn = document.getElementById('btn-claim-reward');

                if (levelNumSpan) levelNumSpan.textContent = String(levelNum);
                if (iconBox) iconBox.textContent = reward.icon || '🏹';
                if (titleElem) titleElem.textContent = reward.perkTitle || reward.title;
                if (descElem) descElem.textContent = reward.perkDescription || reward.rewardText;

                const setClaimButtonState = (isClaimed) => {
                    if (!claimBtn) return;
                    if (isClaimed) {
                        claimBtn.disabled = true;
                        claimBtn.classList.add('claimed');
                        claimBtn.innerHTML = '<span>CLAIMED ✔</span>';
                    } else {
                        claimBtn.disabled = false;
                        claimBtn.classList.remove('claimed');
                        claimBtn.innerHTML = '<span>CLAIM REWARD</span>';
                    }
                };

                setClaimButtonState(reward.isClaimed);

                if (claimBtn) {
                    const freshBtn = claimBtn.cloneNode(true);
                    claimBtn.parentNode.replaceChild(freshBtn, claimBtn);
                    freshBtn.addEventListener('click', () => {
                        const claimed = window.GameStorage.claimLevelReward(levelNum);
                        if (claimed) {
                            freshBtn.disabled = true;
                            freshBtn.classList.add('claimed');
                            freshBtn.innerHTML = '<span>CLAIMED ✔</span>';
                            if (window.GameAudio) {
                                window.GameAudio.playRewardClaim();
                            }
                            this.renderLevelSelect();
                        }
                    });
                }
            } else {
                rewardCard.style.display = 'none';
            }
        }

        // Multiplayer summary table
        const summaryElem = document.getElementById('victory-players-summary');
        if (summaryElem) {
            if (players.length > 1) {
                summaryElem.style.display = 'block';
                summaryElem.innerHTML = `
                    <table class="multiplayer-summary-table">
                        <thead>
                            <tr>
                                <th>Adventurer</th>
                                <th>Score</th>
                                <th>Gold</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${players.map(p => `
                                <tr class="${p.id === winner.id ? 'winner-row' : ''}">
                                    <td>${p.name}</td>
                                    <td>${p.score}</td>
                                    <td>${p.hasGold ? 'YES' : 'NO'}</td>
                                    <td>${p.hasEscaped ? 'Escaped' : p.isAlive ? 'Alive' : 'Perished'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            } else {
                summaryElem.style.display = 'none';
            }
        }

        // Level progression UI
        const nextBtn = document.getElementById('btn-victory-next');
        const levelsBtn = document.getElementById('btn-victory-levels');
        const banner = document.getElementById('victory-unlock-banner');
        const subtitle = document.getElementById('victory-subtitle');
        const lr = data.levelResult;
        this.nextLevelAfterVictory = lr ? lr.nextLevel : null;

        if (nextBtn) nextBtn.style.display = (lr && lr.nextLevel) ? '' : 'none';
        if (levelsBtn) levelsBtn.style.display = data.level ? '' : 'none';
        if (banner) {
            if (lr) {
                banner.style.display = 'block';
                if (lr.campaignComplete) {
                    banner.textContent = '👑 You have cleared every cavern. The Wumpus World is yours!';
                } else if (lr.newlyUnlocked) {
                    const nxt = window.WumpusLevels.get(lr.nextLevel);
                    banner.textContent = `🔓 Level ${nxt.id} unlocked: ${nxt.name}`;
                } else {
                    banner.textContent = `Level ${lr.level} cleared again${lr.newBest ? ' · New best score!' : ''}`;
                }
            } else if (data.level) {
                banner.style.display = 'block';
                banner.textContent = 'Level not cleared: a human adventurer must escape alive with the gold to unlock the next level.';
            } else {
                banner.style.display = 'none';
            }
        }
        if (subtitle && data.level) subtitle.textContent = `Level ${data.level} complete.`;

        this.showScreen('screen-victory');
    }

    showGameOverScreen(data) {
        const { player, reason, score, time } = data;

        document.getElementById('gameover-reason').textContent = reason;
        document.getElementById('gameover-score').textContent = score;
        document.getElementById('gameover-time').textContent = time;
        document.getElementById('gameover-moves').textContent = player.moves;

        this.showScreen('screen-gameover');
    }

    // ==================== LEADERBOARD & ACHIEVEMENTS UI ====================

    renderLeaderboard() {
        const tbody = document.getElementById('leaderboard-rows');
        if (!tbody || !window.GameStorage) return;

        const board = window.GameStorage.leaderboard || [];
        tbody.innerHTML = board.map(item => `
            <tr>
                <td class="col-rank">#${item.rank}</td>
                <td class="col-player"><strong>${item.name}</strong></td>
                <td class="col-mode">${item.mode}</td>
                <td class="col-diff">${item.difficulty}</td>
                <td class="col-score highlight-gold">${item.score}</td>
                <td class="col-time">${item.time}</td>
                <td class="col-date">${item.date}</td>
            </tr>
        `).join('');
    }

    renderAchievements() {
        const container = document.getElementById('achievements-grid');
        if (!container || !window.GameStorage) return;

        const list = window.GameStorage.achievements || [];
        const unlockedCount = list.filter(a => a.unlocked).length;

        const progressElem = document.getElementById('achievements-progress-text');
        if (progressElem) {
            progressElem.textContent = `${unlockedCount} / ${list.length} Unlocked`;
        }

        container.innerHTML = list.map(item => `
            <div class="achievement-card ${item.unlocked ? 'unlocked' : 'locked'}">
                <div class="ach-icon">${item.icon}</div>
                <div class="ach-details">
                    <h4 class="ach-title">${item.title}</h4>
                    <p class="ach-desc">${item.desc}</p>
                    <div class="ach-status">${item.unlocked ? '✓ Unlocked' : '🔒 Locked'}</div>
                </div>
            </div>
        `).join('');
    }

    // ==================== SETTINGS UI ====================

    loadSettingsToUI() {
        if (!window.GameStorage) return;
        const s = window.GameStorage.settings;

        const masterSlider = document.getElementById('setting-master-vol');
        const musicSlider = document.getElementById('setting-music-vol');
        const sfxSlider = document.getElementById('setting-sfx-vol');
        const shakeCheck = document.getElementById('setting-screenshake');
        const particleSelect = document.getElementById('setting-particles');
        const aiDelaySlider = document.getElementById('setting-ai-delay');

        if (masterSlider) masterSlider.value = Math.round(s.masterVolume * 100);
        if (musicSlider) musicSlider.value = Math.round(s.musicVolume * 100);
        if (sfxSlider) sfxSlider.value = Math.round(s.sfxVolume * 100);
        if (shakeCheck) shakeCheck.checked = !!s.screenShake;
        if (particleSelect) particleSelect.value = s.particleDensity || 'ultra';
        if (aiDelaySlider) aiDelaySlider.value = s.aiDelay || 600;

        // Bind sliders
        masterSlider?.oninput && (masterSlider.oninput = (e) => {
            window.GameAudio?.setMasterVolume(e.target.value / 100);
        });
        musicSlider?.oninput && (musicSlider.oninput = (e) => {
            window.GameAudio?.setMusicVolume(e.target.value / 100);
        });
        sfxSlider?.oninput && (sfxSlider.oninput = (e) => {
            window.GameAudio?.setSfxVolume(e.target.value / 100);
        });
        shakeCheck?.onchange && (shakeCheck.onchange = (e) => {
            window.GameStorage?.saveSettings({ screenShake: e.target.checked });
        });
        particleSelect?.onchange && (particleSelect.onchange = (e) => {
            const val = e.target.value;
            window.GameStorage?.saveSettings({ particleDensity: val });
            window.GameParticles?.setDensity(val);
        });
        aiDelaySlider?.oninput && (aiDelaySlider.oninput = (e) => {
            const delay = parseInt(e.target.value, 10);
            window.GameStorage?.saveSettings({ aiDelay: delay });
            document.getElementById('ai-delay-val').textContent = `${delay}ms`;
        });

        document.getElementById('btn-reset-data')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all game data, achievements, and leaderboard high scores?')) {
                window.GameStorage?.resetAllProgress();
                this.loadSettingsToUI();
                this.renderLeaderboard();
                this.renderAchievements();
                alert('All data has been reset to defaults.');
            }
        });
    }

    // ==================== INTERACTIVE TUTORIAL SANDBOX ====================

    setupInteractiveTutorial() {
        const demoBoard = document.getElementById('tutorial-demo-grid');
        if (!demoBoard) return;

        // Render a 3x3 interactive educational scenario
        // (0,0): Start/Safe, (1,0): Breeze, (2,0): Pit!
        // (0,1): Safe, (1,1): Safe, (2,1): Stench
        // (0,2): Glitter/Gold, (1,2): Safe, (2,2): Wumpus!
        const tiles = [
            { x: 0, y: 0, label: 'Start (0,0)<br>No Clues', type: 'safe' },
            { x: 1, y: 0, label: 'Breeze 💨<br>Hazard Near!', type: 'breeze' },
            { x: 2, y: 0, label: '🕳️ PIT<br>Lethal Abyss', type: 'pit' },

            { x: 0, y: 1, label: 'Safe Chamber<br>No Clues', type: 'safe' },
            { x: 1, y: 1, label: 'Intersection<br>Safe', type: 'safe' },
            { x: 2, y: 1, label: 'Stench ☣️<br>Beast Near!', type: 'stench' },

            { x: 0, y: 2, label: '💰 GOLD!<br>Glitter ✨', type: 'gold' },
            { x: 1, y: 2, label: 'Stench ☣️<br>Beast Near!', type: 'stench' },
            { x: 2, y: 2, label: '👹 WUMPUS<br>Shoot Arrow! 🏹', type: 'wumpus' }
        ];

        demoBoard.innerHTML = tiles.map(t => `
            <div class="tutorial-cell tut-${t.type}" data-type="${t.type}">
                <div class="tut-content">${t.label}</div>
            </div>
        `).join('');

        demoBoard.querySelectorAll('.tutorial-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                const type = cell.dataset.type;
                if (window.GameAudio) {
                    if (type === 'breeze') window.GameAudio.playBreeze();
                    else if (type === 'stench') window.GameAudio.playStench();
                    else if (type === 'gold') window.GameAudio.playGlitter();
                    else if (type === 'pit') window.GameAudio.playPitFall();
                    else if (type === 'wumpus') window.GameAudio.playWumpusRoar();
                    else window.GameAudio.playFootstep();
                }
            });
        });
    }
}

// Global instance
window.GameUI = new UIManager();

// Expose global goToMainMenu for universal main menu navigation
window.goToMainMenu = () => window.GameUI.goToMainMenu();
