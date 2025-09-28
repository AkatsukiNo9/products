/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
    gameConfig,
    TileType, 
    PLAYER_SIZE, 
    ENEMY_SIZE,
    CHEST_SIZE
} from '../index.js';
import { Enemy } from '../enemy.js';
import { NPC } from '../npc.js';
import { Boss } from '../boss.js';
import { Player } from '../player.js';
import { TreasureChest, VictoryItem, HealingZone, Door } from '../items.js';
import { questState, QuestState } from '../quest.js';

// --- Map State ---
export let rooms = {};
export let currentRoomId;
export let gameMap; // This will be set by loadRoom
export let MAPPED_TILE_COLORS;

// Global state for persistent game objects
export const openedChestsGlobalState = new Map();
export const bossesDefeatedGlobalState = new Set();
export const victoryItemGlobalState = new Map();


export async function initializeMapData(config) {
    MAPPED_TILE_COLORS = {
        [TileType.FLOOR]: config.TILE_COLORS.FLOOR,
        [TileType.WALL]: config.TILE_COLORS.WALL,
        [TileType.DUNGEON_FLOOR]: config.TILE_COLORS.DUNGEON_FLOOR,
        [TileType.DUNGEON_WALL]: config.TILE_COLORS.DUNGEON_WALL,
        [TileType.GRASS]: config.TILE_COLORS.GRASS,
        [TileType.DESTRUCTIBLE_WALL]: config.TILE_COLORS.DESTRUCTIBLE_WALL,
    };

    try {
        const manifestResponse = await fetch('./maps/manifest.json');
        if (!manifestResponse.ok) {
            throw new Error(`Failed to fetch map manifest: ${manifestResponse.statusText}`);
        }
        const manifest = await manifestResponse.json();
        const roomFiles = manifest.rooms;

        const fetchPromises = roomFiles.map(fileName => 
            fetch(`./maps/${fileName}`).then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch room data: ${fileName} - ${res.statusText}`);
                }
                return res.json();
            })
        );

        const loadedRooms = await Promise.all(fetchPromises);

        loadedRooms.forEach(roomData => {
            rooms[roomData.id] = roomData;
        });

        console.log(`${Object.keys(rooms).length} rooms loaded successfully.`);

    } catch (error) {
        console.error("Error loading map data:", error);
        throw error; // Re-throw to be caught by the main initializer
    }
}

// --- Game Management Functions ---
export function loadRoom(roomId, playerInstance, derivedConstants, entryPlayerX, entryPlayerY) {
  if (!gameConfig) {
    console.error("gameConfig not loaded for loadRoom");
    return { enemies: [], chests: [], healingZones: [], npcs: [], doors: [], bosses: [] };
  }
  const roomData = rooms[roomId];
  if (!roomData) { 
    console.error(`Room with id "${roomId}" not found!`); 
    return { enemies: [], chests: [], healingZones: [], npcs: [], doors: [], bosses: [] };
  }
  
  const previousRoomId = currentRoomId;
  console.log(`Loading room: ${roomId} (from ${previousRoomId || 'initial load'})`);
  
  currentRoomId = roomId;
  gameMap = roomData.map; // Set the global gameMap for the current room
  
  const newEnemies = [];
  roomData.enemies.forEach(config => {
    // Only spawn enemies if the associated quest objective is not met
    let shouldSpawn = true;
    if (config.questId && questState[config.questId]) {
        const state = questState[config.questId].state;
        if (state === QuestState.COMPLETED || state === QuestState.REWARD_CLAIMED) {
            shouldSpawn = false;
        }
    }
    
    if (shouldSpawn) {
        const enemyX = config.startX * gameConfig.TILE_SIZE + (gameConfig.TILE_SIZE - ENEMY_SIZE) / 2;
        const enemyY = config.startY * gameConfig.TILE_SIZE + (gameConfig.TILE_SIZE - ENEMY_SIZE) / 2;
        const patrolMinPixelX = config.patrolMinTileX * gameConfig.TILE_SIZE;
        const patrolMaxPixelX = config.patrolMaxTileX * gameConfig.TILE_SIZE;
        newEnemies.push(new Enemy(enemyX, enemyY, patrolMinPixelX, patrolMaxPixelX, config.hp, config.speedMultiplier, config.type, config.questId));
    }
  });

  const newNpcs = [];
  if (roomData.npcs) {
    roomData.npcs.forEach(config => {
      const npcX = config.startX * gameConfig.TILE_SIZE + (gameConfig.TILE_SIZE - PLAYER_SIZE) / 2;
      const npcY = config.startY * gameConfig.TILE_SIZE + (gameConfig.TILE_SIZE - PLAYER_SIZE) / 2;
      newNpcs.push(new NPC(npcX, npcY, config));
    });
  }

  const newChests = [];
  if (roomData.treasureChests) {
    roomData.treasureChests.forEach(config => {
        const chestX = config.startX * gameConfig.TILE_SIZE + (gameConfig.TILE_SIZE - CHEST_SIZE) / 2;
        const chestY = config.startY * gameConfig.TILE_SIZE + (gameConfig.TILE_SIZE - CHEST_SIZE) / 2;
        const chest = new TreasureChest(chestX, chestY, roomId, config.startX, config.startY, config.loot);
        
        if (openedChestsGlobalState.get(chest.id)) {
            chest.isOpen = true;
        }
        newChests.push(chest);
    });
  }

  const newHealingZones = [];
  if (roomData.healingZones) {
    roomData.healingZones.forEach(config => {
      newHealingZones.push(new HealingZone(config.startX, config.startY, config.width, config.height));
    });
  }
  
  const newDoors = [];
    if (roomData.doors) {
        roomData.doors.forEach(config => {
            const door = new Door(config);
            // Initialize door state based on global state
            door.update(bossesDefeatedGlobalState);
            newDoors.push(door);
        });
    }

  const newBosses = [];
  if (roomData.boss && !bossesDefeatedGlobalState.has(roomData.boss.id)) {
      const bossConfig = roomData.boss;
      const bossX = bossConfig.startX * gameConfig.TILE_SIZE + (gameConfig.TILE_SIZE - derivedConstants.BOSS_SIZE) / 2;
      const bossY = bossConfig.startY * gameConfig.TILE_SIZE + (gameConfig.TILE_SIZE - derivedConstants.BOSS_SIZE) / 2;
      newBosses.push(new Boss(bossX, bossY, bossConfig.id));
  }

  let newVictoryItem = undefined;
  if (victoryItemGlobalState.has(roomId)) {
    const itemPos = victoryItemGlobalState.get(roomId);
    newVictoryItem = new VictoryItem(itemPos.x, itemPos.y);
  }


  if (playerInstance) {
    if (entryPlayerX !== undefined && entryPlayerY !== undefined) { 
        playerInstance.setPosition(entryPlayerX, entryPlayerY); 
    } else if (roomData.playerStart) { 
        playerInstance.setPosition(roomData.playerStart.x, roomData.playerStart.y); 
    } else { 
        const fallbackX = gameConfig.MAP_COLS * gameConfig.TILE_SIZE / 2 - PLAYER_SIZE / 2;
        const fallbackY = gameConfig.MAP_ROWS * gameConfig.TILE_SIZE / 2 - PLAYER_SIZE / 2;
        playerInstance.setPosition(fallbackX, fallbackY); 
    }
    playerInstance.isAttacking = false; 
    playerInstance.attackTimer = 0; 
    playerInstance.attackHitbox = null;
  }
  return { enemies: newEnemies, chests: newChests, healingZones: newHealingZones, npcs: newNpcs, doors: newDoors, bosses: newBosses, victoryItem: newVictoryItem };
}

export function drawMap(context) {
  if (!context || !gameMap || !MAPPED_TILE_COLORS || !gameConfig) {
    return;
  }
  for (let r = 0; r < gameConfig.MAP_ROWS; r++) {
    for (let c = 0; c < gameConfig.MAP_COLS; c++) {
      if (gameMap[r] && gameMap[r][c] !== undefined) {
        context.fillStyle = MAPPED_TILE_COLORS[gameMap[r][c]];
        context.fillRect(c * gameConfig.TILE_SIZE, r * gameConfig.TILE_SIZE, gameConfig.TILE_SIZE, gameConfig.TILE_SIZE);
      } else {
        context.fillStyle = '#FF00FF'; 
        context.fillRect(c * gameConfig.TILE_SIZE, r * gameConfig.TILE_SIZE, gameConfig.TILE_SIZE, gameConfig.TILE_SIZE);
      }
    }
  }
}