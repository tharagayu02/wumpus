/**
 * Wumpus World - Core Game Engine & State Machine
 * Manages player states, turn sequences, scoring, collision mechanics,
 * arrow projectiles, combos, and victory/defeat conditions.
 */

class WumpusGame {
    constructor() {
        this.board = null;
        this.mode = 'SINGLE'; // 'SINGLE' | 'VS_AI' | 'VS_FRIEND' | 'AI_VS_AI'
        this.difficulty = 'easy';
        this.aiDifficulty = 'normal';
        this.gridSize = 4;
        this.level = null; // Current campaign level id (null = free play / legacy difficulty)

        this.players = [];
        this.activePlayerIndex = 0;
        this.gameState = 'IDLE'; // 'IDLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'VICTORY'

        this.timerSeconds = 0;
        this.timerInterval = null;
        this.isAiTurnProcessing = false;
        this.aiSimulationInterval = null;
        this.simulationSpeed = 1000; // ms per step

        this.onStateChange = null;
        this.onEventLog = null;
        this.onPerceptUpdate = null;
        this.onCellUpdate = null;
        this.onTurnChange = null;
        this.onAIMove = null;
        this.onGameOver = null;
        this.onVictory = null;
    }

    startNewGame(options = {}) {
        this.stopTimers();

        this.mode = options.mode || 'SINGLE';
        this.difficulty = options.difficulty || 'easy';
        this.aiDifficulty = options.aiDifficulty || 'normal';
        this.level = null;
        let levelConfig = null;

        if (options.level && window.WumpusLevels && window.WumpusLevels.get(options.level)) {
            let requested = options.level;
            // Guard: a locked level can never be started; fall back to highest unlocked
            if (window.GameStorage && !window.GameStorage.isLevelUnlocked(requested)) {
                requested = window.GameStorage.getHighestUnlockedLevel(window.WumpusLevels.count);
            }
            const lvl = window.WumpusLevels.get(requested);
            this.level = lvl.id;
            this.difficulty = lvl.tier;
            levelConfig = window.WumpusLevels.getConfig(lvl.id);
            this.gridSize = lvl.size;
        } else {
            this.gridSize = options.gridSize || (this.difficulty === 'easy' ? 4 : this.difficulty === 'medium' ? 6 : this.difficulty === 'hard' ? 8 : 10);
        }

        // Remember which achievements were already unlocked prior to this session
        this.unlockedAchievementsAtStart = new Set(
            (window.GameStorage?.achievements || []).filter(a => a.unlocked).map(a => a.id)
        );

        // Instantiate Board
        this.board = new WumpusBoard(this.gridSize, this.difficulty, levelConfig);

        // Configure Players
        this.setupPlayers();

        this.gameState = 'PLAYING';
        this.timerSeconds = 0;
        this.startTimer();

        // Explore initial cells
        this.players.forEach(p => {
            this.board.exploreCell(p.x, p.y, p.id);
            p.cellsExplored.add(`${p.x},${p.y}`);
        });

        // Trigger initial percept sound & updates
        const p1 = this.players[0];
        const percepts = this.board.getPerceptsAt(p1.x, p1.y);
        this.playPerceptAudio(percepts);

        if (window.GameAudio) {
            window.GameAudio.playEnterCave();
        }

        if (this.onEventLog) {
            this.onEventLog(`Entered the mysterious subterranean cavern at chamber (0,0). Stay vigilant!`, 'info');
            if (percepts.breeze && percepts.stench) {
                this.onEventLog(`A cold breeze moves through the chamber. A foul stench hangs in the darkness.`, 'warning');
            } else {
                if (percepts.breeze) this.onEventLog(`A cold breeze moves through the chamber. A pit may be nearby.`, 'breeze');
                if (percepts.stench) this.onEventLog(`A foul stench fills the chamber. The Wumpus may be nearby.`, 'stench');
            }
            if (percepts.glitter) this.onEventLog(`Something glitters in the darkness. There is gold in this chamber.`, 'glitter');

            // Log active perks if any
            if (this.level && window.GameStorage) {
                const activeRewards = window.GameStorage.getActiveRewardsForLevel(this.level);
                if (activeRewards.length > 0) {
                    activeRewards.forEach(r => {
                        this.onEventLog(`ACTIVE REWARD: ${r.perkTitle} (${r.perkDescription}) is active!`, 'glitter');
                    });
                }
            }
        }

        if (this.onStateChange) this.onStateChange(this.gameState);
        if (this.onTurnChange) this.onTurnChange(this.getActivePlayer());

        // If AI vs AI, start simulation loop
        if (this.mode === 'AI_VS_AI') {
            this.startAiSimulation();
        }
    }

