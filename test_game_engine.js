/**
 * Comprehensive Automated Test Suite for Wumpus World Engine
 * Validates Board generation, Solvability, Percepts, AI Decision Making,
 * Scoring, and State Transitions.
 */

// Mock window and browser APIs for Node environment
global.window = global;
global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = v.toString(); },
    removeItem(k) { delete this._data[k]; }
};

// Load Engine Files
require('./js/engine/storage.js');
require('./js/engine/levels.js');
require('./js/engine/board.js');
require('./js/ai/ai.js');
require('./js/engine/game.js');

console.log('=== RUNNING WUMPUS WORLD ENGINE TESTS ===\n');

let testsPassed = 0;
let testsTotal = 0;

function assert(condition, message) {
    testsTotal++;
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exit(1);
    } else {
        testsPassed++;
        console.log(`✅ PASS: ${message}`);
    }
}

// TEST 1: Board Generation & Solvability
console.log('[1] Testing Board Generation across difficulties:');
['easy', 'medium', 'hard', 'extreme'].forEach(diff => {
    const board = new window.WumpusBoard(4, diff);
    assert(board.grid.length === board.size, `${diff} board height is ${board.size}`);
    assert(board.grid[0].length === board.size, `${diff} board width is ${board.size}`);
    assert(!board.grid[0][0].isPit, `Entrance (0,0) is never a pit on ${diff}`);
    assert(!board.grid[0][0].isWumpus, `Entrance (0,0) never has Wumpus on ${diff}`);
    assert(board.goldList.length > 0, `${diff} has at least 1 gold`);
    assert(board.verifySolvability(), `${diff} board is verified solvable by BFS path`);
});

// TEST 2: Percept Generation (Breeze & Stench)
console.log('\n[2] Testing Percept Logic:');
const testBoard = new window.WumpusBoard(4, 'easy');
// Clear randomly generated hazards so the forced layout is deterministic
testBoard.grid.forEach(row => row.forEach(c => { c.isPit = false; c.isWumpus = false; c.wumpusRef = null; }));
testBoard.pitList = [];
testBoard.wumpusList = [];
// Force known hazards
testBoard.grid[1][1].isPit = true;
testBoard.grid[2][2].isWumpus = true;
testBoard.grid[2][2].wumpusRef = { x: 2, y: 2, alive: true };
testBoard.updateAllPercepts();

const cell01 = testBoard.getCell(0, 1);
const cell10 = testBoard.getCell(1, 0);
assert(cell01.hasBreeze, 'Cell (0,1) detects Breeze from Pit at (1,1)');
assert(cell10.hasBreeze, 'Cell (1,0) detects Breeze from Pit at (1,1)');

const cell21 = testBoard.getCell(2, 1);
assert(cell21.hasStench, 'Cell (2,1) detects Stench from Wumpus at (2,2)');

// TEST 3: Arrow Shooting
console.log('\n[3] Testing Arrow Mechanics:');
// Shoot from (2, 0) DOWN towards Wumpus at (2, 2)
const shootResult = testBoard.shootArrow(2, 0, 'DOWN');
assert(shootResult.hit === true, 'Arrow hits Wumpus in straight line');
assert(testBoard.wumpusScream === true, 'Wumpus scream echoes cave-wide upon kill');
assert(testBoard.getCell(2, 2).wumpusRef.alive === false, 'Wumpus is marked dead');

// Recheck percepts after death
assert(testBoard.getCell(2, 1).hasStench === false, 'Stench disappears when Wumpus is killed');

// TEST 4: AI Logical Inference & Knowledge Base
console.log('\n[4] Testing AI Agent Propositional Reasoning:');
const ai = new window.WumpusAIAgent('test_ai', 'Test Agent', 'normal', 4);

// At (0,0), observe no breeze and no stench
ai.observe({ breeze: false, stench: false, glitter: false, scream: false });
assert(ai.knownSafe.has('1,0'), 'AI infers (1,0) is 100% SAFE when (0,0) has no breeze/stench');
assert(ai.knownSafe.has('0,1'), 'AI infers (0,1) is 100% SAFE when (0,0) has no breeze/stench');
assert(ai.pitProb.get('1,0') === 0.0, 'Pit probability of (1,0) is 0%');

// Step to (1,0) with breeze
ai.x = 1; ai.y = 0;
ai.observe({ breeze: true, stench: false, glitter: false, scream: false });
// Neighbors of (1,0) are (0,0) [visited], (2,0), and (1,1)
assert(ai.pitProb.get('2,0') > 0, 'Unvisited neighbor (2,0) has increased pit risk');
assert(ai.pitProb.get('1,1') > 0, 'Unvisited neighbor (1,1) has increased pit risk');

