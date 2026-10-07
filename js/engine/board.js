/**
 * Wumpus World - Board Generator & Logic
 * Handles procedural dungeon creation, safe start validation, path solvability,
 * fog-of-war states, and environmental percept calculations.
 */

class WumpusBoard {
    constructor(size = 4, difficulty = 'easy', levelConfig = null) {
        this.size = size;
        this.difficulty = difficulty;
        this.levelConfig = levelConfig; // Optional per-level override (see levels.js)
        this.grid = []; // 2D array [y][x]
        this.wumpusList = []; // List of Wumpus positions: [{x, y, alive: true, id: 1}]
        this.pitList = [];    // List of pit positions: [{x, y}]
        this.goldList = [];   // List of gold positions: [{x, y, collected: false}]
        this.startPos = { x: 0, y: 0 };
        this.wumpusScream = false; // Set to true when any Wumpus is killed
        this.init();
    }

    init() {
        this.generatePlayableBoard();
    }

    // Config based on difficulty
    getConfig() {
        if (this.levelConfig) return { ...this.levelConfig };
        switch (this.difficulty) {
            case 'easy':
                return { size: 4, pits: 3, wumpusCount: 1, goldCount: 1, arrows: 3 };
            case 'medium':
                return { size: 6, pits: 5, wumpusCount: 1, goldCount: 1, arrows: 3 };
            case 'hard':
                return { size: 8, pits: 8, wumpusCount: 1, goldCount: 2, arrows: 2 };
            case 'extreme':
                return { size: 10, pits: 16, wumpusCount: 2, goldCount: 2, arrows: 2 };
            default:
                return { size: this.size, pits: Math.floor(this.size * this.size * 0.18), wumpusCount: 1, goldCount: 1, arrows: 2 };
        }
    }

    generatePlayableBoard() {
        const config = this.getConfig();
        this.size = config.size;

        let attempts = 0;
        let valid = false;

        while (!valid && attempts < 100) {
            attempts++;
            this.buildEmptyGrid();
            this.placeHazards(config);
            valid = this.verifySolvability();
        }

        // If random generation was unlucky after 100 tries, force a guaranteed safe path
        if (!valid) {
            this.carveSafePathToGold();
        }

        this.updateAllPercepts();
    }

    buildEmptyGrid() {
        this.grid = [];
        this.wumpusList = [];
        this.pitList = [];
        this.goldList = [];
        this.wumpusScream = false;

        for (let y = 0; y < this.size; y++) {
            const row = [];
            for (let x = 0; x < this.size; x++) {
                row.push({
                    x: x,
                    y: y,
                    isPit: false,
                    isWumpus: false,
                    wumpusRef: null,
                    hasGold: false,
                    goldRef: null,
                    hasBreeze: false,
                    hasStench: false,
                    hasGlitter: false,
                    explored: false, // Seen/revealed by player
                    visitedBy: []    // ['p1', 'p2', 'ai']
                });
            }
            this.grid.push(row);
        }

        // Entrance (0,0) is always explored and safe
        this.grid[0][0].explored = true;
    }

