/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { NPC } from './npc.js';
import { Boss, initializeBossData } from './boss.js';
import { HeartDrop, TreasureChest, EnemyProjectile, VictoryItem, HealingZone, RupeeDrop, Door } from './items.js'; 
import { 
    initializeMapData,
    loadRoom as mapLoadRoom, 
    drawMap as mapDrawMap,
    currentRoomId,
    openedChestsGlobalState,
    bossesDefeatedGlobalState,
    victoryItemGlobalState,
    gameMap,
    rooms,
} from './maps/map.js';
import { setupInputHandlers, keysPressed } from './input.js';
import { drawPlayerHP, drawPlayerRupees, drawPlayerInventory, drawCurrentRoomName, drawBossHP, drawDialogBox, drawShopMenu, drawArenaUI, drawArenaTransition, drawArenaComplete } from './ui.js';
import { PLAYER_SIZE, TileType } from './index.js';
import { questManager, QuestState, loadQuests, questState as globalQuestState } from './quest.js';

// --- Game State Enum ---
const GameState = Object.freeze({
    TITLE: 0,
    INSTRUCTIONS: 1,
    PLAYING: 2,
    DIALOG: 3,
    SHOP: 4,
    GAME_OVER: 5,
    GAME_CLEAR: 6,
    ARENA_WAVE_TRANSITION: 7,
    ARENA_COMPLETE: 8,
});

// --- Module-scoped Game State & Config ---
let canvas;
let ctx;
let player;
let enemies = [];
let npcs = [];
let treasureChests = []; 
let heartDrops = [];
let rupeeDrops = [];
let projectiles = [];
let healingZones = [];
let doors = [];
let bosses = [];
let victoryItem = null;
let lastTimestamp = 0;

let currentGameConfig;
let currentDerivedConstants;
let gameState = GameState.TITLE;
let canChangeStateWithKey = true;
let screenDisplayTimer = 0;

// Dialog state
let activeNpc = null;
let dialogLines = [];
let currentDialogLineIndex = 0;

// Shop state
// State for one-time purchase items
let purchasedHeartContainer = false;
let purchasedWeaponUpgrade = false;

const shopItems = [
    { 
        name: "ポーション (持ち物に追加)", 
        price: 20, 
        isAvailable: () => true,
        onPurchase: (p) => { p.addItem('potion', 1); return true; } 
    },
    { 
        name: "ハートの器 (最大HP+1)", 
        price: 150, 
        isAvailable: () => !purchasedHeartContainer,
        onPurchase: (p) => { p.increaseMaxHp(1); purchasedHeartContainer = true; return true; } 
    },
    {
        name: "剣の強化 (攻撃力アップ)",
        price: 200,
        isAvailable: () => !purchasedWeaponUpgrade,
        onPurchase: (p) => { p.increaseAttackPower(1); purchasedWeaponUpgrade = true; return true; }
    }
];
let shopSelectionIndex = 0;


// Save/Load state
const SAVE_KEY = 'littleHeroSaveData';
let saveFileExists = false;
let titleMenuSelection = 'newGame';

// Arena State
let isInArena = false;
let currentArenaWave = 0;
const TOTAL_ARENA_WAVES = 10;
const ARENA_WAVE_TRANSITION_TIME = 3000;
const ARENA_REWARD = 500;
let arenaTransitionTimer = 0;

// --- Initialization ---
export async function initializeAndStartGame(config, derivedConstants, bossConfigs) {
    currentGameConfig = config;
    currentDerivedConstants = derivedConstants;
    initializeBossData(bossConfigs);

    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('2D context not available!');
        return;
    }
    canvas.width = currentDerivedConstants.CANVAS_WIDTH;
    canvas.height = currentDerivedConstants.CANVAS_HEIGHT;
    canvas.setAttribute('aria-label', 'Mini Zelda game area with a tile map and player HP');

    try {
        await initializeMapData(currentGameConfig);
    } catch (error) {
        console.error("Could not initialize game due to map loading failure.", error);
        return;
    }
    
    player = new Player(0, 0); 
    loadQuests(); // Initialize default quest states
    
    saveFileExists = localStorage.getItem(SAVE_KEY) !== null;
    titleMenuSelection = saveFileExists ? 'continue' : 'newGame';

    setupInputHandlers();
    lastTimestamp = 0;
    requestAnimationFrame(gameLoop);
    console.log('小さな勇者 game initialized and showing title screen.');
}

// --- Save/Load System ---
function saveGame() {
    if (!player || !currentRoomId || isInArena) return; // Don't save in the arena

    const saveData = {
        player: {
            currentHp: player.currentHp,
            maxHp: player.maxHp,
            rupees: player.rupees,
            inventory: Array.from(player.inventory.entries()),
            attackPower: player.attackPower,
            x: player.x,
            y: player.y
        },
        currentRoomId: currentRoomId,
        openedChests: Array.from(openedChestsGlobalState.entries()),
        bossesDefeated: Array.from(bossesDefeatedGlobalState),
        victoryItem: Array.from(victoryItemGlobalState.entries()),
        quests: globalQuestState,
        shop: {
            purchasedHeartContainer: purchasedHeartContainer,
            purchasedWeaponUpgrade: purchasedWeaponUpgrade,
        }
    };

    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
        saveFileExists = true; 
        console.log("Game saved successfully.");
    } catch (e) {
        console.error("Failed to save game:", e);
    }
}

