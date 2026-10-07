/**
 * Wumpus World - AI Agent & Propositional Knowledge Base
 * Implements logical deduction, Bayesian risk estimation, A* path planning,
 * and transparent reasoning stream for Easy, Normal, Hard, and Master difficulties.
 */

class WumpusAIAgent {
    constructor(id = 'ai', name = 'Autonomous Agent', difficulty = 'normal', boardSize = 4) {
        this.id = id;
        this.name = name;
        this.difficulty = difficulty; // 'easy' | 'normal' | 'hard' | 'master'
        this.boardSize = boardSize;

        this.x = 0;
        this.y = 0;
        this.arrows = 3;
        this.hasGold = false;
        this.isAlive = true;
        this.score = 0;
        this.movesCount = 0;

        // Knowledge Base
        this.visited = new Set(['0,0']);
        this.knownSafe = new Set(['0,0', '1,0', '0,1']);
        this.perceptMemory = new Map(); // 'x,y' -> { stench, breeze, glitter }
        this.pitProb = new Map();       // 'x,y' -> 0.0 to 1.0
        this.wumpusProb = new Map();    // 'x,y' -> 0.0 to 1.0
        this.definitePits = new Set();
        this.definiteWumpus = new Set();
        this.wumpusSlain = false;

        // Reasoning state for HUD
        this.thoughtLog = [];
        this.lastDecision = {
            position: { x: 0, y: 0 },
            percepts: [],
            possibleWumpus: [],
            possiblePit: [],
            risk: 0,
            decision: 'START',
            confidence: 100,
            rationale: 'Entering cavern at entrance (0,0).'
        };

        this.initProbabilities();
    }

    initProbabilities() {
        for (let y = 0; y < this.boardSize; y++) {
            for (let x = 0; x < this.boardSize; x++) {
                const key = `${x},${y}`;
                if (key === '0,0' || key === '1,0' || key === '0,1') {
                    this.pitProb.set(key, 0.0);
                    this.wumpusProb.set(key, 0.0);
                    this.knownSafe.add(key);
                } else {
                    // Base prior probabilities
                    this.pitProb.set(key, 0.2);
                    this.wumpusProb.set(key, 1.0 / (this.boardSize * this.boardSize - 3));
                }
            }
        }
    }

    reset(boardSize, difficulty) {
        this.boardSize = boardSize || this.boardSize;
        this.difficulty = difficulty || this.difficulty;
        this.x = 0;
        this.y = 0;
        this.arrows = 3;
        this.hasGold = false;
        this.isAlive = true;
        this.score = 0;
        this.movesCount = 0;
        this.visited.clear();
        this.visited.add('0,0');
        this.knownSafe.clear();
        this.perceptMemory.clear();
        this.pitProb.clear();
        this.wumpusProb.clear();
        this.definitePits.clear();
        this.definiteWumpus.clear();
        this.wumpusSlain = false;
        this.thoughtLog = [];
        this.initProbabilities();
    }

    getNeighbors(x, y) {
        const dirs = [
            { x: x, y: y - 1, dir: 'UP' },
            { x: x, y: y + 1, dir: 'DOWN' },
            { x: x - 1, y: y, dir: 'LEFT' },
            { x: x + 1, y: y, dir: 'RIGHT' }
        ];
        return dirs.filter(d => d.x >= 0 && d.x < this.boardSize && d.y >= 0 && d.y < this.boardSize);
    }

