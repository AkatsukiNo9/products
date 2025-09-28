/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Player, Enemy, HeartDrop are imported by game.js now
// Map related imports are used by game.js, or defineRooms by this file if it initializes map data structures.
// For now, assume map.js handles its own init via defineRooms triggered by game.js or this file.

// --- Tile Types --- (Remains here as it's fundamental)
export const TileType = Object.freeze({
  FLOOR: 0,
  WALL: 1,
  DUNGEON_FLOOR: 2,
  DUNGEON_WALL: 3,
  GRASS: 4,
  DESTRUCTIBLE_WALL: 5,
});

// --- Global Variables for Config and Derived Constants --- (Remain here for export)
export let gameConfig;
// These are calculated here and passed to game.js
export let CANVAS_WIDTH;
export let CANVAS_HEIGHT;
export let PLAYER_SIZE;
export let ENEMY_SIZE;
export let ENEMY_KNOCKBACK_STRENGTH;
export let ENEMY_DETECTION_RANGE;
export let ENEMY_CHASE_STOP_DISTANCE;
export let RANGED_ENEMY_ATTACK_RANGE;
export let GOBLIN_ARCHER_ATTACK_RANGE;
export let ENEMY_PROJECTILE_SIZE;
export let SWORD_SLASH_REACH;
export let SWORD_SLASH_THICKNESS;
export let SWORD_SLASH_OFFSET;
export let HEART_DROP_SIZE;
export let RUPEE_SIZE;
export let CHEST_SIZE;
export let BOSS_SIZE;
export let BOSS_PROJECTILE_SIZE;


// Game state and core loop are now in game.js
import { initializeAndStartGame } from './game.js';


// --- Initialization ---
async function loadConfigAndInit() {
    try {
        const response = await fetch('./game-config.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        gameConfig = await response.json();

        const bossResponse = await fetch('./boss-config.json');
        if (!bossResponse.ok) {
            throw new Error(`HTTP error! status: ${bossResponse.status}`);
        }
        const bossConfigs = await bossResponse.json();

        // Calculate derived constants
        CANVAS_WIDTH = gameConfig.MAP_COLS * gameConfig.TILE_SIZE;
        CANVAS_HEIGHT = gameConfig.MAP_ROWS * gameConfig.TILE_SIZE;
        PLAYER_SIZE = gameConfig.TILE_SIZE * gameConfig.PLAYER_SIZE_FACTOR;
        ENEMY_SIZE = PLAYER_SIZE * gameConfig.ENEMY_SIZE_FACTOR; 
        ENEMY_KNOCKBACK_STRENGTH = gameConfig.TILE_SIZE * gameConfig.ENEMY_KNOCKBACK_STRENGTH_FACTOR;
        ENEMY_DETECTION_RANGE = gameConfig.TILE_SIZE * gameConfig.ENEMY_DETECTION_RANGE_FACTOR;
        ENEMY_CHASE_STOP_DISTANCE = gameConfig.TILE_SIZE * gameConfig.ENEMY_CHASE_STOP_DISTANCE_FACTOR;
        RANGED_ENEMY_ATTACK_RANGE = gameConfig.TILE_SIZE * gameConfig.RANGED_ENEMY_ATTACK_RANGE_FACTOR;
        GOBLIN_ARCHER_ATTACK_RANGE = gameConfig.TILE_SIZE * gameConfig.GOBLIN_ARCHER_ATTACK_RANGE_FACTOR;
        ENEMY_PROJECTILE_SIZE = gameConfig.TILE_SIZE * gameConfig.ENEMY_PROJECTILE_SIZE_FACTOR;
        SWORD_SLASH_REACH = gameConfig.TILE_SIZE * gameConfig.SWORD_SLASH_REACH_FACTOR;
        SWORD_SLASH_THICKNESS = PLAYER_SIZE * gameConfig.SWORD_SLASH_THICKNESS_FACTOR;
        SWORD_SLASH_OFFSET = PLAYER_SIZE * gameConfig.SWORD_SLASH_OFFSET_FACTOR;
        HEART_DROP_SIZE = gameConfig.HEART_SIZE * gameConfig.HEART_DROP_SIZE_FACTOR;
        RUPEE_SIZE = gameConfig.TILE_SIZE * gameConfig.RUPEE_SIZE_FACTOR;
        CHEST_SIZE = gameConfig.TILE_SIZE * gameConfig.CHEST_SIZE_FACTOR;
        BOSS_SIZE = gameConfig.TILE_SIZE * gameConfig.BOSS_SIZE_FACTOR;
        BOSS_PROJECTILE_SIZE = gameConfig.TILE_SIZE * gameConfig.BOSS_PROJECTILE_SIZE_FACTOR;
        
        const derivedConstants = {
            CANVAS_WIDTH,
            CANVAS_HEIGHT,
            PLAYER_SIZE,
            ENEMY_SIZE,
            ENEMY_KNOCKBACK_STRENGTH,
            ENEMY_DETECTION_RANGE,
            ENEMY_CHASE_STOP_DISTANCE,
            RANGED_ENEMY_ATTACK_RANGE,
            GOBLIN_ARCHER_ATTACK_RANGE,
            ENEMY_PROJECTILE_SIZE,
            SWORD_SLASH_REACH,
            SWORD_SLASH_THICKNESS,
            SWORD_SLASH_OFFSET,
            HEART_DROP_SIZE,
            RUPEE_SIZE,
            CHEST_SIZE,
            BOSS_SIZE,
            BOSS_PROJECTILE_SIZE,
        };
        
        // Pass config and derived constants to game.js, now awaiting its async initialization
        await initializeAndStartGame(gameConfig, derivedConstants, bossConfigs);

    } catch (error) {
        console.error("Failed to load game config or initialize game:", error);
        const container = document.querySelector('.container');
        if (container) {
            const errorElement = document.createElement('p');
            errorElement.textContent = 'ゲーム設定の読み込みに失敗しました。時間をおいて再度お試しください。';
            errorElement.style.color = 'white';
            errorElement.style.textAlign = 'center';
            container.innerHTML = ''; 
            container.appendChild(errorElement);
        }
    }
}

document.addEventListener('DOMContentLoaded', loadConfigAndInit);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => console.log('ServiceWorker registration successful with scope: ', registration.scope))
      .catch(error => console.log('ServiceWorker registration failed: ', error));
  });
}