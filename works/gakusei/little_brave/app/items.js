/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  gameConfig,
  HEART_DROP_SIZE,
  RUPEE_SIZE,
  CHEST_SIZE, 
  TileType,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from './index.js';
import { drawHeartForHP } from './ui.js';
import { gameMap } from './maps/map.js'; // For projectile wall collision

export class HeartDrop {
  x;
  y;
  width;
  height;
  size;
  isCollected;

  constructor(centerX, centerY) {
    this.size = HEART_DROP_SIZE;
    this.width = this.size;
    this.height = this.size;
    this.x = centerX - this.width / 2;
    this.y = centerY - this.height / 2;
    this.isCollected = false;
  }

  draw(context) {
    if (this.isCollected) return;

    context.save();
    context.fillStyle = gameConfig.HEART_COLOR_FULL;
    context.strokeStyle = gameConfig.HEART_COLOR_STROKE;
    context.lineWidth = Math.max(1, this.size / 16);
    
    drawHeartForHP(context, this.x, this.y, this.size); 
    context.fill();
    context.stroke();
    context.restore();
  }
}

export class RupeeDrop {
  x;
  y;
  width;
  height;
  value;
  isCollected;
  pulseTimer;

  constructor(centerX, centerY, value) {
    this.width = RUPEE_SIZE;
    this.height = RUPEE_SIZE;
    this.x = centerX - this.width / 2;
    this.y = centerY - this.height / 2;
    this.value = value;
    this.isCollected = false;
    this.pulseTimer = Math.random() * 1000;
  }

  draw(context) {
    if (this.isCollected) return;

    context.save();
    const scale = 1 + Math.sin(this.pulseTimer / 200) * 0.1;
    const size = this.width * scale;
    const x = this.x - (size - this.width) / 2;
    const y = this.y - (size - this.height) / 2;
    
    context.fillStyle = gameConfig.RUPEE_COLOR;
    context.strokeStyle = 'rgba(0,0,0,0.5)';
    context.lineWidth = 2;
    
    context.beginPath();
    context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    
    context.restore();
  }
}

export class TreasureChest {
  id; // Unique identifier for the chest, e.g., "roomId_tileX_tileY"
  x;
  y;
  width;
  height;
  isOpen;
  tileX; // Original tile X for ID generation
  tileY; // Original tile Y for ID generation
  roomId; // Room ID for ID generation
  loot;

  constructor(x, y, roomId, tileX, tileY, loot) {
    this.x = x;
    this.y = y;
    this.width = CHEST_SIZE;
    this.height = CHEST_SIZE;
    this.isOpen = false;
    this.roomId = roomId;
    this.tileX = tileX;
    this.tileY = tileY;
    this.id = `${roomId}_${tileX}_${tileY}`;
    this.loot = loot || { type: 'heart', value: 1 }; // Default to one heart
  }

  draw(context) {
    context.fillStyle = this.isOpen ? gameConfig.CHEST_COLOR_OPEN : gameConfig.CHEST_COLOR_CLOSED;
    context.fillRect(this.x, this.y, this.width, this.height);
    
    context.strokeStyle = '#000000'; 
    context.lineWidth = 1;
    context.strokeRect(this.x, this.y, this.width, this.height);
  }

  open() {
    if (this.isOpen) {
      return null;
    }
    this.isOpen = true;
    const itemCenterX = this.x + this.width / 2;
    const itemCenterY = this.y - HEART_DROP_SIZE / 2; 
    
    console.log(`Chest ${this.id} opened at (${this.x}, ${this.y}), spawning ${this.loot.type}.`);
    
    if (this.loot.type === 'rupees') {
      return new RupeeDrop(itemCenterX, itemCenterY, this.loot.value);
    } 
    // Default to heart
    return new HeartDrop(itemCenterX, itemCenterY);
  }
}

export class HealingZone {
  x;
  y;
  width;
  height;
  pulseTimer;

  constructor(tileX, tileY, tileWidth, tileHeight) {
    this.x = tileX * gameConfig.TILE_SIZE;
    this.y = tileY * gameConfig.TILE_SIZE;
    this.width = tileWidth * gameConfig.TILE_SIZE;
    this.height = tileHeight * gameConfig.TILE_SIZE;
    this.pulseTimer = 0;
  }

  update(deltaTime) {
    this.pulseTimer += deltaTime;
  }

  draw(context) {
    context.save();
    
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    
    // Outer pulsing circle
    const outerRadius = (this.width / 2) * (1 + Math.sin(this.pulseTimer / 500) * 0.1);
    const outerGradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius);
    outerGradient.addColorStop(0, gameConfig.HEALING_ZONE_COLOR_SECONDARY);
    outerGradient.addColorStop(1, 'rgba(173, 216, 230, 0)');
    context.fillStyle = outerGradient;
    context.beginPath();
    context.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    context.fill();

    // Inner static circle
    const innerRadius = this.width / 3;
    const innerGradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, innerRadius);
    innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    innerGradient.addColorStop(1, gameConfig.HEALING_ZONE_COLOR_PRIMARY);
    context.fillStyle = innerGradient;
    context.beginPath();
    context.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    context.fill();
    
    context.restore();
  }
}

export class EnemyProjectile {
  x;
  y;
  width;
  height;
  dx;
  dy;
  speed;
  color;
  isActive;

