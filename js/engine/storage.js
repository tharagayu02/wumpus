/**
 * Wumpus World - Storage System
 * Handles localStorage persistence for Settings, Achievements, and Leaderboard.
 */

const STORAGE_KEYS = {
    SETTINGS: 'wumpus_settings_v1',
    ACHIEVEMENTS: 'wumpus_achievements_v1',
    LEADERBOARD: 'wumpus_leaderboard_v1',
    LEVEL_PROGRESS: 'wumpus_level_progress_v1',
    LEVEL_REWARDS: 'wumpus_level_rewards_v1'
};

const DEFAULT_SETTINGS = {
    masterVolume: 0.8,
    musicVolume: 0.6,
    sfxVolume: 0.85,
    muted: false,
    screenShake: true,
    particleDensity: 'ultra', // 'low' | 'medium' | 'ultra'
    aiDelay: 600, // ms delay between AI moves
    gridSize: 4,
    difficulty: 'easy',
    aiDifficulty: 'normal',
    showHints: true
};

const INITIAL_ACHIEVEMENTS = [
    {
        id: 'first_victory',
        title: 'Cave Conqueror',
        desc: 'Escape the cave alive with the golden treasure.',
        icon: '🏆',
        unlocked: false,
        unlockedAt: null
    },
    {
        id: 'wumpus_slayer',
        title: 'Beast Slayer',
        desc: 'Strike down the terrifying Wumpus with a well-aimed arrow.',
        icon: '🏹',
        unlocked: false,
        unlockedAt: null
    },
    {
        id: 'treasure_hunter',
        title: 'Treasure Hoarder',
        desc: 'Collect the legendary Golden Cache.',
        icon: '💰',
        unlocked: false,
        unlockedAt: null
    },
    {
        id: 'cartographer',
        title: 'Master Cartographer',
        desc: 'Explore over 75% of the cavern tiles in a single expedition.',
        icon: '🗺️',
        unlocked: false,
        unlockedAt: null
    },
    {
        id: 'master_strategist',
        title: 'Flawless Mind',
        desc: 'Escape with the gold without taking damage or wasting an arrow.',
        icon: '🧠',
        unlocked: false,
        unlockedAt: null
    },
    {
        id: 'speed_runner',
        title: 'Shadow Sprinter',
        desc: 'Conquer the cave and escape in under 60 seconds.',
        icon: '⚡',
        unlocked: false,
        unlockedAt: null
    },
    {
        id: 'first_steps',
        title: 'First Steps',
        desc: 'Take your first steps into the subterranean caverns.',
        icon: '🌱',
        unlocked: false,
        unlockedAt: null
    },
    {
        id: 'extreme_survivor',
        title: 'Extreme Survivor',
        desc: 'Conquer the 10x10 Extreme Cavern labyrinth.',
        icon: '👑',
        unlocked: false,
        unlockedAt: null
    },
    {
        id: 'ai_nemesis',
        title: 'Silicon Nemesis',
        desc: 'Defeat the Master AI in Player vs AI mode.',
        icon: '🤖',
        unlocked: false,
        unlockedAt: null
    },
    {
        id: 'near_death',
        title: 'Death Defier',
        desc: 'Escape the dungeon with only 1 HP remaining.',
        icon: '☠️',
        unlocked: false,
        unlockedAt: null
    },
    {
        id: 'blind_hunter',
        title: 'Blind Marksman',
        desc: 'Shoot and kill the Wumpus inside the fog without stepping into its cell.',
        icon: '🎯',
        unlocked: false,
        unlockedAt: null
    }
];

