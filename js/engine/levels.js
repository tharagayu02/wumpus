/**
 * Wumpus World - Level Definitions
 * Campaign of progressively harder caverns. Level N+1 unlocks only after
 * Level N has been completed (escape with the gold, alive).
 */

const WUMPUS_LEVELS = [
    { id: 1, name: 'The Initiate\'s Hollow',  icon: '🌱', size: 4,  pits: 3,  wumpusCount: 1, goldCount: 1, arrows: 3, tier: 'easy',    blurb: 'A small cave to learn Breeze and Stench cues.' },
    { id: 2, name: 'Whispering Tunnels',      icon: '🕯️', size: 5,  pits: 4,  wumpusCount: 1, goldCount: 1, arrows: 3, tier: 'easy',    blurb: 'A little wider. Pits begin to cluster.' },
    { id: 3, name: 'Medium Chasm',            icon: '🛡️', size: 6,  pits: 5,  wumpusCount: 1, goldCount: 1, arrows: 3, tier: 'medium',  blurb: 'Branching pathways and larger chambers.' },
    { id: 4, name: 'Echoing Depths',          icon: '🦇', size: 7,  pits: 7,  wumpusCount: 1, goldCount: 1, arrows: 3, tier: 'medium',  blurb: 'Breezes overlap. Think before you step.' },
    { id: 5, name: 'Hard Labyrinth',          icon: '💀', size: 8,  pits: 8,  wumpusCount: 1, goldCount: 2, arrows: 2, tier: 'hard',    blurb: 'Two gold caches, fewer arrows.' },
    { id: 6, name: 'Twin Fangs',              icon: '🐺', size: 9,  pits: 12, wumpusCount: 2, goldCount: 2, arrows: 3, tier: 'hard',    blurb: 'Two Wumpuses now stalk the dark.' },
    { id: 7, name: 'Extreme Abyss',           icon: '👑', size: 10, pits: 16, wumpusCount: 2, goldCount: 2, arrows: 2, tier: 'extreme', blurb: 'Maximum peril for dungeon conquerors.' },
    { id: 8, name: 'The Wumpus King\'s Vault', icon: '🐉', size: 10, pits: 20, wumpusCount: 2, goldCount: 2, arrows: 2, tier: 'extreme', blurb: 'The final vault. Every step counts.' }
];

const WumpusLevels = {
    all: WUMPUS_LEVELS,
    count: WUMPUS_LEVELS.length,
    get(id) {
        return WUMPUS_LEVELS.find(l => l.id === id) || null;
    },
    // Board config for a level (shape matches WumpusBoard.getConfig())
    getConfig(id) {
        const l = this.get(id);
        if (!l) return null;
        return { size: l.size, pits: l.pits, wumpusCount: l.wumpusCount, goldCount: l.goldCount, arrows: l.arrows };
    },
    hasNext(id) {
        return !!this.get(id + 1);
    }
};

window.WumpusLevels = WumpusLevels;