function loadGame() {
    const savedDataJSON = localStorage.getItem(SAVE_KEY);
    if (!savedDataJSON) {
        console.log("No save data found, starting new game.");
        startGame();
        return;
    }

    try {
        const savedData = JSON.parse(savedDataJSON);

        // Restore global states first
        openedChestsGlobalState.clear();
        (savedData.openedChests || []).forEach(([key, value]) => openedChestsGlobalState.set(key, value));
        
        bossesDefeatedGlobalState.clear();
        (savedData.bossesDefeated || []).forEach(id => bossesDefeatedGlobalState.add(id));
        
        victoryItemGlobalState.clear();
        (savedData.victoryItem || []).forEach(([key, value]) => victoryItemGlobalState.set(key, value));

        // Restore quests
        if (savedData.quests) {
            Object.assign(globalQuestState, savedData.quests);
        }

        // Restore shop state
        if (savedData.shop) {
            purchasedHeartContainer = savedData.shop.purchasedHeartContainer || false;
            purchasedWeaponUpgrade = savedData.shop.purchasedWeaponUpgrade || false;
        }

        // Restore player persistent stats
        player.maxHp = savedData.player.maxHp;
        player.rupees = savedData.player.rupees || 0;
        player.inventory = new Map(savedData.player.inventory || []);
        player.attackPower = savedData.player.attackPower || 1;
        
        let roomToLoad;
        let playerStartX;
        let playerStartY;
        
        // Check for respawn condition
        if (savedData.player.currentHp <= 0) {
            console.log("Player loading from a defeated state. Respawning...");
            player.currentHp = player.maxHp; // Restore HP
            
            // Set position to the initial room spawn point
            roomToLoad = currentGameConfig.INITIAL_ROOM_ID;
            const initialRoomData = rooms[roomToLoad]; 
            if (initialRoomData && initialRoomData.playerStart) {
                playerStartX = initialRoomData.playerStart.x; 
                playerStartY = initialRoomData.playerStart.y;
            } else {
                // Fallback coordinates
                playerStartX = 1 * currentGameConfig.TILE_SIZE + (currentGameConfig.TILE_SIZE - PLAYER_SIZE) / 2;
                playerStartY = 1 * currentGameConfig.TILE_SIZE + (currentGameConfig.TILE_SIZE - PLAYER_SIZE) / 2;
                console.warn("Fallback respawn coordinates used for player.");
            }
            // Grant invulnerability
            player.isInvulnerable = true; 
            player.invulnerabilityTimer = currentGameConfig.PLAYER_INVULNERABILITY_DURATION / 2; 
            player.invulnerabilityBlinkTimer = 0;
        } else {
            // Normal load
            player.currentHp = savedData.player.currentHp;
            roomToLoad = savedData.currentRoomId;
            playerStartX = savedData.player.x;
            playerStartY = savedData.player.y;
            player.isInvulnerable = false;
            player.invulnerabilityTimer = 0;
        }
        
        // Load room and its contents, providing start coordinates
        const loadResult = mapLoadRoom(roomToLoad, player, currentDerivedConstants, playerStartX, playerStartY);
        enemies = loadResult.enemies;
        treasureChests = loadResult.chests;
        healingZones = loadResult.healingZones;
        npcs = loadResult.npcs;
        doors = loadResult.doors;
        bosses = loadResult.bosses;
        victoryItem = loadResult.victoryItem || null;
        heartDrops = [];
        rupeeDrops = [];
        projectiles = [];
        
        gameState = GameState.INSTRUCTIONS;
        isInArena = false;
        console.log(`Game loaded. Player in room ${currentRoomId}.`);

    } catch (e) {
        console.error("Failed to load or parse save data, starting new game.", e);
        startGame();
    }
}

function clearProgress() {
    openedChestsGlobalState.clear();
    bossesDefeatedGlobalState.clear();
    victoryItemGlobalState.clear();
    loadQuests(); // Reset quests to their initial state
    localStorage.removeItem(SAVE_KEY);
    saveFileExists = false;
    console.log("All progress cleared.");
}

function startGame() {
    clearProgress();
    
    gameState = GameState.INSTRUCTIONS;
    isInArena = false;
    player.maxHp = currentGameConfig.PLAYER_MAX_HP;
    player.rupees = 0;
    player.inventory.clear();
    player.attackPower = 1;
    purchasedHeartContainer = false;
    purchasedWeaponUpgrade = false;

    const roomChange = player.respawn(); 
    const loadResult = mapLoadRoom(roomChange.newRoomId, player, currentDerivedConstants, roomChange.entryX, roomChange.entryY);
    enemies = loadResult.enemies;
    treasureChests = loadResult.chests;
    healingZones = loadResult.healingZones;
    npcs = loadResult.npcs;
    doors = loadResult.doors;
    bosses = loadResult.bosses;
    victoryItem = loadResult.victoryItem || null;
    heartDrops = [];
    rupeeDrops = [];
    projectiles = [];
}