    // Update Knowledge Base from current percepts
    observe(percepts) {
        const currentKey = `${this.x},${this.y}`;
        this.visited.add(currentKey);
        this.knownSafe.add(currentKey);
        this.pitProb.set(currentKey, 0.0);
        this.wumpusProb.set(currentKey, 0.0);
        this.perceptMemory.set(currentKey, { ...percepts });

        if (percepts.scream) {
            this.wumpusSlain = true;
            for (let y = 0; y < this.boardSize; y++) {
                for (let x = 0; x < this.boardSize; x++) {
                    this.wumpusProb.set(`${x},${y}`, 0.0);
                }
            }
            this.definiteWumpus.clear();
            this.logThought('Scream heard! Wumpus has been eradicated from the cavern.');
        }

        const neighbors = this.getNeighbors(this.x, this.y);

        // 1. Breeze Deduction
        if (!percepts.breeze) {
            // NO breeze means NO adjacent pits exist!
            neighbors.forEach(n => {
                const k = `${n.x},${n.y}`;
                this.pitProb.set(k, 0.0);
                if (this.wumpusProb.get(k) === 0.0) {
                    this.knownSafe.add(k);
                }
            });
            this.logThought(`No breeze at (${this.x},${this.y}): All ${neighbors.length} adjacent cells cleared of pits.`);
        } else {
            // Breeze detected: At least one adjacent cell contains a pit
            const unknownNeighbors = neighbors.filter(n => !this.visited.has(`${n.x},${n.y}`) && !this.knownSafe.has(`${n.x},${n.y}`));
            if (unknownNeighbors.length === 1) {
                // Exact deduction! Only 1 possible candidate
                const pit = unknownNeighbors[0];
                const pk = `${pit.x},${pit.y}`;
                this.definitePits.add(pk);
                this.pitProb.set(pk, 1.0);
                this.logThought(`DEDUCTION: Only one possible source for breeze at (${this.x},${this.y}). Confirmed Pit at (${pit.x},${pit.y})!`);
            } else {
                unknownNeighbors.forEach(n => {
                    const k = `${n.x},${n.y}`;
                    if (!this.definitePits.has(k)) {
                        const currentP = this.pitProb.get(k) || 0.2;
                        this.pitProb.set(k, Math.min(0.9, currentP + 0.35));
                    }
                });
                this.logThought(`Breeze detected at (${this.x},${this.y}): Caution advised for adjacent unvisited cells.`);
            }
        }

        // 2. Stench Deduction
        if (!this.wumpusSlain) {
            if (!percepts.stench) {
                // NO stench means NO adjacent Wumpus!
                neighbors.forEach(n => {
                    const k = `${n.x},${n.y}`;
                    this.wumpusProb.set(k, 0.0);
                    if (this.pitProb.get(k) === 0.0) {
                        this.knownSafe.add(k);
                    }
                });
                this.logThought(`No stench at (${this.x},${this.y}): All adjacent cells cleared of Wumpus.`);
            } else {
                // Stench detected!
                const unknownNeighbors = neighbors.filter(n => !this.visited.has(`${n.x},${n.y}`) && !this.knownSafe.has(`${n.x},${n.y}`));
                if (unknownNeighbors.length === 1) {
                    const wumpus = unknownNeighbors[0];
                    const wk = `${wumpus.x},${wumpus.y}`;
                    this.definiteWumpus.add(wk);
                    this.wumpusProb.set(wk, 1.0);
                    this.logThought(`DEDUCTION: Isolated stench signature! Confirmed Wumpus lair at (${wumpus.x},${wumpus.y})!`);
                } else {
                    unknownNeighbors.forEach(n => {
                        const k = `${n.x},${n.y}`;
                        if (!this.definiteWumpus.has(k)) {
                            const currentW = this.wumpusProb.get(k) || 0.1;
                            this.wumpusProb.set(k, Math.min(0.85, currentW + 0.4));
                        }
                    });
                    this.logThought(`Stench detected at (${this.x},${this.y}): Menacing predator nearby.`);
                }
            }
        }

        // Update known safe set
        for (let y = 0; y < this.boardSize; y++) {
            for (let x = 0; x < this.boardSize; x++) {
                const k = `${x},${y}`;
                if ((this.pitProb.get(k) === 0.0) && (this.wumpusSlain || this.wumpusProb.get(k) === 0.0)) {
                    this.knownSafe.add(k);
                }
            }
        }
    }

    // A* Pathfinding through known safe cells
    findPathThroughSafeCells(from, to) {
        if (from.x === to.x && from.y === to.y) return [];

        const startKey = `${from.x},${from.y}`;
        const targetKey = `${to.x},${to.y}`;

        const frontier = [{ x: from.x, y: from.y, cost: 0, path: [] }];
        const costSoFar = new Map();
        costSoFar.set(startKey, 0);

        while (frontier.length > 0) {
            // Sort by cost + heuristic
            frontier.sort((a, b) => {
                const hA = Math.abs(a.x - to.x) + Math.abs(a.y - to.y);
                const hB = Math.abs(b.x - to.x) + Math.abs(b.y - to.y);
                return (a.cost + hA) - (b.cost + hB);
            });

            const current = frontier.shift();
            const currKey = `${current.x},${current.y}`;

            if (current.x === to.x && current.y === to.y) {
                return current.path;
            }

            const neighbors = this.getNeighbors(current.x, current.y);
            for (const n of neighbors) {
                const nKey = `${n.x},${n.y}`;
                // Only traverse known safe cells (or destination target)
                if (this.knownSafe.has(nKey) || nKey === targetKey) {
                    const newCost = current.cost + 1;
                    if (!costSoFar.has(nKey) || newCost < costSoFar.get(nKey)) {
                        costSoFar.set(nKey, newCost);
                        frontier.push({
                            x: n.x,
                            y: n.y,
                            cost: newCost,
                            path: [...current.path, { x: n.x, y: n.y, dir: n.dir }]
                        });
                    }
                }
            }
        }

        return null; // No safe path found
    }