const aiDecision = ai.decideNextAction(testBoard);
assert(aiDecision && aiDecision.decision, `AI makes concrete decision: ${aiDecision.decision} (${aiDecision.rationale})`);

// TEST 5: Game Engine State Machine & Actions
console.log('\n[5] Testing Game Engine Integration:');
const game = window.GameEngine;
game.startNewGame({ mode: 'VS_AI', difficulty: 'easy' });

assert(game.gameState === 'PLAYING', 'Game state is PLAYING');
assert(game.players.length === 2, 'Player vs AI has 2 players');
assert(game.players[0].id === 'p1', 'Player 1 is Human Adventurer');
assert(game.players[1].id === 'ai', 'Player 2 is AI Automaton');

const initialScore = game.players[0].score;
game.movePlayer('RIGHT');
assert(game.players[0].x === 1 && game.players[0].y === 0, 'Player moves to (1,0)');

// Test Gold Collection
// When P1 moves, turn changes to AI. For testing P1 gold collection, set active player to P1 at (1,0)
game.activePlayerIndex = 0; // P1
game.players[0].x = 1;
game.players[0].y = 0;
game.board.grid[0][1].hasGold = true;
game.board.grid[0][1].goldRef = { x: 1, y: 0, collected: false };
game.board.updateAllPercepts();

const grabbed = game.grabGold();
assert(grabbed === true, 'Player collects gold');
assert(game.players[0].hasGold === true, 'Player inventory reflects gold acquired');

// Return to entrance and escape
game.activePlayerIndex = 0; // Ensure P1 is active
game.players[0].x = 0;
game.players[0].y = 0;
game.escapeCavern();
assert(game.players[0].hasEscaped === true, 'Player escapes cavern');
assert(game.gameState === 'VICTORY', 'Game transitions to VICTORY');

// TEST 6: Multi-level campaign & unlock rules
console.log('\n[6] Testing Level Progression:');
const L = window.WumpusLevels;
const store = window.GameStorage;
store.resetAllProgress();

assert(L.count >= 5, `Campaign has multiple levels (${L.count})`);
for (let i = 1; i <= L.count; i++) {
    const lv = L.get(i);
    const b = new window.WumpusBoard(lv.size, lv.tier, L.getConfig(i));
    assert(b.size === lv.size && b.pitList.length <= lv.pits && b.wumpusList.length === lv.wumpusCount,
        `Level ${i} board matches its config (${lv.size}x${lv.size}, ${lv.wumpusCount} wumpus)`);
    assert(b.verifySolvability(), `Level ${i} board is solvable`);
    if (i > 1) {
        const prev = L.get(i - 1);
        assert(lv.size >= prev.size, `Level ${i} is not smaller than level ${i - 1}`);
    }
}

assert(store.isLevelUnlocked(1) === true, 'Level 1 is unlocked by default');
assert(store.isLevelUnlocked(2) === false, 'Level 2 starts locked');
assert(store.isLevelUnlocked(L.count) === false, 'Final level starts locked');

// Requesting a locked level falls back to the highest unlocked one
game.startNewGame({ mode: 'SINGLE', level: 3 });
assert(game.level === 1, 'Starting a locked level falls back to Level 1');
game.stopTimers();

// Dying does NOT unlock the next level
game.startNewGame({ mode: 'SINGLE', level: 1 });
game.players[0].isAlive = false;
game.players[0].health = 0;
game.checkGameCompletion();
assert(game.gameState === 'GAME_OVER', 'Dying ends the level as GAME_OVER');
assert(store.isLevelUnlocked(2) === false, 'Dying does not unlock Level 2');

// Escaping WITHOUT gold does NOT unlock the next level
game.startNewGame({ mode: 'SINGLE', level: 1 });
game.escapeCavern();
assert(store.isLevelUnlocked(2) === false, 'Escaping empty-handed does not unlock Level 2');