// --- Player Defeat Helper ---
function handlePlayerDefeat() {
    if (!player) return;

    if (isInArena) {
        console.log("Player defeated in Arena. Returning to village.");
        isInArena = false;
        currentArenaWave = 0;
        player.heal(player.maxHp); // Restore health for leaving
        const loadResult = mapLoadRoom('village_area', player, currentDerivedConstants, undefined, undefined);
        enemies = loadResult.enemies;
        treasureChests = loadResult.chests;
        healingZones = loadResult.healingZones;
        npcs = loadResult.npcs;
        doors = loadResult.doors;
        bosses = loadResult.bosses;
        victoryItem = loadResult.victoryItem || null;
        heartDrops = [];
        rupeeDrops = [];
        projectiles = [];
        gameState = GameState.PLAYING;
        return; // Skip normal game over
    }

    console.log(`Player defeated. Rupees reduced from ${player.rupees} to ${Math.floor(player.rupees / 2)}.`);
    player.rupees = Math.floor(player.rupees / 2);
    saveGame();
    gameState = GameState.GAME_OVER;
    screenDisplayTimer = 3000;
}

// --- Game Loop ---
function gameLoop(timestamp) {
    if (!ctx || !currentGameConfig) return;
    if (!lastTimestamp) lastTimestamp = timestamp;
    const deltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    const isAnyKeyPressed = Object.values(keysPressed).some(v => v);
    if (!isAnyKeyPressed) {
        canChangeStateWithKey = true;
    }

    switch(gameState) {
        case GameState.TITLE:
            updateTitleScreen();
            break;
        case GameState.INSTRUCTIONS:
            updateInstructionsScreen();
            break;
        case GameState.PLAYING:
            updateGame(deltaTime);
            break;
        case GameState.DIALOG:
            updateDialog();
            break;
        case GameState.SHOP:
            updateShop();
            break;
        case GameState.GAME_OVER:
            updateGameOverScreen(deltaTime);
            break;
        case GameState.GAME_CLEAR:
            updateGameClearScreen(deltaTime);
            break;
        case GameState.ARENA_WAVE_TRANSITION:
            updateArenaWaveTransition(deltaTime);
            break;
        case GameState.ARENA_COMPLETE:
            updateArenaCompleteScreen(deltaTime);
            break;
    }

    drawGame();
    requestAnimationFrame(gameLoop);
}

// --- Arena Logic ---

function startArenaChallenge() {
    console.log("Starting Arena Challenge!");
    isInArena = true;
    currentArenaWave = 0;
    
    const loadResult = mapLoadRoom('arena', player, currentDerivedConstants, undefined, undefined);
    enemies = loadResult.enemies;
    treasureChests = loadResult.chests;
    healingZones = loadResult.healingZones;
    npcs = loadResult.npcs;
    doors = loadResult.doors;
    bosses = loadResult.bosses;
    victoryItem = loadResult.victoryItem || null;
    heartDrops = [];
    rupeeDrops = [];
    projectiles = [];
    
    handleArenaWaveCompletion();
}