// Perks assigned when an achievement becomes a Level Reward
const REWARD_PERK_MAP = {
    wumpus_slayer: {
        title: 'Beast Slayer',
        perkTitle: 'Quiver Expansion',
        perkDescription: '+1 Starting Arrow',
        rewardText: '+1 Starting Arrow in subsequent caverns',
        bonusArrows: 1,
        bonusScore: 0,
        icon: '🏹'
    },
    blind_hunter: {
        title: 'Blind Marksman',
        perkTitle: 'Quiver Expansion',
        perkDescription: '+1 Starting Arrow',
        rewardText: '+1 Starting Arrow in subsequent caverns',
        bonusArrows: 1,
        bonusScore: 0,
        icon: '🎯'
    },
    treasure_hunter: {
        title: 'Treasure Hoarder',
        perkTitle: 'Fortune Finder',
        perkDescription: '+250 Starting Score',
        rewardText: '+250 Starting Score bonus',
        bonusArrows: 0,
        bonusScore: 250,
        icon: '💰'
    },
    master_strategist: {
        title: 'Flawless Mind',
        perkTitle: 'Flawless Mind',
        perkDescription: '+1 Starting Arrow',
        rewardText: '+1 Starting Arrow in subsequent caverns',
        bonusArrows: 1,
        bonusScore: 0,
        icon: '🧠'
    },
    speed_runner: {
        title: 'Shadow Sprinter',
        perkTitle: 'Fleet Footwork',
        perkDescription: '+150 Starting Score',
        rewardText: '+150 Starting Score bonus',
        bonusArrows: 0,
        bonusScore: 150,
        icon: '⚡'
    },
    cartographer: {
        title: 'Deep Explorer',
        perkTitle: 'Deep Explorer',
        perkDescription: '+1 Starting Arrow',
        rewardText: '+1 Starting Arrow in subsequent caverns',
        bonusArrows: 1,
        bonusScore: 0,
        icon: '🗺️'
    },
    first_steps: {
        title: 'First Steps',
        perkTitle: 'Quiver Expansion',
        perkDescription: '+1 Starting Arrow',
        rewardText: '+1 Starting Arrow in subsequent caverns',
        bonusArrows: 1,
        bonusScore: 0,
        icon: '🌱'
    },
    near_death: {
        title: 'Pit Survivor',
        perkTitle: 'Pit Survivor',
        perkDescription: '+1 Starting Arrow',
        rewardText: '+1 Starting Arrow in subsequent caverns',
        bonusArrows: 1,
        bonusScore: 0,
        icon: '☠️'
    },
    ai_nemesis: {
        title: 'Tactical Savant',
        perkTitle: 'Tactical Savant',
        perkDescription: '+1 Starting Arrow',
        rewardText: '+1 Starting Arrow in subsequent caverns',
        bonusArrows: 1,
        bonusScore: 0,
        icon: '🤖'
    },
    first_victory: {
        title: 'Cave Conqueror',
        perkTitle: 'Cave Conqueror',
        perkDescription: '+1 Starting Arrow',
        rewardText: '+1 Starting Arrow in subsequent caverns',
        bonusArrows: 1,
        bonusScore: 0,
        icon: '🏆'
    },
    extreme_survivor: {
        title: 'Extreme Survivor',
        perkTitle: 'Abyssal Veteran',
        perkDescription: '+1 Starting Arrow',
        rewardText: '+1 Starting Arrow in subsequent caverns',
        bonusArrows: 1,
        bonusScore: 0,
        icon: '👑'
    }
};

const INITIAL_LEADERBOARD = [
    { rank: 1, name: 'Geralt of Rivia', mode: 'Single Player', difficulty: 'Extreme (10x10)', score: 3250, time: '01:42', date: '2026-09-28' },
    { rank: 2, name: 'DeepMind AlphaCave', mode: 'Player vs AI', difficulty: 'Hard (8x8)', score: 2900, time: '02:05', date: '2026-09-30' },
    { rank: 3, name: 'Lara Croft', mode: 'Single Player', difficulty: 'Hard (8x8)', score: 2750, time: '01:18', date: '2026-10-01' },
    { rank: 4, name: 'Indiana Bones', mode: 'Single Player', difficulty: 'Medium (6x6)', score: 2400, time: '01:34', date: '2026-10-02' },
    { rank: 5, name: 'Shadow Ranger', mode: 'Player vs Friend', difficulty: 'Medium (6x6)', score: 2200, time: '02:15', date: '2026-10-03' },
    { rank: 6, name: 'Cave Initiate', mode: 'Single Player', difficulty: 'Easy (4x4)', score: 1850, time: '00:54', date: '2026-10-04' }
];