  constructor(startX, startY, targetX, targetY, speed, color, size) {
    this.width = size;
    this.height = size;
    this.x = startX - this.width / 2;
    this.y = startY - this.height / 2;
    this.speed = speed;
    this.color = color;
    this.isActive = true;

    const diffX = targetX - startX;
    const diffY = targetY - startY;
    const distance = Math.sqrt(diffX * diffX + diffY * diffY);

    if (distance === 0) {
      this.dx = 0;
      this.dy = -this.speed; // Default upward if target is same as start
    } else {
      this.dx = (diffX / distance) * this.speed;
      this.dy = (diffY / distance) * this.speed;
    }
  }

  isCollidingWithWall(checkX, checkY) {
    const entityLeft = checkX;
    const entityRight = checkX + this.width;
    const entityTop = checkY;
    const entityBottom = checkY + this.height;

    // Check one point for simplicity, e.g., center. For more accuracy, check corners.
    const checkTileX = Math.floor((entityLeft + this.width / 2) / gameConfig.TILE_SIZE);
    const checkTileY = Math.floor((entityTop + this.height / 2) / gameConfig.TILE_SIZE);
    
    if (!gameMap || !gameMap[checkTileY] || gameMap[checkTileY][checkTileX] === undefined) {
      return true; // Treat out-of-bounds map access as collision
    }

    const tile = gameMap[checkTileY][checkTileX];
    if (tile === TileType.WALL || tile === TileType.DUNGEON_WALL) {
        // More precise check if needed, but for small projectiles, center check is often okay
        const wallLeft = checkTileX * gameConfig.TILE_SIZE;
        const wallRight = wallLeft + gameConfig.TILE_SIZE;
        const wallTop = checkTileY * gameConfig.TILE_SIZE;
        const wallBottom = wallTop + gameConfig.TILE_SIZE;
        if (entityRight > wallLeft && entityLeft < wallRight && entityBottom > wallTop && entityTop < wallBottom) {
           return true;
        }
    }
    return false;
  }

  update(_deltaTime) {
    if (!this.isActive) return;

    const nextX = this.x + this.dx;
    const nextY = this.y + this.dy;

    // Boundary checks
    if (nextX < 0 || nextX + this.width > CANVAS_WIDTH || nextY < 0 || nextY + this.height > CANVAS_HEIGHT) {
      this.isActive = false;
      return;
    }

    // Wall collision check
    if (this.isCollidingWithWall(nextX, nextY)) {
      this.isActive = false;
      return;
    }

    this.x = nextX;
    this.y = nextY;
  }

  draw(context) {
    if (!this.isActive) return;
    context.fillStyle = this.color;
    context.fillRect(this.x, this.y, this.width, this.height);
  }
}

export class VictoryItem {
  x;
  y;
  width;
  height;
  isCollected;
  pulseTimer;

  constructor(centerX, centerY) {
    this.width = gameConfig.TILE_SIZE * 1.5;
    this.height = gameConfig.TILE_SIZE * 1.5;
    this.x = centerX - this.width / 2;
    this.y = centerY - this.height / 2;
    this.isCollected = false;
    this.pulseTimer = 0;
  }

  update(deltaTime) {
    this.pulseTimer += deltaTime;
  }

  draw(context) {
    if (this.isCollected) return;
    context.save();
    
    const scale = 1 + Math.sin(this.pulseTimer / 300) * 0.05;
    const size = this.width * scale;
    const x = this.x - (size - this.width) / 2;
    const y = this.y - (size - this.height) / 2;

    context.fillStyle = '#FFD700';
    context.strokeStyle = 'white';
    context.lineWidth = 3;
    
    // Simple triangle
    context.beginPath();
    context.moveTo(x + size / 2, y); // Top point
    context.lineTo(x, y + size);     // Bottom-left
    context.lineTo(x + size, y + size); // Bottom-right
    context.closePath();
    
    context.fill();
    context.stroke();
    
    context.restore();
  }
}

export class Door {
  x;
  y;
  width;
  height;
  isOpen;
  targetRoomId;
  targetPlayerX;
  targetPlayerY;
  condition;

  constructor(config) {
    this.width = gameConfig.TILE_SIZE;
    this.height = gameConfig.TILE_SIZE * 1.5; // Slightly taller than one tile
    this.x = config.startX * gameConfig.TILE_SIZE;
    this.y = config.startY * gameConfig.TILE_SIZE;
    this.isOpen = false;
    this.targetRoomId = config.targetRoomId;
    this.targetPlayerX = config.targetPlayerX;
    this.targetPlayerY = config.targetPlayerY;
    this.condition = config.condition;
  }

  update(bossesDefeated) {
    if (!this.isOpen && this.condition.type === 'boss_defeated' && bossesDefeated.has(this.condition.id)) {
      this.isOpen = true;
      console.log('A secret door has opened!');
    }
  }

  draw(context) {
    // Draw the door frame
    context.fillStyle = '#654321'; // Dark brown
    context.fillRect(this.x, this.y, this.width, this.height);
    
    if (this.isOpen) {
      // Draw the open doorway (dark inside)
      context.fillStyle = 'black';
      context.fillRect(this.x + 4, this.y + 4, this.width - 8, this.height - 8);
    } else {
      // Draw the closed door with details
      context.fillStyle = '#8B4513'; // SaddleBrown
      context.fillRect(this.x + 2, this.y + 2, this.width - 4, this.height - 4);
      
      // Door knob
      context.fillStyle = '#FFD700'; // Gold
      context.beginPath();
      context.arc(this.x + this.width * 0.75, this.y + this.height / 2, 3, 0, Math.PI * 2);
      context.fill();
    }
  }
}