function spawnArenaWave(wave) {
    console.log(`Spawning Arena Wave ${wave}`);
    const newEnemies = [];
    bosses = [];
    const spawnPoints = [
        {x: 5, y: 5}, {x: 20, y: 5}, {x: 5, y: 13}, {x: 20, y: 13}, {x: 12, y: 9}
    ];
    
    const createEnemy = (type, hp, speed, spawnIndex) => {
        const pos = spawnPoints[spawnIndex % spawnPoints.length];
        const enemyX = pos.x * currentGameConfig.TILE_SIZE;
        const enemyY = pos.y * currentGameConfig.TILE_SIZE;
        return new Enemy(enemyX, enemyY, 0, 0, hp, speed, type, undefined);
    };
    
    const TILE_SIZE = currentGameConfig.TILE_SIZE;
    const BOSS_SIZE_val = currentDerivedConstants.BOSS_SIZE;
    const centerBossX = (currentDerivedConstants.CANVAS_WIDTH - BOSS_SIZE_val) / 2;
    const centerBossY = (currentDerivedConstants.CANVAS_HEIGHT - BOSS_SIZE_val) / 2 - TILE_SIZE * 2;
    const leftBossX = TILE_SIZE * 5;
    const rightBossX = currentDerivedConstants.CANVAS_WIDTH - TILE_SIZE * 5 - BOSS_SIZE_val;

    switch(wave) {
        case 1:
            newEnemies.push(createEnemy('melee', 2, 1, 0));
            newEnemies.push(createEnemy('melee', 2, 1, 1));
            break;
        case 2:
            newEnemies.push(createEnemy('melee', 3, 1.1, 0));
            newEnemies.push(createEnemy('melee', 3, 1.1, 1));
            newEnemies.push(createEnemy('ranged', 1, 1, 4));
            break;
        case 3:
            newEnemies.push(createEnemy('ranged', 2, 1, 0));
            newEnemies.push(createEnemy('ranged', 2, 1, 1));
            newEnemies.push(createEnemy('goblin_archer', 2, 1, 2));
            break;
        case 4:
            newEnemies.push(createEnemy('goblin_archer', 3, 1.1, 0));
            newEnemies.push(createEnemy('goblin_archer', 3, 1.1, 1));
            newEnemies.push(createEnemy('goblin_archer', 3, 1.1, 2));
            newEnemies.push(createEnemy('goblin_archer', 3, 1.1, 3));
            break;
        case 5:
            bosses.push(new Boss(centerBossX, centerBossY, 'dungeon_guardian_1'));
            break;
        case 6:
            newEnemies.push(createEnemy('melee', 4, 1.2, 0));
            newEnemies.push(createEnemy('melee', 4, 1.2, 1));
            newEnemies.push(createEnemy('goblin_archer', 3, 1.1, 2));
            break;
        case 7:
            newEnemies.push(createEnemy('ranged', 3, 1.2, 0));
            newEnemies.push(createEnemy('ranged', 3, 1.2, 1));
            newEnemies.push(createEnemy('ranged', 3, 1.2, 2));
            newEnemies.push(createEnemy('ranged', 3, 1.2, 3));
            break;
        case 8:
            newEnemies.push(createEnemy('goblin_archer', 5, 1.3, 0));
            newEnemies.push(createEnemy('goblin_archer', 5, 1.3, 1));
            newEnemies.push(createEnemy('melee', 5, 1.3, 2));
            newEnemies.push(createEnemy('melee', 5, 1.3, 3));
            break;
        case 9:
            bosses.push(new Boss(centerBossX, centerBossY, 'shadow_guardian'));
            break;
        case 10:
            bosses.push(new Boss(leftBossX, centerBossY, 'overlord'));
            bosses.push(new Boss(rightBossX, centerBossY, 'abyssal_horror'));
            break;
    }
    enemies = newEnemies;
}

function handleArenaWaveCompletion() {
    player.heal(player.maxHp);
    
    currentArenaWave++;
    if (currentArenaWave > TOTAL_ARENA_WAVES) {
        player.addRupees(ARENA_REWARD);
        gameState = GameState.ARENA_COMPLETE;
        screenDisplayTimer = 4000;
        isInArena = false;
    } else {
        gameState = GameState.ARENA_WAVE_TRANSITION;
        arenaTransitionTimer = ARENA_WAVE_TRANSITION_TIME;
    }
}


// --- State-based Update Functions ---

function updateTitleScreen() {
    if ((keysPressed['arrowup'] || keysPressed['w'] || keysPressed['arrowdown'] || keysPressed['s']) && canChangeStateWithKey && saveFileExists) {
        titleMenuSelection = titleMenuSelection === 'newGame' ? 'continue' : 'newGame';
        canChangeStateWithKey = false;
    } else if ((keysPressed['enter'] || keysPressed[' '] || keysPressed['e']) && canChangeStateWithKey) {
        canChangeStateWithKey = false;
        if (titleMenuSelection === 'newGame') {
            startGame();
        } else if (titleMenuSelection === 'continue' && saveFileExists) {
            loadGame();
        }
    }
}

function updateInstructionsScreen() {
    const isAnyKeyPressed = Object.values(keysPressed).some(v => v);
    if (isAnyKeyPressed && canChangeStateWithKey) {
        gameState = GameState.PLAYING;
        canChangeStateWithKey = false;
    }
}

function updateDialog() {
    if ((keysPressed['e'] || keysPressed['enter'] || keysPressed[' ']) && canChangeStateWithKey) {
        canChangeStateWithKey = false;
        currentDialogLineIndex++;
        if (currentDialogLineIndex >= dialogLines.length) {
            // End of dialog
            gameState = GameState.PLAYING;
            if (activeNpc && activeNpc.questId) {
                questManager.handleQuestInteraction(activeNpc.questId, player);
            }
            activeNpc = null;
        }
    }
}

function updateShop() {
    if (canChangeStateWithKey) {
        if (keysPressed['arrowup'] || keysPressed['w']) {
            shopSelectionIndex = (shopSelectionIndex - 1 + shopItems.length) % shopItems.length;
            canChangeStateWithKey = false;
        } else if (keysPressed['arrowdown'] || keysPressed['s']) {
            shopSelectionIndex = (shopSelectionIndex + 1) % shopItems.length;
            canChangeStateWithKey = false;
        } else if (keysPressed['e'] || keysPressed['enter'] || keysPressed[' ']) {
            const item = shopItems[shopSelectionIndex];
            if (item.isAvailable(player) && player.spendRupees(item.price)) {
                item.onPurchase(player);
                // Optionally add a sound effect or success message
            } else {
                // Optionally add a sound effect for failure
            }
            canChangeStateWithKey = false;
        } else if (keysPressed['escape']) {
            gameState = GameState.PLAYING;
            canChangeStateWithKey = false;
        }
    }
}

