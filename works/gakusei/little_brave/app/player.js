/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  gameConfig,
  PLAYER_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TileType,
  SWORD_SLASH_REACH,
  SWORD_SLASH_THICKNESS,
  SWORD_SLASH_OFFSET,
} from './index.js';
import { keysPressed } from './input.js';
import { 
    gameMap, 
    rooms, 
    currentRoomId,
    openedChestsGlobalState // Import to clear it on respawn
} from './maps/map.js';

export class Player {
  x;
  y;
  width;
  height;
  color;
  speed;
  maxHp;
  currentHp;
  rupees;
  inventory;
  attackPower;
  isInvulnerable;
  invulnerabilityTimer;
  invulnerabilityBlinkTimer;
  isHealing;
  healingEffectTimer;
  HEALING_EFFECT_DURATION = 500;
  facingDirection;
  isAttacking;
  attackTimer;
  attackCooldownTimer;
  attackHitbox;

  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = PLAYER_SIZE;
    this.height = PLAYER_SIZE;
    this.color = gameConfig.PLAYER_COLOR;
    this.speed = gameConfig.PLAYER_SPEED;
    this.maxHp = gameConfig.PLAYER_MAX_HP;
    this.currentHp = gameConfig.PLAYER_MAX_HP;
    this.rupees = 0;
    this.inventory = new Map();
    this.attackPower = 1;
    this.isInvulnerable = false;
    this.invulnerabilityTimer = 0;
    this.invulnerabilityBlinkTimer = 0;
    this.isHealing = false;
    this.healingEffectTimer = 0;
    this.facingDirection = 'down';
    this.isAttacking = false;
    this.attackTimer = 0;
    this.attackCooldownTimer = 0;
    this.attackHitbox = null;
  }

  draw(context) {
    let draw = true;
    let colorOverride = null;
    
    if (this.isInvulnerable) {
      this.invulnerabilityBlinkTimer += 16;
      if (Math.floor(this.invulnerabilityBlinkTimer / gameConfig.INVULNERABILITY_BLINK_INTERVAL) % 2 === 0) {
        draw = false;
      }
    } else if (this.isHealing) {
      if (Math.floor(this.healingEffectTimer / (gameConfig.INVULNERABILITY_BLINK_INTERVAL * 0.7)) % 2 !== 0) {
        colorOverride = gameConfig.PLAYER_HEAL_COLOR;
      }
    }

    if (draw) {
      context.fillStyle = colorOverride || this.color;
      context.fillRect(this.x, this.y, this.width, this.height);
    }

    if (this.isAttacking && this.attackHitbox) {
      context.fillStyle = gameConfig.SWORD_SLASH_COLOR;
      context.fillRect(this.attackHitbox.x, this.attackHitbox.y, this.attackHitbox.width, this.attackHitbox.height);
    }
  }

  isCollidingWithWall(checkX, checkY) {
    const entityLeft = checkX;
    const entityRight = checkX + this.width;
    const entityTop = checkY;
    const entityBottom = checkY + this.height;

    const firstTileCol = Math.floor(entityLeft / gameConfig.TILE_SIZE);
    const lastTileCol = Math.floor((entityRight - 1) / gameConfig.TILE_SIZE);
    const firstTileRow = Math.floor(entityTop / gameConfig.TILE_SIZE);
    const lastTileRow = Math.floor((entityBottom - 1) / gameConfig.TILE_SIZE);

    for (let r = firstTileRow; r <= lastTileRow; r++) {
      for (let c = firstTileCol; c <= lastTileCol; c++) {
        if (r < 0 || r >= gameConfig.MAP_ROWS || c < 0 || c >= gameConfig.MAP_COLS) {
            return true; // Collision with map boundaries (out of bounds)
        }
        if (gameMap[r] && (gameMap[r][c] === TileType.WALL || gameMap[r][c] === TileType.DUNGEON_WALL || gameMap[r][c] === TileType.DESTRUCTIBLE_WALL)) {
          // Check for actual overlap more precisely if needed, but tile-based is often enough
          // For simplicity, if any part of the entity overlaps a wall tile, it's a collision.
          const wallLeft = c * gameConfig.TILE_SIZE;
          const wallRight = wallLeft + gameConfig.TILE_SIZE;
          const wallTop = r * gameConfig.TILE_SIZE;
          const wallBottom = wallTop + gameConfig.TILE_SIZE;
          if (entityRight > wallLeft && entityLeft < wallRight && entityBottom > wallTop && entityTop < wallBottom) {
             return true;
          }
        }
      }
    }
    return false;
  }

  attack() {
    if (this.attackCooldownTimer > 0 || this.isAttacking) return;

    this.isAttacking = true;
    this.attackTimer = gameConfig.PLAYER_ATTACK_DURATION;
    this.attackCooldownTimer = gameConfig.PLAYER_ATTACK_COOLDOWN;

    let hx, hy, hw, hh;
    const pCenterX = this.x + this.width / 2;
    const pCenterY = this.y + this.height / 2;

    switch (this.facingDirection) {
      case 'up':
        hw = SWORD_SLASH_THICKNESS; hh = SWORD_SLASH_REACH;
        hx = pCenterX - hw / 2; hy = this.y - hh + SWORD_SLASH_OFFSET;
        break;
      case 'down':
        hw = SWORD_SLASH_THICKNESS; hh = SWORD_SLASH_REACH;
        hx = pCenterX - hw / 2; hy = this.y + this.height - SWORD_SLASH_OFFSET;
        break;
      case 'left':
        hw = SWORD_SLASH_REACH; hh = SWORD_SLASH_THICKNESS;
        hx = this.x - hw + SWORD_SLASH_OFFSET; hy = pCenterY - hh / 2;
        break;
      case 'right':
        hw = SWORD_SLASH_REACH; hh = SWORD_SLASH_THICKNESS;
        hx = this.x + this.width - SWORD_SLASH_OFFSET; hy = pCenterY - hh / 2;
        break;
    }
    this.attackHitbox = { x: hx, y: hy, width: hw, height: hh };
  }

  update(deltaTime) {
    const oldX = this.x;
    const oldY = this.y;
    let targetDx = 0;
    let targetDy = 0;

    if (keysPressed['arrowup'] || keysPressed['w']) { targetDy -= this.speed; this.facingDirection = 'up'; }
    if (keysPressed['arrowdown'] || keysPressed['s']) { targetDy += this.speed; this.facingDirection = 'down'; }
    if (keysPressed['arrowleft'] || keysPressed['a']) { targetDx -= this.speed; this.facingDirection = 'left'; }
    if (keysPressed['arrowright'] || keysPressed['d']) { targetDx += this.speed; this.facingDirection = 'right'; }

    if (targetDx !== 0 && targetDy !== 0) {
      const length = Math.sqrt(targetDx * targetDx + targetDy * targetDy);
      targetDx = (targetDx / length) * this.speed;
      targetDy = (targetDy / length) * this.speed;
    }
    
    // X-axis movement and collision
    let newX = this.x + targetDx;
    if (targetDx !== 0) {
      if (!this.isCollidingWithWall(newX, this.y)) {
        this.x = newX;
      } else {
        if (targetDx > 0) { // Moving right, hit a wall to the right
          const wallTileCol = Math.floor((newX + this.width) / gameConfig.TILE_SIZE);
          this.x = wallTileCol * gameConfig.TILE_SIZE - this.width;
        } else { // Moving left, hit a wall to the left
          const wallTileCol = Math.floor(newX / gameConfig.TILE_SIZE);
          this.x = (wallTileCol + 1) * gameConfig.TILE_SIZE;
        }
      }
    }

    // Y-axis movement and collision
    let newY = this.y + targetDy;
    if (targetDy !== 0) {
      // Use the potentially corrected this.x from X-axis collision handling
      if (!this.isCollidingWithWall(this.x, newY)) {
        this.y = newY;
      } else {
        if (targetDy > 0) { // Moving down, hit a wall below
          const wallTileRow = Math.floor((newY + this.height) / gameConfig.TILE_SIZE);
          this.y = wallTileRow * gameConfig.TILE_SIZE - this.height;
        } else { // Moving up, hit a wall above
          const wallTileRow = Math.floor(newY / gameConfig.TILE_SIZE);
          this.y = (wallTileRow + 1) * gameConfig.TILE_SIZE;
        }
      }
    }
    
    // Final boundary checks
    this.x = Math.max(0, Math.min(this.x, CANVAS_WIDTH - this.width));
    this.y = Math.max(0, Math.min(this.y, CANVAS_HEIGHT - this.height));

    // Check for room transitions (after collision adjustments)
    const currentRoomData = rooms[currentRoomId];
    if (!currentRoomData) return null;

    let roomChangeRequest = null;
    let exit;

    if (targetDx > 0 && this.x + this.width >= CANVAS_WIDTH && oldX < CANVAS_WIDTH - this.width) {
        exit = currentRoomData.exits.right;
        if (exit) {
            const entryX = exit.targetPlayerX ?? (PLAYER_SIZE * 0.5);
            const entryY = exit.targetPlayerY ?? this.y;
            roomChangeRequest = { newRoomId: exit.targetRoomId, entryX, entryY };
        }
    } else if (targetDx < 0 && this.x <= 0 && oldX > 0) {
        exit = currentRoomData.exits.left;
        if (exit) {
            const entryX = exit.targetPlayerX ?? (CANVAS_WIDTH - this.width - PLAYER_SIZE * 0.5);
            const entryY = exit.targetPlayerY ?? this.y;
            roomChangeRequest = { newRoomId: exit.targetRoomId, entryX, entryY };
        }
    } else if (targetDy > 0 && this.y + this.height >= CANVAS_HEIGHT && oldY < CANVAS_HEIGHT - this.height) {
        exit = currentRoomData.exits.bottom;
        if (exit) {
            const entryX = exit.targetPlayerX ?? this.x;
            const entryY = exit.targetPlayerY ?? (PLAYER_SIZE * 0.5);
            roomChangeRequest = { newRoomId: exit.targetRoomId, entryX, entryY };
        }
    } else if (targetDy < 0 && this.y <= 0 && oldY > 0) {
        exit = currentRoomData.exits.top;
        if (exit) {
            const entryX = exit.targetPlayerX ?? this.x;
            const entryY = exit.targetPlayerY ?? (CANVAS_HEIGHT - this.height - PLAYER_SIZE * 0.5);
            roomChangeRequest = { newRoomId: exit.targetRoomId, entryX, entryY };
        }
    }
    
    if (roomChangeRequest) {
        return roomChangeRequest;
    }


    if (this.isInvulnerable) {
      this.invulnerabilityTimer -= deltaTime;
      if (this.invulnerabilityTimer <= 0) { this.isInvulnerable = false; this.invulnerabilityTimer = 0; this.invulnerabilityBlinkTimer = 0; }
    }
    if (this.isHealing) {
      this.healingEffectTimer -= deltaTime;
      if (this.healingEffectTimer <= 0) {
        this.isHealing = false;
        this.healingEffectTimer = 0;
      }
    }
    if (this.attackCooldownTimer > 0) { this.attackCooldownTimer -= deltaTime; }
    if (this.isAttacking) {
      this.attackTimer -= deltaTime;
      if (this.attackTimer <= 0) { this.isAttacking = false; this.attackHitbox = null; }
    }
    return null; 
  }

  takeDamage(amount, invulnerabilityDuration) {
    if (this.isInvulnerable) return false;
    this.currentHp -= amount;
    console.log(`Player took ${amount} damage. HP: ${this.currentHp}/${this.maxHp}`);
    if (this.currentHp <= 0) {
      this.currentHp = 0;
      return true; // Player is defeated
    } else {
      this.isInvulnerable = true;
      this.invulnerabilityTimer = invulnerabilityDuration ?? gameConfig.PLAYER_INVULNERABILITY_DURATION;
      this.invulnerabilityBlinkTimer = 0;
    }
    return false; // Player is not defeated
  }

  heal(amount) {
    if (this.currentHp >= this.maxHp) return false;
    
    const prevHp = this.currentHp;
    this.currentHp += amount;
    this.currentHp = Math.min(this.currentHp, this.maxHp);

    if (this.currentHp > prevHp) {
      console.log(`Player healed. Current HP: ${this.currentHp}/${this.maxHp}`);
      this.isHealing = true;
      this.healingEffectTimer = this.HEALING_EFFECT_DURATION;
      return true;
    }
    return false;
  }
  
  addRupees(amount) {
    this.rupees += amount;
    console.log(`Player collected ${amount} rupees. Total: ${this.rupees}`);
  }

  spendRupees(amount) {
    if (this.rupees >= amount) {
      this.rupees -= amount;
      console.log(`Player spent ${amount} rupees. Remaining: ${this.rupees}`);
      return true;
    }
    console.log(`Player tried to spend ${amount} rupees, but only has ${this.rupees}.`);
    return false;
  }

  addItem(itemId, quantity) {
    const currentQuantity = this.inventory.get(itemId) || 0;
    this.inventory.set(itemId, currentQuantity + quantity);
    console.log(`Added ${quantity} of ${itemId}. Total: ${this.inventory.get(itemId)}`);
  }

  usePotion() {
    const potionCount = this.inventory.get('potion') || 0;
    if (potionCount > 0 && this.currentHp < this.maxHp) {
      this.heal(this.maxHp); // Heal to full
      this.inventory.set('potion', potionCount - 1);
      console.log(`Used a potion. ${this.inventory.get('potion')} remaining.`);
      return true;
    }
    if (potionCount <= 0) console.log("No potions to use.");
    if (this.currentHp >= this.maxHp) console.log("HP is already full.");
    return false;
  }

  increaseMaxHp(amount) {
    this.maxHp += amount;
    this.heal(amount); // Also heal the player to fill the new heart
    console.log(`Player max HP increased to ${this.maxHp}`);
  }

  increaseAttackPower(amount) {
    this.attackPower += amount;
    console.log(`Player attack power increased to ${this.attackPower}`);
  }

  respawn() { 
    console.log("Player respawned! All treasure chests will be reset.");
    this.currentHp = this.maxHp;
    this.inventory.clear();
    
    // Clear the global state of opened chests
    // Note: This is now handled in game.js's startGame() function
    // to separate concerns between player state reset and global game state reset.

    let respawnX; 
    let respawnY;
    const initialRoomData = rooms[gameConfig.INITIAL_ROOM_ID]; 

    if (initialRoomData && initialRoomData.playerStart) {
      respawnX = initialRoomData.playerStart.x; 
      respawnY = initialRoomData.playerStart.y;
    } else {
      respawnX = 1 * gameConfig.TILE_SIZE + (gameConfig.TILE_SIZE - PLAYER_SIZE) / 2;
      respawnY = 1 * gameConfig.TILE_SIZE + (gameConfig.TILE_SIZE - PLAYER_SIZE) / 2;
      console.warn("Fallback respawn coordinates used for player.");
    }
    
    this.isInvulnerable = true; 
    this.invulnerabilityTimer = gameConfig.PLAYER_INVULNERABILITY_DURATION / 2; 
    this.invulnerabilityBlinkTimer = 0;
    this.isAttacking = false; 
    this.attackTimer = 0; 
    this.attackHitbox = null;

    return { newRoomId: gameConfig.INITIAL_ROOM_ID, entryX: respawnX, entryY: respawnY };
  }

  setPosition(x, y) {
    this.x = x; this.y = y;
    this.x = Math.max(0, Math.min(this.x, CANVAS_WIDTH - this.width));
    this.y = Math.max(0, Math.min(this.y, CANVAS_HEIGHT - this.height));
  }
}