    setupPlayers() {
        this.players = [];
        this.activePlayerIndex = 0;
        const config = this.board.getConfig();

        // Query active perks from claimed rewards
        let perkBonusArrows = 0;
        let perkBonusScore = 0;
        if (this.level && window.GameStorage) {
            const perks = window.GameStorage.getPerkModifiersForLevel(this.level);
            perkBonusArrows = perks.bonusArrows || 0;
            perkBonusScore = perks.bonusScore || 0;
        }

        if (this.mode === 'SINGLE') {
            const p1 = this.createPlayer('p1', 'Knight Explorer', 'human', config.arrows + perkBonusArrows, { x: 0, y: 0 });
            p1.score += perkBonusScore;
            this.players.push(p1);
        } else if (this.mode === 'VS_AI') {
            const p1 = this.createPlayer('p1', 'Adventurer (You)', 'human', config.arrows + perkBonusArrows, { x: 0, y: 0 });
            p1.score += perkBonusScore;
            this.players.push(p1);
            const aiAgent = new WumpusAIAgent('ai', 'Shadow Automaton', this.aiDifficulty, this.gridSize);
            const aiPlayer = this.createPlayer('ai', 'Shadow Automaton', 'ai', config.arrows, { x: 0, y: 0 });
            aiPlayer.aiAgent = aiAgent;
            this.players.push(aiPlayer);
        } else if (this.mode === 'VS_FRIEND') {
            const p1 = this.createPlayer('p1', 'Player 1 (Knight)', 'human', config.arrows + perkBonusArrows, { x: 0, y: 0 });
            p1.score += perkBonusScore;
            this.players.push(p1);
            const p2 = this.createPlayer('p2', 'Player 2 (Ranger)', 'human', config.arrows, { x: 0, y: 0 });
            this.players.push(p2);
        } else if (this.mode === 'AI_VS_AI') {
            const ai1 = new WumpusAIAgent('ai1', 'Master AI (Knight)', 'master', this.gridSize);
            const p1 = this.createPlayer('ai1', 'Master AI (Knight)', 'ai', config.arrows, { x: 0, y: 0 });
            p1.aiAgent = ai1;

            const ai2 = new WumpusAIAgent('ai2', 'Adaptive AI (Rogue)', this.aiDifficulty, this.gridSize);
            const p2 = this.createPlayer('ai2', 'Adaptive AI (Rogue)', 'ai', config.arrows, { x: 0, y: 0 });
            p2.aiAgent = ai2;

            this.players.push(p1, p2);
        }
    }

    createPlayer(id, name, type, arrows, pos) {
        return {
            id,
            name,
            type, // 'human' | 'ai'
            x: pos.x,
            y: pos.y,
            health: 3,
            arrows: arrows,
            arrowsUsed: 0,
            score: 0,
            hasGold: false,
            isAlive: true,
            hasEscaped: false,
            moves: 0,
            wumpusKills: 0,
            cellsExplored: new Set(),
            aiAgent: null
        };
    }