function updateGameOverScreen(deltaTime) {
    screenDisplayTimer -= deltaTime;
    if (screenDisplayTimer <= 0) {
        gameState = GameState.TITLE;
        saveFileExists = localStorage.getItem(SAVE_KEY) !== null;
        titleMenuSelection = saveFileExists ? 'continue' : 'newGame';
    }
}

function updateGameClearScreen(deltaTime) {
    screenDisplayTimer -= deltaTime;
    if (screenDisplayTimer <= 0) {
        gameState = GameState.TITLE;
    }
}

function updateArenaWaveTransition(deltaTime) {
    arenaTransitionTimer -= deltaTime;
    if (arenaTransitionTimer <= 0) {
        gameState = GameState.PLAYING;
        spawnArenaWave(currentArenaWave);
    }
}

function updateArenaCompleteScreen(deltaTime) {
    screenDisplayTimer -= deltaTime;
    if (screenDisplayTimer <= 0) {
        const loadResult = mapLoadRoom('village_area', player, currentDerivedConstants, undefined, undefined);
        enemies = loadResult.enemies;
        treasureChests = loadResult.chests;
        healingZones = loadResult.healingZones;
        npcs = loadResult.npcs;
        doors = loadResult.doors;
        bosses = loadResult.bosses;
        victoryItem = loadResult.victoryItem || null;
        gameState = GameState.PLAYING;
    }
}


function updateGame(deltaTime) {
    if (!player) return;
    
    if (keysPressed['enter'] || keysPressed[' ']) {
        player.attack();
    }
    
    if (keysPressed['q'] && canChangeStateWithKey) {
        player.usePotion();
        canChangeStateWithKey = false;
    }

    if (keysPressed['e'] && canChangeStateWithKey) {
        canChangeStateWithKey = false;
        for (const npc of npcs) {
            const distance = Math.hypot(player.x - npc.x, player.y - npc.y);
            if (distance < PLAYER_SIZE * 1.5) { // Interaction distance
                activeNpc = npc;
                if (npc.type === 'shop') {
                    shopSelectionIndex = 0;
                    gameState = GameState.SHOP;
                } else if (npc.type === 'arena_entry') {
                    startArenaChallenge();
                } else if (npc.questId) {
                    dialogLines = questManager.getDialog(npc.questId);
                    currentDialogLineIndex = 0;
                    gameState = GameState.DIALOG;
                }
                return; // Stop further updates for this frame
            }
        }
    }


    const roomChangeRequest = player.update(deltaTime);
    
    const isBossActive = bosses.some(b => b.isAlive);
    if (roomChangeRequest && roomChangeRequest.newRoomId && !isBossActive && !isInArena) {
        saveGame();
        const loadResult = mapLoadRoom(roomChangeRequest.newRoomId, player, currentDerivedConstants, roomChangeRequest.entryX, roomChangeRequest.entryY);
        enemies = loadResult.enemies;
        treasureChests = loadResult.chests;
        healingZones = loadResult.healingZones;
        npcs = loadResult.npcs;
        doors = loadResult.doors;
        bosses = loadResult.bosses;
        victoryItem = loadResult.victoryItem || null;
        heartDrops = []; 
        rupeeDrops = [];
        projectiles = [];
    }

    healingZones.forEach(zone => zone.update(deltaTime));
    doors.forEach(door => door.update(bossesDefeatedGlobalState));

    enemies.forEach(enemy => {
        enemy.update(deltaTime, player);
        if (enemy.justFiredProjectile) {
            projectiles.push(enemy.justFiredProjectile);
        }
    });
    
    rupeeDrops.forEach(drop => (drop.pulseTimer += deltaTime));

    bosses.forEach(boss => {
        if (!boss.isDead) {
            const bossProjectiles = boss.update(deltaTime, player);
            projectiles.push(...bossProjectiles);
        }
    });
    
    if (victoryItem) {
        victoryItem.update(deltaTime);
    }

    projectiles.forEach(proj => proj.update(deltaTime)); 
    projectiles = projectiles.filter(proj => proj.isActive);

    checkCollisions();
    heartDrops = heartDrops.filter(drop => !drop.isCollected);
    rupeeDrops = rupeeDrops.filter(drop => !drop.isCollected);
    
    const wasEnemyCount = enemies.length;
    const wasBossCount = bosses.length;

    const aliveEnemies = [];
    for (const enemy of enemies) {
        if (enemy.isAlive) {
            aliveEnemies.push(enemy);
        } else {
            if (enemy.questId) {
                questManager.checkObjective(enemy.questId);
            }
        }
    }
    enemies = aliveEnemies;
    
    if (isInArena && (wasEnemyCount > 0 || wasBossCount > 0) && enemies.length === 0 && bosses.every(b => !b.isAlive)) {
        handleArenaWaveCompletion();
        return;
    }
}