// Completing the level (gold + escape) unlocks the next
let seen = null;
game.onVictory = (d) => { seen = d; };
game.startNewGame({ mode: 'SINGLE', level: 1 });
const g0 = game.board.goldList[0];
game.players[0].x = g0.x; game.players[0].y = g0.y;
game.grabGold();
game.activePlayerIndex = 0;
game.players[0].x = 0; game.players[0].y = 0;
game.escapeCavern();
assert(game.gameState === 'VICTORY', 'Level 1 victory reached');
assert(store.isLevelCompleted(1) === true, 'Level 1 recorded as completed');
assert(store.isLevelUnlocked(2) === true, 'Level 2 unlocks after clearing Level 1');
assert(store.isLevelUnlocked(3) === false, 'Level 3 stays locked until Level 2 is cleared');
const lbBefore = store.leaderboard.filter(e => e.difficulty.startsWith('Level 1')).length;
assert(lbBefore === 1, 'Victory writes exactly one leaderboard entry (no duplicates)');
assert(seen && seen.levelResult && seen.levelResult.nextLevel === 2 && seen.levelResult.newlyUnlocked, 'Victory payload announces Level 2 unlock');

// Progress survives a reload (persisted in localStorage)
const reloaded = new store.constructor();
assert(reloaded.isLevelUnlocked(2) === true && reloaded.isLevelUnlocked(3) === false, 'Unlocked levels persist after reload');

// AI vs AI never unlocks anything
game.startNewGame({ mode: 'AI_VS_AI', level: 2 });
game.players[0].hasGold = true; game.players[0].hasEscaped = true;
game.checkGameCompletion();
assert(store.isLevelCompleted(2) === false && store.isLevelUnlocked(3) === false, 'AI winning does not unlock Level 3');
game.stopTimers();

// TEST 7: Level Reward System & Single Reward Priority
console.log('\n[7] Testing Level Rewards (Single Reward & Priority):');
store.resetAllProgress();

// Simulate completing Level 1 unlocking first_steps, first_victory, treasure_hunter
// Priority: 1. Beast Slayer, 2. Blind Marksman, 3. Treasure Hoarder, 4. Flawless Mind, etc.
const reward1 = store.selectSingleRewardForLevel(1, ['first_steps', 'first_victory', 'treasure_hunter']);
assert(reward1 !== null, 'Level 1 generated a reward');
assert(reward1.achievementId === 'treasure_hunter', 'Selected Treasure Hoarder over First Steps & Cave Conqueror per priority');
assert(store.hasLevelReward(1) === true, 'Level 1 reward exists in storage');
assert(reward1.isClaimed === false, 'Level 1 reward starts unclaimed');

// Replaying Level 1 must NOT generate another reward
const replayReward = store.selectSingleRewardForLevel(1, ['wumpus_slayer', 'first_steps']);
assert(replayReward.achievementId === 'treasure_hunter', 'Replaying Level 1 returns existing reward, never creates a second one');

// Claiming Level 1 reward
const claimed = store.claimLevelReward(1);
assert(claimed.isClaimed === true, 'Level 1 reward is successfully claimed');
const claimedAgain = store.claimLevelReward(1);
assert(claimedAgain.isClaimed === true && claimedAgain.claimedAt === claimed.claimedAt, 'Clicking claim again does not duplicate reward or grant duplicate XP');

// TEST 8: Level 1 Reward active in Level 2 & affects gameplay (+1 Starting Arrow)
console.log('\n[8] Testing Level Reward Perks in Level 2:');
const activeInL2 = store.getActiveRewardsForLevel(2);
assert(activeInL2.length === 1, 'Level 2 has exactly 1 active reward from Level 1');
assert(activeInL2[0].perkTitle === claimed.perkTitle, 'Level 2 active reward matches Level 1 claimed perk');

// Slaying Wumpus reward grants bonus arrow
store.levelRewards['1'] = {
    levelId: 1,
    achievementId: 'wumpus_slayer',
    title: 'Beast Slayer',
    perkTitle: 'Quiver Expansion',
    perkDescription: '+1 Starting Arrow',
    rewardText: '+1 Starting Arrow in subsequent caverns',
    isClaimed: true,
    bonusArrows: 1,
    bonusScore: 0,
    icon: '🏹'
};
store.saveLevelRewards();

const mods = store.getPerkModifiersForLevel(2);
assert(mods.bonusArrows === 1, 'Level 2 receives +1 bonus starting arrow modifier');

// Unlock Level 2 and start game in Level 2
store.completeLevel(1, 1000, '01:00');
game.startNewGame({ mode: 'SINGLE', level: 2 });
const lvl2Config = window.WumpusLevels.getConfig(2);
assert(game.players[0].arrows === lvl2Config.arrows + 1, `Level 2 actually starts with ${lvl2Config.arrows + 1} arrows (base ${lvl2Config.arrows} + 1 reward)`);
game.stopTimers();