    getActivePlayer() {
        return this.players[this.activePlayerIndex] || this.players[0];
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (this.gameState === 'PLAYING') {
                this.timerSeconds++;
            }
        }, 1000);
    }

    stopTimers() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        if (this.aiSimulationInterval) clearInterval(this.aiSimulationInterval);
        this.timerInterval = null;
        this.aiSimulationInterval = null;
        this.isAiTurnProcessing = false;
    }

    pauseGame() {
        if (this.gameState === 'PLAYING') {
            this.gameState = 'PAUSED';
            if (this.onStateChange) this.onStateChange(this.gameState);
        }
    }

    resumeGame() {
        if (this.gameState === 'PAUSED') {
            this.gameState = 'PLAYING';
            if (this.onStateChange) this.onStateChange(this.gameState);
        }
    }

    // ==================== PLAYER ACTIONS ====================

    // Move player in direction ('UP', 'DOWN', 'LEFT', 'RIGHT')
    movePlayer(direction) {
        if (this.gameState !== 'PLAYING') return false;
        if (this.isAiTurnProcessing && this.getActivePlayer().type === 'human') return false;

        const player = this.getActivePlayer();
        if (!player.isAlive || player.hasEscaped) return false;

        const dx = direction === 'RIGHT' ? 1 : direction === 'LEFT' ? -1 : 0;
        const dy = direction === 'DOWN' ? 1 : direction === 'UP' ? -1 : 0;

        const targetX = player.x + dx;
        const targetY = player.y + dy;

        // Wall collision check
        if (!this.board.isValid(targetX, targetY)) {
            player.score -= 10;
            if (window.GameAudio) window.GameAudio.playArrowHitWall();
            if (this.onEventLog) this.onEventLog(`${player.name} bumped into a solid cave wall! (-10)`, 'warning');
            return false;
        }

        // Move to target cell
        player.x = targetX;
        player.y = targetY;
        if (player.aiAgent) {
            player.aiAgent.x = targetX;
            player.aiAgent.y = targetY;
        }
        player.moves++;
        player.score -= 1; // Standard small move cost

        // Clear scream from previous turn once moving to a new cell
        if (this.board.wumpusScream) {
            this.board.clearWumpusScream();
        }

        // Exactly one subtle footstep sound when moving into a new grid cell
        if (window.GameAudio) {
            window.GameAudio.playFootstep();
        }

        // Unlock First Steps on initial player move
        if (player.id === 'p1' && window.GameStorage) {
            window.GameStorage.unlockAchievement('first_steps');
        }

        // Reveal cell and surrounding fog
        const isNewCell = !player.cellsExplored.has(`${targetX},${targetY}`);
        this.board.exploreCell(targetX, targetY, player.id);
        player.cellsExplored.add(`${targetX},${targetY}`);

        if (isNewCell) {
            player.score += 50; // Discover Safe Cell bonus
        }

        const currentCell = this.board.getCell(targetX, targetY);

        // 1. Pit Collision Check (Instant Game Over)
        if (currentCell.isPit) {
            player.health = 0;
            player.isAlive = false;
            player.score -= 1000;

            if (window.GameAudio) window.GameAudio.playPitFall();
            if (window.GameParticles) window.GameParticles.shake(document.body, 15, 600);
            if (this.onEventLog) this.onEventLog(`FATAL: ${player.name} fell into a bottomless dark pit! (-1000)`, 'danger');

            this.checkGameCompletion();
            this.endCurrentTurn();
            return true;
        }

        // 2. Wumpus Collision Check (Instant Game Over)
        if (currentCell.isWumpus && currentCell.wumpusRef && currentCell.wumpusRef.alive) {
            player.health = 0;
            player.isAlive = false;
            player.score -= 1500;

            if (window.GameAudio) window.GameAudio.playWumpusRoar();
            if (window.GameParticles) {
                window.GameParticles.shake(document.body, 20, 800);
                window.GameParticles.spawnHitImpact(window.innerWidth / 2, window.innerHeight / 2, 40, false);
            }
            if (this.onEventLog) this.onEventLog(`TERROR: The Wumpus mauled ${player.name} in the dark! (-1500)`, 'danger');

            this.checkGameCompletion();
            this.endCurrentTurn();
            return true;
        }

        // Process Percepts at destination cell immediately
        const percepts = this.board.getPerceptsAt(targetX, targetY);
        this.playPerceptAudio(percepts);

        if (percepts.breeze && percepts.stench) {
            if (this.onEventLog) {
                this.onEventLog(`A cold breeze moves through the chamber. A foul stench hangs in the darkness.`, 'warning');
            }
        } else {
            if (percepts.breeze && this.onEventLog) {
                this.onEventLog(`A cold breeze moves through the chamber. A pit may be nearby.`, 'breeze');
            }
            if (percepts.stench && this.onEventLog) {
                this.onEventLog(`A foul stench fills the chamber. The Wumpus may be nearby.`, 'stench');
            }
        }
        if (percepts.glitter && this.onEventLog) {
            this.onEventLog(`Something glitters in the darkness. There is gold in this chamber.`, 'glitter');
        }

        if (this.onCellUpdate) this.onCellUpdate(player);
        this.endCurrentTurn();
        return true;
    }

    // Shoot arrow in direction
    shootArrow(direction) {
        if (this.gameState !== 'PLAYING') return false;
        const player = this.getActivePlayer();

        if (player.arrows <= 0) {
            if (this.onEventLog) this.onEventLog(`${player.name} has no arrows left in the quiver!`, 'warning');
            return false;
        }

        player.arrows--;
        player.arrowsUsed++;
        if (player.aiAgent) {
            player.aiAgent.arrows = player.arrows;
        }
        if (window.GameAudio) window.GameAudio.playArrowShoot();

        const result = this.board.shootArrow(player.x, player.y, direction);

        if (result.hit) {
            player.score += 500;
            player.wumpusKills++;
            if (window.GameAudio) window.GameAudio.playWumpusDeath();
            if (window.GameParticles) {
                window.GameParticles.shake(document.body, 12, 500);
                window.GameParticles.spawnHitImpact(window.innerWidth / 2, window.innerHeight / 2, 50, true);
            }
            if (this.onEventLog) this.onEventLog(`TRIUMPH: ${player.name}'s arrow pierced the beast! THE WUMPUS IS SLAIN! (+500)`, 'glitter');

            // Unlock Slayer and Blind Marksman achievements
            if (player.id === 'p1' && window.GameStorage) {
                window.GameStorage.unlockAchievement('wumpus_slayer');
                window.GameStorage.unlockAchievement('blind_hunter');
            }

            // Immediately update HUD and board so Stench disappears right away
            if (this.onCellUpdate) {
                this.onCellUpdate(player);
            }
        } else {
            player.score -= 100;
            if (window.GameAudio) window.GameAudio.playArrowHitWall();
            if (this.onEventLog) this.onEventLog(`The arrow flew into the darkness and clattered against the stone wall. (-100)`, 'info');
        }

        this.endCurrentTurn();
        return true;
    }

    // Grab Gold in current chamber
    grabGold() {
        if (this.gameState !== 'PLAYING') return false;
        const player = this.getActivePlayer();

        if (player.hasGold) {
            if (this.onEventLog) this.onEventLog(`${player.name} is already carrying the golden treasure!`, 'info');
            return false;
        }

        const collected = this.board.collectGold(player.x, player.y);
        if (collected) {
            player.hasGold = true;
            if (player.aiAgent) {
                player.aiAgent.hasGold = true;
            }
            player.score += 1000;

            if (window.GameAudio) window.GameAudio.playGoldCollect();
            if (window.GameParticles) {
                window.GameParticles.spawnGoldSparkles(window.innerWidth / 2, window.innerHeight / 2, 45);
            }
            if (this.onEventLog) this.onEventLog(`TREASURE HOARD: ${player.name} seized the glowing gold! Head to (0,0) to escape! (+1000)`, 'glitter');

            // Unlock Treasure Hunter achievement
            if (player.id === 'p1' && window.GameStorage) {
                window.GameStorage.unlockAchievement('treasure_hunter');
            }

            this.endCurrentTurn();
            return true;
        } else {
            if (this.onEventLog) this.onEventLog(`There is no gold in this chamber to collect.`, 'warning');
            return false;
        }
    }

    // Escape cavern at (0,0)
    escapeCavern() {
        if (this.gameState !== 'PLAYING') return false;
        const player = this.getActivePlayer();

        if (player.x === 0 && player.y === 0) {
            player.hasEscaped = true;
            player.score += 500; // Return to start bonus

            if (player.hasGold) {
                player.score += 1000; // Successful Escape bonus
                if (this.onEventLog) this.onEventLog(`VICTORY: ${player.name} climbed to safety with the legendary gold! (+1500)`, 'glitter');
            } else {
                if (this.onEventLog) this.onEventLog(`${player.name} escaped the cavern empty-handed.`, 'info');
            }

            this.checkGameCompletion();
            this.endCurrentTurn();
            return true;
        } else {
            if (this.onEventLog) this.onEventLog(`You can only escape at the cave entrance (0,0)!`, 'warning');
            return false;
        }
    }

    // Play percept audio cues (subtle and harmonious)
    playPerceptAudio(percepts) {
        if (!window.GameAudio) return;
        if (percepts.breeze && percepts.stench) {
            window.GameAudio.playBreezeAndStench();
        } else if (percepts.breeze) {
            window.GameAudio.playBreeze();
        } else if (percepts.stench) {
            window.GameAudio.playStench();
        } else if (percepts.glitter) {
            window.GameAudio.playGlitter();
        } else {
            window.GameAudio.playChamberPulse();
        }
    }

    // ==================== TURN PROGRESSION ====================

    endCurrentTurn() {
        this.checkGameCompletion();
        if (this.gameState !== 'PLAYING') return;

        // Switch to next alive player
        const alivePlayers = this.players.filter(p => p.isAlive && !p.hasEscaped);
        if (alivePlayers.length === 0) {
            this.checkGameCompletion();
            return;
        }

        this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
        const nextPlayer = this.getActivePlayer();

        // If next player is already dead or escaped, skip them
        if (!nextPlayer.isAlive || nextPlayer.hasEscaped) {
            this.endCurrentTurn();
            return;
        }

        if (this.onTurnChange) this.onTurnChange(nextPlayer);

        // If next player is AI, trigger AI decision cycle
        if (nextPlayer.type === 'ai') {
            this.triggerAiTurn(nextPlayer);
        }
    }

    triggerAiTurn(aiPlayer) {
        if (this.gameState !== 'PLAYING') return;
        this.isAiTurnProcessing = true;

        const delay = (window.GameStorage && window.GameStorage.settings && window.GameStorage.settings.aiDelay) || 600;

        setTimeout(() => {
            if (this.gameState !== 'PLAYING' || !aiPlayer.isAlive || aiPlayer.hasEscaped) {
                this.isAiTurnProcessing = false;
                return;
            }

            // AI makes decision
            const decision = aiPlayer.aiAgent.decideNextAction(this.board);

            if (this.onAIMove) {
                this.onAIMove(aiPlayer, decision);
            }

            // Execute AI action
            switch (decision.action) {
                case 'MOVE':
                    this.movePlayer(decision.target.dir);
                    break;
                case 'SHOOT':
                    this.shootArrow(decision.direction);
                    break;
                case 'GRAB':
                    this.grabGold();
                    break;
                case 'CLIMB':
                    this.escapeCavern();
                    break;
                default:
                    this.endCurrentTurn();
            }

            this.isAiTurnProcessing = false;
        }, delay);
    }

    // ==================== SIMULATION (AI VS AI) ====================

    startAiSimulation() {
        if (this.aiSimulationInterval) clearInterval(this.aiSimulationInterval);
        this.aiSimulationInterval = setInterval(() => {
            if (this.gameState === 'PLAYING') {
                const active = this.getActivePlayer();
                if (active && active.type === 'ai' && !this.isAiTurnProcessing) {
                    this.triggerAiTurn(active);
                }
            }
        }, this.simulationSpeed);
    }

    stepSimulationOnce() {
        if (this.gameState !== 'PLAYING') return;
        const active = this.getActivePlayer();
        if (active && active.type === 'ai' && !this.isAiTurnProcessing) {
            this.triggerAiTurn(active);
        }
    }

    setSimulationSpeed(speedMs) {
        this.simulationSpeed = speedMs;
        if (this.mode === 'AI_VS_AI' && this.gameState === 'PLAYING') {
            this.startAiSimulation();
        }
    }

    // ==================== WIN / DEFEAT CONDITIONS ====================

    checkGameCompletion() {
        // Already decided: never re-run victory/defeat (prevents duplicate leaderboard
        // entries and double level-completion when several actions call this in one turn)
        if (this.gameState === 'VICTORY' || this.gameState === 'GAME_OVER') return;
        const p1 = this.players[0];
        const allFinished = this.players.every(p => !p.isAlive || p.hasEscaped);

        // Single Player completion
        if (this.mode === 'SINGLE') {
            if (p1.hasEscaped && p1.hasGold) {
                this.handleVictory(p1);
            } else if (!p1.isAlive) {
                this.handleDefeat(p1, 'You perished in the dark depths of the cavern.');
            } else if (p1.hasEscaped && !p1.hasGold) {
                this.handleDefeat(p1, 'You fled the cavern without the golden treasure!');
            }
            return;
        }

        // Multiplayer / VS AI completion
        if (this.mode === 'VS_AI' || this.mode === 'VS_FRIEND' || this.mode === 'AI_VS_AI') {
            // Did someone escape with gold?
            const winnerWithGold = this.players.find(p => p.hasEscaped && p.hasGold);
            if (winnerWithGold) {
                this.handleVictory(winnerWithGold);
                return;
            }

            // Did all players finish (die or escape)?
            if (allFinished) {
                // Determine winner by score
                const sorted = [...this.players].sort((a, b) => b.score - a.score);
                const winner = sorted[0];

                if (winner.isAlive || winner.hasEscaped) {
                    this.handleVictory(winner);
                } else {
                    this.handleDefeat(winner, 'All adventurers fell to the terrors of the cave.');
                }
            }
        }
    }

    handleVictory(winningPlayer) {
        this.gameState = 'VICTORY';
        this.stopTimers();

        if (window.GameAudio) window.GameAudio.playVictory();

        // Calculate exploration percentage
        const totalCells = this.gridSize * this.gridSize;
        const exploredCells = winningPlayer.cellsExplored.size;
        const explorePct = Math.round((exploredCells / totalCells) * 100);

        // Check Achievements
        if (window.GameStorage) {
            if (winningPlayer.id === 'p1') {
                window.GameStorage.unlockAchievement('first_victory');
                if (winningPlayer.hasGold) window.GameStorage.unlockAchievement('treasure_hunter');
                if (explorePct >= 75) window.GameStorage.unlockAchievement('cartographer');
                if (this.timerSeconds < 60) window.GameStorage.unlockAchievement('speed_runner');
                if (this.difficulty === 'extreme') window.GameStorage.unlockAchievement('extreme_survivor');
                if (this.mode === 'VS_AI' && this.aiDifficulty === 'master') window.GameStorage.unlockAchievement('ai_nemesis');
                if (winningPlayer.health === 1) window.GameStorage.unlockAchievement('near_death');
                if (winningPlayer.health === 3 && winningPlayer.arrowsUsed === 0 && winningPlayer.hasGold) {
                    window.GameStorage.unlockAchievement('master_strategist');
                }
            }

            // Save to Leaderboard
            window.GameStorage.addLeaderboardEntry({
                name: winningPlayer.name,
                mode: this.formatModeName(this.mode),
                difficulty: this.level
                    ? `Level ${this.level} (${this.gridSize}x${this.gridSize})`
                    : `${this.difficulty.toUpperCase()} (${this.gridSize}x${this.gridSize})`,
                score: winningPlayer.score,
                time: this.formatTime(this.timerSeconds),
                date: new Date().toISOString().split('T')[0]
            });
        }

        // Level progression: a level counts as DONE only when a human adventurer
        // escapes alive WITH the gold. Only then is the next level unlocked.
        let levelResult = null;
        let levelReward = null;
        const levelCompleted = !!(this.level && winningPlayer.type === 'human' &&
            winningPlayer.isAlive && winningPlayer.hasEscaped && winningPlayer.hasGold);
        if (levelCompleted && window.GameStorage) {
            const r = window.GameStorage.completeLevel(this.level, winningPlayer.score, this.formatTime(this.timerSeconds));
            const nextId = this.level + 1;
            const hasNext = !!(window.WumpusLevels && window.WumpusLevels.get(nextId));
            levelResult = {
                level: this.level,
                firstClear: r.firstClear,
                newBest: r.newBest,
                nextLevel: hasNext ? nextId : null,
                newlyUnlocked: hasNext && r.firstClear,
                campaignComplete: !hasNext
            };

            // Identify achievements newly unlocked during this level session
            const newlyUnlockedIds = [];
            window.GameStorage.achievements.forEach(a => {
                if (a.unlocked && (!this.unlockedAchievementsAtStart || !this.unlockedAchievementsAtStart.has(a.id))) {
                    newlyUnlockedIds.push(a.id);
                }
            });

            // Select only ONE achievement as the level reward using priority order
            levelReward = window.GameStorage.selectSingleRewardForLevel(this.level, newlyUnlockedIds);
        }

        if (this.onVictory) {
            this.onVictory({
                level: this.level,
                levelCompleted: levelCompleted,
                levelResult: levelResult,
                levelReward: levelReward,
                winner: winningPlayer,
                players: this.players,
                time: this.formatTime(this.timerSeconds),
                seconds: this.timerSeconds,
                explorePct: explorePct,
                mode: this.mode
            });
        }
    }

    resetSession() {
        this.stopTimers();
        this.gameState = 'IDLE';
        this.isAiTurnProcessing = false;
        this.timerSeconds = 0;
        this.activePlayerIndex = 0;
        this.players = [];
        this.board = null;
        if (this.onStateChange) this.onStateChange(this.gameState);
    }

    handleDefeat(losingPlayer, reason) {
        this.gameState = 'GAME_OVER';
        this.stopTimers();

        if (window.GameAudio) window.GameAudio.playDefeat();

        if (this.onGameOver) {
            this.onGameOver({
                level: this.level,
                player: losingPlayer,
                players: this.players,
                reason: reason,
                score: losingPlayer.score,
                time: this.formatTime(this.timerSeconds),
                mode: this.mode
            });
        }
    }

    formatTime(sec) {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    formatModeName(mode) {
        switch (mode) {
            case 'SINGLE': return 'Single Player';
            case 'VS_AI': return 'Player vs AI';
            case 'VS_FRIEND': return 'Player vs Friend';
            case 'AI_VS_AI': return 'AI vs AI Simulation';
            default: return mode;
        }
    }
}

// Global instance
window.GameEngine = new WumpusGame();