// --- Collision Detection ---
function checkCollisions() {
    if (!player) return;

    // Player vs Enemy
    for (const enemy of enemies) {
        if (enemy.isAlive && !enemy.isKnockedBack &&
            player.x < enemy.x + enemy.width && player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height && player.y + player.height > enemy.y
        ) {
            if (player.takeDamage(1)) {
                handlePlayerDefeat();
                return;
            }
        }
    }

    // Player vs Boss
    bosses.forEach(boss => {
        if (boss.isAlive &&
            player.x < boss.x + boss.width && player.x + player.width > boss.x &&
            player.y < boss.y + boss.height && player.y + player.height > boss.y) {
            let duration;
            if (boss.id === 'shadow_guardian') {
                duration = currentGameConfig.SHADOW_BOSS_INVULNERABILITY_DURATION;
            }
            if (player.takeDamage(1, duration)) {
                handlePlayerDefeat();
                return;
            }
        }
    });

    // Player vs Door
    for (const door of doors) {
        if (door.isOpen &&
            player.x < door.x + door.width && player.x + player.width > door.x &&
            player.y < door.y + door.height && player.y + player.height > door.y
        ) {
            // Room transition via door
            saveGame();
            const loadResult = mapLoadRoom(door.targetRoomId, player, currentDerivedConstants, door.targetPlayerX, door.targetPlayerY);
            enemies = loadResult.enemies;
            treasureChests = loadResult.chests;
            healingZones = loadResult.healingZones;
            npcs = loadResult.npcs;
            doors = loadResult.doors;
            bosses = loadResult.bosses;
            victoryItem = loadResult.victoryItem || null;
            heartDrops = [];
            rupeeDrops = [];
            projectiles = [];
            return; // Exit collision check for this frame
        }
    }


    // Player Attack vs Enemy & Chest & Boss
    if (player.isAttacking && player.attackHitbox) {
        const hitbox = player.attackHitbox;

        // Check attack vs destructible walls
        const firstTileCol = Math.max(0, Math.floor(hitbox.x / currentGameConfig.TILE_SIZE));
        const lastTileCol = Math.min(currentGameConfig.MAP_COLS - 1, Math.floor((hitbox.x + hitbox.width) / currentGameConfig.TILE_SIZE));
        const firstTileRow = Math.max(0, Math.floor(hitbox.y / currentGameConfig.TILE_SIZE));
        const lastTileRow = Math.min(currentGameConfig.MAP_ROWS - 1, Math.floor((hitbox.y + hitbox.height) / currentGameConfig.TILE_SIZE));

        for (let r = firstTileRow; r <= lastTileRow; r++) {
            for (let c = firstTileCol; c <= lastTileCol; c++) {
                if (gameMap[r]?.[c] === TileType.DESTRUCTIBLE_WALL) {
                    gameMap[r][c] = TileType.FLOOR;
                }
            }
        }

        enemies.forEach(enemy => {
            if (enemy.isAlive &&
                hitbox.x < enemy.x + enemy.width && hitbox.x + hitbox.width > enemy.x &&
                hitbox.y < enemy.y + enemy.height && hitbox.y + hitbox.height > enemy.y
            ) {
                const drops = enemy.takeDamage(player.attackPower, player.facingDirection);
                for (const drop of drops) {
                    if (drop instanceof HeartDrop) {
                        heartDrops.push(drop);
                    } else if (drop instanceof RupeeDrop) {
                        rupeeDrops.push(drop);
                    }
                }
            }
        });

        bosses.forEach(boss => {
            if (boss.isAlive &&
                hitbox.x < boss.x + boss.width && hitbox.x + hitbox.width > boss.x &&
                hitbox.y < boss.y + boss.height && hitbox.y + hitbox.height > boss.y
            ) {
                if (boss.takeDamage(player.attackPower)) { // takeDamage returns true if defeated
                    if (!isInArena) {
                        bossesDefeatedGlobalState.add(boss.id);
                        const itemX = boss.x + boss.width / 2;
                        const itemY = boss.y + boss.height / 2;
                        victoryItemGlobalState.set(currentRoomId, { x: itemX, y: itemY });
                        victoryItem = new VictoryItem(itemX, itemY);
                        rupeeDrops.push(new RupeeDrop(itemX, itemY, currentGameConfig.BOSS_RUPEE_DROP_VALUE));
                        saveGame();
                    }
                }
            }
        });


        for (const chest of treasureChests) {
            if (!chest.isOpen &&
                hitbox.x < chest.x + chest.width && hitbox.x + hitbox.width > chest.x &&
                hitbox.y < chest.y + chest.height && hitbox.y + hitbox.height > chest.y
            ) {
                const droppedItem = chest.open(); 
                if (droppedItem) { 
                    if (droppedItem instanceof HeartDrop) {
                        heartDrops.push(droppedItem);
                    } else if (droppedItem instanceof RupeeDrop) {
                        rupeeDrops.push(droppedItem);
                    }
                    openedChestsGlobalState.set(chest.id, true); 
                }
            }
        }
    }

    // Player vs HeartDrop
    for (const drop of heartDrops) {
        if (!drop.isCollected &&
            player.x < drop.x + drop.width && player.x + player.width > drop.x &&
            player.y < drop.y + drop.height && player.y + player.height > drop.y
        ) {
            player.heal(1);
            drop.isCollected = true;
        }
    }
    
    // Player vs RupeeDrop
    for (const drop of rupeeDrops) {
      if (!drop.isCollected &&
          player.x < drop.x + drop.width && player.x + player.width > drop.x &&
          player.y < drop.y + drop.height && player.y + player.height > drop.y
      ) {
          player.addRupees(drop.value);
          drop.isCollected = true;
      }
    }


    // Player vs HealingZone
    for (const zone of healingZones) {
        if (player.x < zone.x + zone.width && player.x + player.width > zone.x &&
            player.y < zone.y + zone.height && player.y + player.height > zone.y) {
            player.heal(player.maxHp); // Heal to full
        }
    }
    
    // Player vs VictoryItem
    if (victoryItem && !victoryItem.isCollected &&
        player.x < victoryItem.x + victoryItem.width && player.x + player.width > victoryItem.x &&
        player.y < victoryItem.y + victoryItem.height && player.y + player.height > victoryItem.y
    ) {
        victoryItem.isCollected = true;
        victoryItemGlobalState.delete(currentRoomId);
        
        const defeatedBoss = bosses.find(b => !b.isAlive);
        if (defeatedBoss && (defeatedBoss.id === 'overlord' || defeatedBoss.id === 'abyssal_horror')) {
             gameState = GameState.GAME_CLEAR;
             screenDisplayTimer = 3000;
        }
       
        saveGame();
    }


    // Player vs Projectile
    for (const projectile of projectiles) {
        if (projectile.isActive &&
            player.x < projectile.x + projectile.width && player.x + player.width > projectile.x &&
            player.y < projectile.y + projectile.height && player.y + player.height > projectile.y
        ) {
            if (!player.isInvulnerable) {
                projectile.isActive = false;
                let duration;
                if (bosses.some(b => b.isAlive && b.id === 'shadow_guardian')) {
                    duration = currentGameConfig.SHADOW_BOSS_INVULNERABILITY_DURATION;
                }
                if (player.takeDamage(1, duration)) {
                    handlePlayerDefeat();
                    return;
                }
            }
        }
    }
}