class StorageManager {
    constructor() {
        this.settings = this.loadSettings();
        this.achievements = this.loadAchievements();
        this.leaderboard = this.loadLeaderboard();
        this.levelProgress = this.loadLevelProgress();
        this.levelRewards = this.loadLevelRewards();
    }

    // ==================== LEVEL PROGRESS ====================
    // Shape: { completed: { "1": { bestScore, bestTime, completedAt }, ... } }
    loadLevelProgress() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.LEVEL_PROGRESS);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed.completed === 'object' && parsed.completed) return parsed;
            }
        } catch (e) {
            console.warn('StorageManager: Failed to read level progress', e);
        }
        return { completed: {} };
    }

    saveLevelProgress() {
        try {
            localStorage.setItem(STORAGE_KEYS.LEVEL_PROGRESS, JSON.stringify(this.levelProgress));
        } catch (e) {
            console.warn('StorageManager: Failed to save level progress', e);
        }
    }

    isLevelCompleted(levelId) {
        return !!this.levelProgress.completed[String(levelId)];
    }

    // Level 1 is always open; level N is open only if level N-1 is completed
    isLevelUnlocked(levelId) {
        if (levelId <= 1) return true;
        return this.isLevelCompleted(levelId - 1);
    }

    getLevelResult(levelId) {
        return this.levelProgress.completed[String(levelId)] || null;
    }

    // Highest level the player may currently play
    getHighestUnlockedLevel(maxLevel = 1) {
        let highest = 1;
        for (let i = 1; i <= maxLevel; i++) {
            if (this.isLevelUnlocked(i)) highest = i;
        }
        return highest;
    }

    // Record a completed level. Returns { firstClear, newBest }
    completeLevel(levelId, score, timeStr) {
        const key = String(levelId);
        const prev = this.levelProgress.completed[key];
        const firstClear = !prev;
        const newBest = !prev || score > prev.bestScore;
        this.levelProgress.completed[key] = {
            bestScore: prev ? Math.max(prev.bestScore, score) : score,
            bestTime: (newBest ? timeStr : prev.bestTime) || timeStr,
            completedAt: prev ? prev.completedAt : new Date().toISOString()
        };
        this.saveLevelProgress();
        return { firstClear, newBest };
    }

    // ==================== LEVEL REWARDS (0 or 1 per completed level) ====================
    // Shape: { "1": { levelId, achievementId, title, rewardText, perkTitle, perkDescription, isClaimed, claimedAt, bonusArrows, bonusScore, icon } }
    loadLevelRewards() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.LEVEL_REWARDS);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') return parsed;
            }
        } catch (e) {
            console.warn('StorageManager: Failed to read level rewards', e);
        }
        return {};
    }

    saveLevelRewards() {
        try {
            localStorage.setItem(STORAGE_KEYS.LEVEL_REWARDS, JSON.stringify(this.levelRewards));
        } catch (e) {
            console.warn('StorageManager: Failed to save level rewards', e);
        }
    }

    getLevelReward(levelId) {
        if (!levelId) return null;
        return this.levelRewards[String(levelId)] || null;
    }

    hasLevelReward(levelId) {
        if (!levelId) return false;
        return !!this.levelRewards[String(levelId)];
    }

    saveLevelReward(reward) {
        if (!reward || !reward.levelId) return null;
        const key = String(reward.levelId);
        // Only save if no reward exists yet for this level (never duplicate)
        if (!this.levelRewards[key]) {
            this.levelRewards[key] = {
                levelId: Number(reward.levelId),
                achievementId: reward.achievementId,
                title: reward.title,
                rewardText: reward.rewardText,
                perkTitle: reward.perkTitle,
                perkDescription: reward.perkDescription,
                isClaimed: !!reward.isClaimed,
                claimedAt: reward.claimedAt || (reward.isClaimed ? Date.now() : null),
                bonusArrows: reward.bonusArrows || 0,
                bonusScore: reward.bonusScore || 0,
                icon: reward.icon || '🎖️'
            };
            this.saveLevelRewards();
            return this.levelRewards[key];
        }
        return this.levelRewards[key];
    }

    claimLevelReward(levelId) {
        const reward = this.getLevelReward(levelId);
        if (!reward) return null;
        if (reward.isClaimed) {
            // Already claimed: prevent duplicate claiming, duplicate XP or perks
            return reward;
        }
        reward.isClaimed = true;
        reward.claimedAt = Date.now();
        this.saveLevelRewards();
        return reward;
    }

    // Returns claimed rewards from prior levels (e.g. Level 2 receives Level 1's claimed reward)
    getActiveRewardsForLevel(levelId) {
        const active = [];
        if (!levelId) return active;
        for (let i = 1; i < levelId; i++) {
            const r = this.getLevelReward(i);
            if (r && r.isClaimed) {
                active.push(r);
            }
        }
        return active;
    }

    getPerkModifiersForLevel(levelId) {
        let bonusArrows = 0;
        let bonusScore = 0;
        const active = this.getActiveRewardsForLevel(levelId);
        active.forEach(r => {
            if (r.bonusArrows) bonusArrows += r.bonusArrows;
            if (r.bonusScore) bonusScore += r.bonusScore;
        });
        return { bonusArrows, bonusScore };
    }

    // Selects strictly ONE reward for a completed level using specified priority:
    // 1. Beast Slayer (wumpus_slayer)
    // 2. Blind Marksman (blind_hunter)
    // 3. Treasure Hoarder (treasure_hunter)
    // 4. Flawless Mind (master_strategist)
    // 5. Shadow Sprinter (speed_runner)
    // 6. Deep Explorer (cartographer)
    // 7. First Steps (first_steps)
    // 8. Pit Survivor (near_death)
    // 9. Tactical Savant (ai_nemesis)
    // 10. Cave Conqueror (first_victory)
    selectSingleRewardForLevel(levelId, newlyUnlockedIds = []) {
        if (!levelId) return null;
        const existing = this.getLevelReward(levelId);
        if (existing) {
            // Already generated, never duplicate
            return existing;
        }

        const PRIORITY_ORDER = [
            'wumpus_slayer',     // 1. Beast Slayer
            'blind_hunter',      // 2. Blind Marksman
            'treasure_hunter',   // 3. Treasure Hoarder
            'master_strategist', // 4. Flawless Mind
            'speed_runner',      // 5. Shadow Sprinter
            'cartographer',      // 6. Deep Explorer
            'first_steps',       // 7. First Steps
            'near_death',        // 8. Pit Survivor
            'ai_nemesis',        // 9. Tactical Savant
            'first_victory',     // 10. Cave Conqueror
            'extreme_survivor'
        ];

        let chosenId = null;
        for (const pid of PRIORITY_ORDER) {
            if (newlyUnlockedIds.includes(pid)) {
                chosenId = pid;
                break;
            }
        }

        if (!chosenId && newlyUnlockedIds.length > 0) {
            chosenId = newlyUnlockedIds[0];
        }

        // A completed level has 0 or 1 reward. If no achievements were newly unlocked, 0 rewards.
        if (!chosenId) {
            return null;
        }

        const perkData = REWARD_PERK_MAP[chosenId] || {
            title: 'Expedition Honor',
            perkTitle: 'Quiver Expansion',
            perkDescription: '+1 Starting Arrow',
            rewardText: '+1 Starting Arrow in subsequent caverns',
            bonusArrows: 1,
            bonusScore: 0,
            icon: '🏹'
        };

        const reward = {
            levelId: Number(levelId),
            achievementId: chosenId,
            title: perkData.title,
            rewardText: perkData.rewardText,
            perkTitle: perkData.perkTitle,
            perkDescription: perkData.perkDescription,
            isClaimed: false,
            bonusArrows: perkData.bonusArrows,
            bonusScore: perkData.bonusScore,
            icon: perkData.icon
        };

        return this.saveLevelReward(reward);
    }

    loadSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
            if (raw) {
                return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
            }
        } catch (e) {
            console.warn('StorageManager: Failed to read settings from localStorage', e);
        }
        return { ...DEFAULT_SETTINGS };
    }

    saveSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        try {
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
        } catch (e) {
            console.warn('StorageManager: Failed to save settings to localStorage', e);
        }
    }

    loadAchievements() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
            if (raw) {
                const saved = JSON.parse(raw);
                // Merge in case we added new achievements
                return INITIAL_ACHIEVEMENTS.map(initial => {
                    const found = saved.find(s => s.id === initial.id);
                    return found ? { ...initial, ...found } : initial;
                });
            }
        } catch (e) {
            console.warn('StorageManager: Failed to read achievements', e);
        }
        return [...INITIAL_ACHIEVEMENTS];
    }

    unlockAchievement(id) {
        const ach = this.achievements.find(a => a.id === id);
        if (ach && !ach.unlocked) {
            ach.unlocked = true;
            ach.unlockedAt = new Date().toISOString();
            try {
                localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(this.achievements));
            } catch (e) {
                console.warn('StorageManager: Failed to save achievements', e);
            }
            return ach; // Return unlocked achievement for notification toast
        }
        return null;
    }

    loadLeaderboard() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.LEADERBOARD);
            if (raw) {
                return JSON.parse(raw);
            }
        } catch (e) {
            console.warn('StorageManager: Failed to read leaderboard', e);
        }
        return [...INITIAL_LEADERBOARD];
    }

    addLeaderboardEntry(entry) {
        // entry: { name, mode, difficulty, score, time, date }
        const newEntry = {
            name: entry.name || 'Hero',
            mode: entry.mode || 'Single Player',
            difficulty: entry.difficulty || 'Easy (4x4)',
            score: Math.max(0, entry.score || 0),
            time: entry.time || '01:00',
            date: entry.date || new Date().toISOString().split('T')[0]
        };

        this.leaderboard.push(newEntry);
        // Sort descending by score, then ascending by time
        this.leaderboard.sort((a, b) => b.score - a.score);
        // Re-assign ranks
        this.leaderboard.forEach((item, index) => {
            item.rank = index + 1;
        });

        // Keep top 50
        if (this.leaderboard.length > 50) {
            this.leaderboard = this.leaderboard.slice(0, 50);
        }

        try {
            localStorage.setItem(STORAGE_KEYS.LEADERBOARD, JSON.stringify(this.leaderboard));
        } catch (e) {
            console.warn('StorageManager: Failed to save leaderboard', e);
        }

        return newEntry;
    }

    resetAllProgress() {
        this.settings = { ...DEFAULT_SETTINGS };
        this.achievements = [...INITIAL_ACHIEVEMENTS];
        this.leaderboard = [...INITIAL_LEADERBOARD];
        this.levelProgress = { completed: {} };
        this.levelRewards = {};
        try {
            localStorage.removeItem(STORAGE_KEYS.LEVEL_PROGRESS);
            localStorage.removeItem(STORAGE_KEYS.SETTINGS);
            localStorage.removeItem(STORAGE_KEYS.ACHIEVEMENTS);
            localStorage.removeItem(STORAGE_KEYS.LEADERBOARD);
            localStorage.removeItem(STORAGE_KEYS.LEVEL_REWARDS);
        } catch (e) {
            console.warn('StorageManager: Failed to reset localStorage', e);
        }
    }
}

// Global instance
window.GameStorage = new StorageManager();