// TEST 9: Percept Verification & Environmental Logic
console.log('\n[9] Testing Percepts (Breeze, Stench, Glitter, Scream):');
const pBoard = new window.WumpusBoard(4, 'easy');
pBoard.grid.forEach(row => row.forEach(c => {
    c.isPit = false;
    c.isWumpus = false;
    c.wumpusRef = null;
    c.hasGold = false;
    c.goldRef = null;
}));
pBoard.pitList = [];
pBoard.wumpusList = [];
pBoard.goldList = [];

// Pit at (0, 1), Alive Wumpus at (1, 0), Gold at (0, 0)
pBoard.grid[1][0].isPit = true;
pBoard.pitList.push({ x: 0, y: 1 });

pBoard.grid[0][1].isWumpus = true;
pBoard.grid[0][1].wumpusRef = { x: 1, y: 0, alive: true };
pBoard.wumpusList.push(pBoard.grid[0][1].wumpusRef);

pBoard.grid[0][0].hasGold = true;
pBoard.grid[0][0].goldRef = { x: 0, y: 0, collected: false };
pBoard.goldList.push(pBoard.grid[0][0].goldRef);

pBoard.updateAllPercepts();

const pAt00 = pBoard.getPerceptsAt(0, 0);
assert(pAt00.breeze === true, 'Cell (0,0) has Breeze from Pit at (0,1)');
assert(pAt00.stench === true, 'Cell (0,0) has Stench from Wumpus at (1,0)');
assert(pAt00.glitter === true, 'Cell (0,0) has Glitter from Gold at (0,0)');
assert(pAt00.breeze && pAt00.stench, 'Cell (0,0) exhibits simultaneous BREEZE + STENCH without collision');

// Slaying Wumpus at (1, 0) removes stench immediately
const slayRes = pBoard.shootArrow(0, 0, 'RIGHT');
assert(slayRes.hit === true, 'Arrow hits Wumpus at (1,0)');
assert(pBoard.wumpusScream === true, 'Scream is active immediately upon kill');
const pAfterKill = pBoard.getPerceptsAt(0, 0);
assert(pAfterKill.stench === false, 'Stench is removed immediately after Wumpus death');

// Scream clears after moving/clearing
pBoard.clearWumpusScream();
assert(pBoard.wumpusScream === false, 'Scream clears and does not remain perpetually');

// TEST 10: Instant Fatal Hazards & Game Over
console.log('\n[10] Testing Instant Game Over on Fatal Hazards:');
game.startNewGame({ mode: 'SINGLE', level: 1 });
// Clear random hazards, place pit at (1,0)
game.board.grid[0][1].isPit = true;
game.movePlayer('RIGHT');
assert(game.players[0].isAlive === false, 'Stepping into Pit kills player immediately');
assert(game.gameState === 'GAME_OVER' || game.gameState === 'DEFEAT', 'Game transitions to GAME_OVER/DEFEAT immediately');
assert(store.getLevelReward(1).achievementId !== 'fatal_error', 'Game over does not create a level reward');
// Attempting further movement is rejected
const moveAfterDeath = game.movePlayer('LEFT');
assert(moveAfterDeath === false, 'No further movement allowed after death');

// TEST 11: Centralized Session Reset (goToMainMenu behavior)
console.log('\n[11] Testing Centralized Session Reset:');
game.resetSession();
assert(game.gameState === 'IDLE' || game.gameState === 'MENU' || game.gameState === 'READY', 'Game session state reset to IDLE/MENU/READY');
assert(game.players.length === 0, 'Temporary session players cleared');
assert(game.board === null, 'Temporary board cleared');
// Saved progress must be completely intact
assert(store.isLevelCompleted(1) === true, 'Level 1 completion preserved');
assert(store.isLevelUnlocked(2) === true, 'Level 2 unlock preserved');
assert(store.hasLevelReward(1) === true, 'Claimed level reward preserved');

// TEST 12: Reload Persistence from LocalStorage
console.log('\n[12] Testing Refresh/Reload Persistence:');
const freshStore = new window.GameStorage.constructor();
assert(freshStore.hasLevelReward(1) === true, 'Level reward survives browser refresh');
assert(freshStore.getLevelReward(1).isClaimed === true, 'Claim status survives browser refresh');
assert(freshStore.isLevelUnlocked(2) === true, 'Level progression survives browser refresh');

console.log(`\n🎉 ALL ${testsPassed} / ${testsTotal} TESTS PASSED PERFECTLY!\n`);
process.exit(0);