    placeHazards(config) {
        // Collect candidate cells (all cells except start (0,0) and its immediate neighbors)
        const safeZone = new Set(['0,0', '1,0', '0,1']);
        const candidates = [];

        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const key = `${x},${y}`;
                if (!safeZone.has(key)) {
                    candidates.push({ x, y });
                }
            }
        }

        // Shuffle candidates
        this.shuffle(candidates);

        let cIndex = 0;

        // Place Wumpus
        for (let i = 0; i < config.wumpusCount && cIndex < candidates.length; i++) {
            const pos = candidates[cIndex++];
            const wumpus = { x: pos.x, y: pos.y, alive: true, id: i + 1 };
            this.wumpusList.push(wumpus);
            this.grid[pos.y][pos.x].isWumpus = true;
            this.grid[pos.y][pos.x].wumpusRef = wumpus;
        }

        // Place Gold
        for (let i = 0; i < config.goldCount && cIndex < candidates.length; i++) {
            const pos = candidates[cIndex++];
            const gold = { x: pos.x, y: pos.y, collected: false, id: i + 1 };
            this.goldList.push(gold);
            this.grid[pos.y][pos.x].hasGold = true;
            this.grid[pos.y][pos.x].goldRef = gold;
        }

        // Place Pits
        for (let i = 0; i < config.pits && cIndex < candidates.length; i++) {
            const pos = candidates[cIndex++];
            // Don't place a pit on a gold tile
            if (!this.grid[pos.y][pos.x].hasGold) {
                this.pitList.push({ x: pos.x, y: pos.y });
                this.grid[pos.y][pos.x].isPit = true;
            }
        }
    }

    // Verify that at least one gold is reachable from (0,0) without stepping into a Pit
    verifySolvability() {
        if (this.goldList.length === 0) return false;

        const queue = [{ x: 0, y: 0 }];
        const visited = new Set(['0,0']);

        while (queue.length > 0) {
            const current = queue.shift();

            // Check if reached any gold
            for (const gold of this.goldList) {
                if (current.x === gold.x && current.y === gold.y) {
                    return true;
                }
            }

            const neighbors = this.getOrthogonalNeighbors(current.x, current.y);
            for (const n of neighbors) {
                const key = `${n.x},${n.y}`;
                // Valid traversal cell is within board and is NOT a pit
                if (!visited.has(key) && !this.grid[n.y][n.x].isPit) {
                    visited.add(key);
                    queue.push(n);
                }
            }
        }

        return false;
    }

    carveSafePathToGold() {
        if (this.goldList.length === 0) return;
        const target = this.goldList[0];
        let cx = 0;
        let cy = 0;

        // Simple Manhattan walk from (0,0) to target, clearing pits along the way
        while (cx !== target.x || cy !== target.y) {
            if (cx < target.x) cx++;
            else if (cy < target.y) cy++;

            if (this.grid[cy][cx].isPit) {
                this.grid[cy][cx].isPit = false;
                this.pitList = this.pitList.filter(p => !(p.x === cx && p.y === cy));
            }
        }
    }

    // Returns orthogonally adjacent cells within bounds
    getOrthogonalNeighbors(x, y) {
        const dirs = [
            { x: x, y: y - 1, dir: 'UP' },
            { x: x, y: y + 1, dir: 'DOWN' },
            { x: x - 1, y: y, dir: 'LEFT' },
            { x: x + 1, y: y, dir: 'RIGHT' }
        ];
        return dirs.filter(d => d.x >= 0 && d.x < this.size && d.y >= 0 && d.y < this.size);
    }

    // Compute stench, breeze, glitter for all cells
    updateAllPercepts() {
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const cell = this.grid[y][x];
                const neighbors = this.getOrthogonalNeighbors(x, y);

                // Breeze: Any adjacent cell has a pit
                cell.hasBreeze = neighbors.some(n => this.grid[n.y][n.x].isPit);

                // Stench: Any adjacent cell has an ALIVE Wumpus
                cell.hasStench = neighbors.some(n => {
                    const neighborCell = this.grid[n.y][n.x];
                    return neighborCell.isWumpus && neighborCell.wumpusRef && neighborCell.wumpusRef.alive;
                });

                // Glitter: Current cell has uncollected gold
                cell.hasGlitter = cell.hasGold && cell.goldRef && !cell.goldRef.collected;
            }
        }
    }

    // Percepts observed by an agent at position (x, y)
    getPerceptsAt(x, y) {
        if (!this.isValid(x, y)) return null;

        const cell = this.grid[y][x];
        return {
            stench: cell.hasStench,
            breeze: cell.hasBreeze,
            glitter: cell.hasGlitter,
            scream: this.wumpusScream,
            bump: false
        };
    }

    isValid(x, y) {
        return x >= 0 && x < this.size && y >= 0 && y < this.size;
    }

    getCell(x, y) {
        if (!this.isValid(x, y)) return null;
        return this.grid[y][x];
    }

    // Reveal cell and its immediate surroundings for fog-of-war
    exploreCell(x, y, playerId = 'p1') {
        if (!this.isValid(x, y)) return;

        const cell = this.grid[y][x];
        cell.explored = true;
        if (!cell.visitedBy.includes(playerId)) {
            cell.visitedBy.push(playerId);
        }

        // Also reveal adjacent cells in fog of war as seen (silhouette)
        const neighbors = this.getOrthogonalNeighbors(x, y);
        neighbors.forEach(n => {
            this.grid[n.y][n.x].explored = true;
        });
    }

    // Shoot arrow in direction from (x, y)
    shootArrow(fromX, fromY, direction) {
        const dx = direction === 'RIGHT' ? 1 : direction === 'LEFT' ? -1 : 0;
        const dy = direction === 'DOWN' ? 1 : direction === 'UP' ? -1 : 0;

        let cx = fromX;
        let cy = fromY;
        const path = [];
        let hit = false;
        let killedWumpus = null;

        while (true) {
            cx += dx;
            cy += dy;

            if (!this.isValid(cx, cy)) {
                // Hit boundary cave wall
                break;
            }

            path.push({ x: cx, y: cy });
            const cell = this.grid[cy][cx];

            // Check if arrow strikes an alive Wumpus
            if (cell.isWumpus && cell.wumpusRef && cell.wumpusRef.alive) {
                hit = true;
                cell.wumpusRef.alive = false;
                killedWumpus = cell.wumpusRef;
                this.wumpusScream = true;
                // Recompute stenches since Wumpus died
                this.updateAllPercepts();
                break;
            }
        }

        return {
            hit: hit,
            killedWumpus: killedWumpus,
            path: path,
            stoppedAt: { x: cx, y: cy }
        };
    }

    clearWumpusScream() {
        this.wumpusScream = false;
    }

    collectGold(x, y) {
        const cell = this.getCell(x, y);
        if (cell && cell.hasGold && cell.goldRef && !cell.goldRef.collected) {
            cell.goldRef.collected = true;
            cell.hasGlitter = false;
            return true;
        }
        return false;
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

// Attach to window
window.WumpusBoard = WumpusBoard;