// --- Draw Functions ---

function drawGame() {
    if (!ctx || !currentGameConfig) return;

    if (gameState === GameState.PLAYING || gameState === GameState.GAME_OVER || gameState === GameState.GAME_CLEAR || gameState === GameState.DIALOG || gameState === GameState.SHOP) {
        drawPlayingScreen();
    }
    
    switch(gameState) {
        case GameState.TITLE:
            drawTitleScreen();
            break;
        case GameState.INSTRUCTIONS:
            drawPlayingScreen(); // Draw the game behind the instructions
            drawInstructionsOverlay();
            break;
        case GameState.DIALOG:
             if (activeNpc && dialogLines[currentDialogLineIndex]) {
                drawDialogBox(ctx, activeNpc.name, dialogLines[currentDialogLineIndex], currentGameConfig, currentDerivedConstants);
            }
            break;
        case GameState.SHOP:
            drawShopMenu(ctx, player, shopItems, shopSelectionIndex, currentGameConfig, currentDerivedConstants);
            break;
        case GameState.GAME_OVER:
            drawGameOverOverlay();
            break;
        case GameState.GAME_CLEAR:
            drawGameClearOverlay();
            break;
        case GameState.ARENA_WAVE_TRANSITION:
            drawPlayingScreen();
            drawArenaTransition(ctx, currentArenaWave, arenaTransitionTimer, currentDerivedConstants);
            break;
        case GameState.ARENA_COMPLETE:
            drawPlayingScreen();
            drawArenaComplete(ctx, ARENA_REWARD, currentDerivedConstants);
            break;
    }
}

function drawPlayingScreen() {
    ctx.fillStyle = currentGameConfig.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, currentDerivedConstants.CANVAS_WIDTH, currentDerivedConstants.CANVAS_HEIGHT);

    mapDrawMap(ctx); 

    healingZones.forEach(zone => zone.draw(ctx));
    treasureChests.forEach(chest => chest.draw(ctx)); 
    doors.forEach(door => door.draw(ctx));
    heartDrops.forEach(drop => drop.draw(ctx));
    rupeeDrops.forEach(drop => drop.draw(ctx));
    victoryItem?.draw(ctx);
    
    npcs.forEach(npc => npc.draw(ctx));
    bosses.forEach(boss => boss.draw(ctx));
    enemies.forEach(enemy => enemy.draw(ctx));
    if (player) player.draw(ctx);

    projectiles.forEach(proj => proj.draw(ctx));
    
    if (player) {
        drawPlayerHP(ctx, player, currentGameConfig);
        drawPlayerRupees(ctx, player, currentGameConfig);
        drawPlayerInventory(ctx, player, currentGameConfig);
        if (!isInArena) {
            drawCurrentRoomName(ctx, currentRoomId, player, currentGameConfig);
        }
    }
    if (bosses.length > 0) {
        drawBossHP(ctx, bosses, currentDerivedConstants);
    }
    if (isInArena && gameState === GameState.PLAYING) {
        drawArenaUI(ctx, currentArenaWave, TOTAL_ARENA_WAVES, currentDerivedConstants);
    }
}