    // Compute next action based on current state and difficulty
    decideNextAction(board) {
        const currentKey = `${this.x},${this.y}`;
        const percepts = board.getPerceptsAt(this.x, this.y) || { stench: false, breeze: false, glitter: false };

        this.observe(percepts);

        const possiblePits = [];
        const possibleWumpus = [];
        this.getNeighbors(this.x, this.y).forEach(n => {
            const k = `${n.x},${n.y}`;
            const pPit = this.pitProb.get(k) || 0;
            const pWump = this.wumpusProb.get(k) || 0;
            if (pPit > 0.1) possiblePits.push(`(${n.x},${n.y}): ${Math.round(pPit * 100)}%`);
            if (pWump > 0.1) possibleWumpus.push(`(${n.x},${n.y}): ${Math.round(pWump * 100)}%`);
        });

        // ==================== 1. GLITTER -> COLLECT GOLD ====================
        if (percepts.glitter && !this.hasGold) {
            const dec = {
                position: { x: this.x, y: this.y },
                percepts: this.formatPercepts(percepts),
                possibleWumpus,
                possiblePit: possiblePits,
                risk: 0,
                decision: 'GRAB GOLD',
                action: 'GRAB',
                confidence: 100,
                rationale: 'Glitter detected in current chamber! Seizing the golden treasure.'
            };
            this.lastDecision = dec;
            return dec;
        }

        // ==================== 2. HAS GOLD -> ESCAPE TO (0,0) ====================
        if (this.hasGold) {
            if (this.x === 0 && this.y === 0) {
                const dec = {
                    position: { x: 0, y: 0 },
                    percepts: this.formatPercepts(percepts),
                    possibleWumpus,
                    possiblePit: possiblePits,
                    risk: 0,
                    decision: 'ESCAPE CAVERN',
                    action: 'CLIMB',
                    confidence: 100,
                    rationale: 'Holding treasure at cave exit. Initiating victorious extraction!'
                };
                this.lastDecision = dec;
                return dec;
            }

            // Pathfind safely back to (0,0)
            const escapePath = this.findPathThroughSafeCells({ x: this.x, y: this.y }, { x: 0, y: 0 });
            if (escapePath && escapePath.length > 0) {
                const nextStep = escapePath[0];
                const dec = {
                    position: { x: this.x, y: this.y },
                    percepts: this.formatPercepts(percepts),
                    possibleWumpus,
                    possiblePit: possiblePits,
                    risk: 0,
                    decision: `MOVE ${nextStep.dir}`,
                    action: 'MOVE',
                    target: nextStep,
                    confidence: 98,
                    rationale: `Backtracking along verified safe corridor towards exit (0,0). Step 1 of ${escapePath.length}.`
                };
                this.lastDecision = dec;
                return dec;
            }
        }

        // ==================== 3. SHOOT WUMPUS IF TARGETED & ARMED ====================
        if (this.arrows > 0 && !this.wumpusSlain && (this.difficulty === 'hard' || this.difficulty === 'master')) {
            // Check if known Wumpus is aligned in row or column
            let shootTarget = null;
            let shootDir = null;

            for (const wk of this.definiteWumpus) {
                const [wx, wy] = wk.split(',').map(Number);
                if (wx === this.x) {
                    shootDir = wy < this.y ? 'UP' : 'DOWN';
                    shootTarget = { x: wx, y: wy };
                    break;
                } else if (wy === this.y) {
                    shootDir = wx < this.x ? 'LEFT' : 'RIGHT';
                    shootTarget = { x: wx, y: wy };
                    break;
                }
            }

            if (shootTarget && shootDir) {
                const dec = {
                    position: { x: this.x, y: this.y },
                    percepts: this.formatPercepts(percepts),
                    possibleWumpus,
                    possiblePit: possiblePits,
                    risk: 5,
                    decision: `SHOOT ${shootDir}`,
                    action: 'SHOOT',
                    direction: shootDir,
                    confidence: 95,
                    rationale: `Direct line of sight to verified Wumpus lair at (${shootTarget.x},${shootTarget.y})! Releasing arrow.`
                };
                this.lastDecision = dec;
                return dec;
            }
        }

        // ==================== 4. EXPLORE UNVISITED SAFE CELLS ====================
        const unvisitedSafe = [];
        for (const safeKey of this.knownSafe) {
            if (!this.visited.has(safeKey)) {
                const [sx, sy] = safeKey.split(',').map(Number);
                unvisitedSafe.push({ x: sx, y: sy });
            }
        }

        if (unvisitedSafe.length > 0) {
            // Find closest safe cell using pathfinding
            let bestPath = null;
            let bestTarget = null;

            for (const target of unvisitedSafe) {
                const path = this.findPathThroughSafeCells({ x: this.x, y: this.y }, target);
                if (path && (bestPath === null || path.length < bestPath.length)) {
                    bestPath = path;
                    bestTarget = target;
                }
            }

            if (bestPath && bestPath.length > 0) {
                const nextStep = bestPath[0];
                const dec = {
                    position: { x: this.x, y: this.y },
                    percepts: this.formatPercepts(percepts),
                    possibleWumpus,
                    possiblePit: possiblePits,
                    risk: 0,
                    decision: `MOVE ${nextStep.dir}`,
                    action: 'MOVE',
                    target: nextStep,
                    confidence: 94,
                    rationale: `Navigating safely towards unexplored proven safe chamber at (${bestTarget.x},${bestTarget.y}).`
                };
                this.lastDecision = dec;
                return dec;
            }
        }

        // ==================== 5. CALCULATED RISK (FRONTIER STEPPING) ====================
        // No 100% safe unvisited cells exist! Must evaluate frontier risks
        const neighbors = this.getNeighbors(this.x, this.y);
        const unvisitedNeighbors = neighbors.filter(n => !this.visited.has(`${n.x},${n.y}`));

        if (unvisitedNeighbors.length > 0) {
            let candidateNeighbors = unvisitedNeighbors;

            // Easy difficulty sometimes takes random risky steps
            if (this.difficulty === 'easy' && Math.random() < 0.4) {
                const randomChoice = candidateNeighbors[Math.floor(Math.random() * candidateNeighbors.length)];
                const dec = {
                    position: { x: this.x, y: this.y },
                    percepts: this.formatPercepts(percepts),
                    possibleWumpus,
                    possiblePit: possiblePits,
                    risk: 50,
                    decision: `MOVE ${randomChoice.dir}`,
                    action: 'MOVE',
                    target: randomChoice,
                    confidence: 50,
                    rationale: 'Novice instinct: Taking a daring step into the unknown darkness.'
                };
                this.lastDecision = dec;
                return dec;
            }

            // Calculate risk: 1 - (1 - PitProb) * (1 - WumpusProb)
            let lowestRisk = 999;
            let bestMove = candidateNeighbors[0];

            for (const n of candidateNeighbors) {
                const k = `${n.x},${n.y}`;
                const pPit = this.pitProb.get(k) || 0.2;
                const pWump = this.wumpusSlain ? 0 : (this.wumpusProb.get(k) || 0.1);
                const combinedRisk = 1.0 - (1.0 - pPit) * (1.0 - pWump);

                if (combinedRisk < lowestRisk) {
                    lowestRisk = combinedRisk;
                    bestMove = n;
                }
            }

            const riskPct = Math.round(lowestRisk * 100);
            const dec = {
                position: { x: this.x, y: this.y },
                percepts: this.formatPercepts(percepts),
                possibleWumpus,
                possiblePit: possiblePits,
                risk: riskPct,
                decision: `MOVE ${bestMove.dir}`,
                action: 'MOVE',
                target: bestMove,
                confidence: Math.max(15, 100 - riskPct),
                rationale: `No certain safe path. Calculated lowest probability of hazard at (${bestMove.x},${bestMove.y}) with ${riskPct}% risk.`
            };
            this.lastDecision = dec;
            return dec;
        }

        // Fallback: Backtrack to any visited neighbor
        const visitedNeighbors = neighbors.filter(n => this.visited.has(`${n.x},${n.y}`));
        const fallback = visitedNeighbors[0] || neighbors[0];
        const dec = {
            position: { x: this.x, y: this.y },
            percepts: this.formatPercepts(percepts),
            possibleWumpus,
            possiblePit: possiblePits,
            risk: 0,
            decision: `MOVE ${fallback.dir}`,
            action: 'MOVE',
            target: fallback,
            confidence: 80,
            rationale: 'Backtracking to previous chamber to reassess topological options.'
        };
        this.lastDecision = dec;
        return dec;
    }

    formatPercepts(p) {
        const list = [];
        if (p.stench) list.push('STENCH');
        if (p.breeze) list.push('BREEZE');
        if (p.glitter) list.push('GLITTER');
        if (p.scream) list.push('SCREAM');
        return list;
    }

    logThought(msg) {
        this.thoughtLog.unshift({
            time: new Date().toLocaleTimeString(),
            text: msg
        });
        if (this.thoughtLog.length > 25) {
            this.thoughtLog.pop();
        }
    }
}

// Global exposure
window.WumpusAIAgent = WumpusAIAgent;