function drawTitleScreen() {
    ctx.fillStyle = currentGameConfig.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, currentDerivedConstants.CANVAS_WIDTH, currentDerivedConstants.CANVAS_HEIGHT);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('小さな勇者', currentDerivedConstants.CANVAS_WIDTH / 2, currentDerivedConstants.CANVAS_HEIGHT / 2 - 80);
    
    ctx.font = '32px sans-serif';

    ctx.fillStyle = titleMenuSelection === 'newGame' ? '#FFFF00' : 'white';
    ctx.fillText(titleMenuSelection === 'newGame' ? '> 新しい冒険' : '新しい冒険', currentDerivedConstants.CANVAS_WIDTH / 2, currentDerivedConstants.CANVAS_HEIGHT / 2 + 20);

    if (saveFileExists) {
        ctx.fillStyle = titleMenuSelection === 'continue' ? '#FFFF00' : 'white';
        ctx.fillText(titleMenuSelection === 'continue' ? '> 冒険の続き' : '冒険の続き', currentDerivedConstants.CANVAS_WIDTH / 2, currentDerivedConstants.CANVAS_HEIGHT / 2 + 70);
    } else {
        ctx.fillStyle = '#555555';
        ctx.fillText('冒険の続き', currentDerivedConstants.CANVAS_WIDTH / 2, currentDerivedConstants.CANVAS_HEIGHT / 2 + 70);
    }
    
    ctx.font = '18px sans-serif';
    ctx.fillStyle = 'white';
    ctx.fillText('矢印キーで選択、E/Enterキーで決定', currentDerivedConstants.CANVAS_WIDTH / 2, currentDerivedConstants.CANVAS_HEIGHT - 30);
}

function drawGameOverOverlay() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, currentDerivedConstants.CANVAS_WIDTH, currentDerivedConstants.CANVAS_HEIGHT);

    ctx.fillStyle = '#FF4444';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ゲームオーバー', currentDerivedConstants.CANVAS_WIDTH / 2, currentDerivedConstants.CANVAS_HEIGHT / 2 - 40);

    ctx.fillStyle = 'white';
    ctx.font = '24px sans-serif';
    ctx.fillText('3秒後にタイトルに戻ります', currentDerivedConstants.CANVAS_WIDTH / 2, currentDerivedConstants.CANVAS_HEIGHT / 2 + 20);
}

function drawGameClearOverlay() {
    ctx.fillStyle = 'rgba(0, 100, 200, 0.7)';
    ctx.fillRect(0, 0, currentDerivedConstants.CANVAS_WIDTH, currentDerivedConstants.CANVAS_HEIGHT);

    ctx.fillStyle = '#FFFF00';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CONGRATULATIONS!', currentDerivedConstants.CANVAS_WIDTH / 2, currentDerivedConstants.CANVAS_HEIGHT / 2 - 40);

    ctx.fillStyle = 'white';
    ctx.font = '24px sans-serif';
    ctx.fillText('3秒後にタイトルに戻ります', currentDerivedConstants.CANVAS_WIDTH / 2, currentDerivedConstants.CANVAS_HEIGHT / 2 + 20);
}

function drawInstructionsOverlay() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, currentDerivedConstants.CANVAS_WIDTH, currentDerivedConstants.CANVAS_HEIGHT);

    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';

    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('操作方法', currentDerivedConstants.CANVAS_WIDTH / 2, currentDerivedConstants.CANVAS_HEIGHT / 2 - 140);

    ctx.font = '22px sans-serif';
    let yPos = currentDerivedConstants.CANVAS_HEIGHT / 2 - 70;
    const lineHeight = 35;

    ctx.textAlign = 'left';
    const xPosKey = currentDerivedConstants.CANVAS_WIDTH / 2 - 160;
    const xPosDesc = xPosKey + 180;


    ctx.fillText('移動', xPosKey, yPos);
    ctx.fillText('矢印キー / W A S D', xPosDesc, yPos);
    yPos += lineHeight;

    ctx.fillText('攻撃', xPosKey, yPos);
    ctx.fillText('スペース / Enter', xPosDesc, yPos);
    yPos += lineHeight;

    ctx.fillText('会話 / 決定', xPosKey, yPos);
    ctx.fillText('E キー', xPosDesc, yPos);
    yPos += lineHeight;

    ctx.fillText('ポーション使用', xPosKey, yPos);
    ctx.fillText('Q キー', xPosDesc, yPos);
    yPos += lineHeight;
    
    yPos += lineHeight * 1.5;
    ctx.textAlign = 'center';
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#FFFF00';
    ctx.fillText('いずれかのキーを押して開始', currentDerivedConstants.CANVAS_WIDTH / 2, yPos);
}