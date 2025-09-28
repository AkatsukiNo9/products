/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  gameConfig,
  ENEMY_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TileType,
  ENEMY_KNOCKBACK_STRENGTH,
  ENEMY_DETECTION_RANGE,
  ENEMY_CHASE_STOP_DISTANCE,
  RANGED_ENEMY_ATTACK_RANGE,
  GOBLIN_ARCHER_ATTACK_RANGE,
  ENEMY_PROJECTILE_SIZE,
} from './index.js';
import { gameMap } from './maps/map.js'; 
import { HeartDrop, EnemyProjectile, RupeeDrop } from './items.js';

export class Enemy {
  x; y; width; height;
  color; originalColor; speed; hp;
  isAlive; isHit; hitTimer; attackInvulnerabilityTimer;
  isKnockedBack; knockbackTimer; knockbackDx; knockbackDy;
  type;
  questId;
  rangedAttackCooldownTimer;
  justFiredProjectile;
  postShotRetreatTimer;
  POST_SHOT_RETREAT_DURATION = 200; // ms

  constructor(x, y, _patrolMinX, _patrolMaxX, initialHp, speedMultiplier, type, questId) {
    this.x = x; this.y = y; this.width = ENEMY_SIZE; this.height = ENEMY_SIZE;
    this.type = type || 'melee';
    this.questId = questId;
    this.postShotRetreatTimer = 0;
    
    if (this.type === 'ranged') {
      this.originalColor = gameConfig.RANGED_ENEMY_COLOR;
      this.speed = gameConfig.ENEMY_SPEED * (speedMultiplier || gameConfig.RANGED_ENEMY_SPEED_MULTIPLIER);
      this.hp = initialHp || gameConfig.RANGED_ENEMY_DEFAULT_HP;
    } else if (this.type === 'goblin_archer') {
      this.originalColor = gameConfig.GOBLIN_ARCHER_COLOR;
      this.speed = gameConfig.ENEMY_SPEED * (speedMultiplier || gameConfig.GOBLIN_ARCHER_SPEED_MULTIPLIER);
      this.hp = initialHp || gameConfig.GOBLIN_ARCHER_DEFAULT_HP;
    } else { // melee
      this.originalColor = gameConfig.ENEMY_COLOR;
      this.speed = gameConfig.ENEMY_SPEED * (speedMultiplier || 1);
      this.hp = initialHp || gameConfig.ENEMY_DEFAULT_HP;
    }
    this.color = this.originalColor;
    
    this.isAlive = true; this.isHit = false; this.hitTimer = 0; this.attackInvulnerabilityTimer = 0;
    this.isKnockedBack = false; this.knockbackTimer = 0; this.knockbackDx = 0; this.knockbackDy = 0;
    this.rangedAttackCooldownTimer = 0;
    this.justFiredProjectile = null;
  }

  draw(context) {
    if (!this.isAlive) return;
    context.fillStyle = this.isHit ? gameConfig.ENEMY_HIT_COLOR : this.color;
    context.fillRect(this.x, this.y, this.width, this.height);
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
    
    if (!gameMap) return true; 

    for (let r = firstTileRow; r <= lastTileRow; r++) {
      for (let c = firstTileCol; c <= lastTileCol; c++) {
        if (r < 0 || r >= gameConfig.MAP_ROWS || c < 0 || c >= gameConfig.MAP_COLS) return true; 
        if (gameMap[r] && (gameMap[r][c] === TileType.WALL || gameMap[r][c] === TileType.DUNGEON_WALL)) {
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

  takeDamage(amount, playerDirection) {
    if (!this.isAlive || this.attackInvulnerabilityTimer > 0) return [];
    this.hp -= amount;
    this.isHit = true; this.hitTimer = gameConfig.ENEMY_HIT_DURATION;
    this.attackInvulnerabilityTimer = gameConfig.ENEMY_ATTACK_INVULNERABILITY_DURATION;

    if (!this.isKnockedBack && playerDirection) {
      this.isKnockedBack = true; this.knockbackTimer = gameConfig.ENEMY_KNOCKBACK_DURATION;
      this.knockbackDx = 0; this.knockbackDy = 0;
      switch (playerDirection) {
        case 'up': this.knockbackDy = -ENEMY_KNOCKBACK_STRENGTH; break;
        case 'down': this.knockbackDy = ENEMY_KNOCKBACK_STRENGTH; break;
        case 'left': this.knockbackDx = -ENEMY_KNOCKBACK_STRENGTH; break;
        case 'right': this.knockbackDx = ENEMY_KNOCKBACK_STRENGTH; break;
      }
    }

    if (this.hp <= 0) {
      this.isAlive = false;
      console.log(`Enemy (${this.type}) defeated!`);
      const drops = [];
      const dropX = this.x + this.width / 2;
      const dropY = this.y + this.height / 2;

      // Heart drop
      if (Math.random() < gameConfig.HEART_DROP_CHANCE) {
        drops.push(new HeartDrop(dropX, dropY));
      }

      // Rupee drop
      if (Math.random() < gameConfig.RUPEE_DROP_CHANCE) {
        const value = Math.floor(Math.random() * (gameConfig.RUPEE_DROP_VALUE_MAX - gameConfig.RUPEE_DROP_VALUE_MIN + 1)) + gameConfig.RUPEE_DROP_VALUE_MIN;
        drops.push(new RupeeDrop(dropX + (Math.random() * 10 - 5), dropY + (Math.random() * 10 - 5), value));
      }

      return drops;
    }
    return [];
  }

  update(deltaTime, playerData) {
    if (!this.isAlive || !playerData || !gameConfig) return; 
    
    this.justFiredProjectile = null; // Reset at the start of each update

    if (this.hitTimer > 0) { this.hitTimer -= deltaTime; if (this.hitTimer <= 0) this.isHit = false; }
    if (this.attackInvulnerabilityTimer > 0) { this.attackInvulnerabilityTimer -= deltaTime; }
    if (this.rangedAttackCooldownTimer > 0) { this.rangedAttackCooldownTimer -= deltaTime; }
    if (this.postShotRetreatTimer > 0) { this.postShotRetreatTimer -= deltaTime; }


    if (this.isKnockedBack) {
      this.knockbackTimer -= deltaTime;
      if (this.knockbackTimer <= 0) { this.isKnockedBack = false; this.knockbackDx = 0; this.knockbackDy = 0; }
      else {
        const knockbackSpeedFactor = ENEMY_KNOCKBACK_STRENGTH / gameConfig.TILE_SIZE; 
        let moveX = 0;
        let moveY = 0;

        if (this.knockbackDx < 0) moveX = -knockbackSpeedFactor * this.speed;
        else if (this.knockbackDx > 0) moveX = knockbackSpeedFactor * this.speed;
        
        if (this.knockbackDy < 0) moveY = -knockbackSpeedFactor * this.speed;
        else if (this.knockbackDy > 0) moveY = knockbackSpeedFactor * this.speed;
        
        let newKnockbackX = this.x + moveX;
        if (moveX !== 0) {
            if (!this.isCollidingWithWall(newKnockbackX, this.y)) {
                this.x = newKnockbackX;
            } else {
                if (moveX > 0) { 
                    const wallTileCol = Math.floor((newKnockbackX + this.width) / gameConfig.TILE_SIZE);
                    this.x = wallTileCol * gameConfig.TILE_SIZE - this.width;
                } else { 
                    const wallTileCol = Math.floor(newKnockbackX / gameConfig.TILE_SIZE);
                    this.x = (wallTileCol + 1) * gameConfig.TILE_SIZE;
                }
                this.knockbackDx = 0; 
            }
        }

        let newKnockbackY = this.y + moveY;
        if (moveY !== 0) {
            if (!this.isCollidingWithWall(this.x, newKnockbackY)) { 
                this.y = newKnockbackY;
            } else {
                if (moveY > 0) { 
                    const wallTileRow = Math.floor((newKnockbackY + this.height) / gameConfig.TILE_SIZE);
                    this.y = wallTileRow * gameConfig.TILE_SIZE - this.height;
                } else { 
                    const wallTileRow = Math.floor(newKnockbackY / gameConfig.TILE_SIZE);
                    this.y = (wallTileRow + 1) * gameConfig.TILE_SIZE;
                }
                this.knockbackDy = 0; 
            }
        }
        
        if (this.knockbackDx === 0 && this.knockbackDy === 0) this.isKnockedBack = false;

        this.x = Math.max(0, Math.min(this.x, CANVAS_WIDTH - this.width));
        this.y = Math.max(0, Math.min(this.y, CANVAS_HEIGHT - this.height));
        return;
      }
    }
    
    if (this.type === 'goblin_archer' && this.postShotRetreatTimer > 0) {
        const retreatDiffX = this.x - playerData.x;
        const retreatDiffY = this.y - playerData.y;
        const retreatDist = Math.hypot(retreatDiffX, retreatDiffY);
        if (retreatDist > 0) {
            const moveX = (retreatDiffX / retreatDist) * this.speed * 0.8; // Retreat a bit slower
            const moveY = (retreatDiffY / retreatDist) * this.speed * 0.8;
            if (!this.isCollidingWithWall(this.x + moveX, this.y)) { this.x += moveX; }
            if (!this.isCollidingWithWall(this.x, this.y + moveY)) { this.y += moveY; }
        }
        return; // No other actions while retreating
    }

    const playerCenterX = playerData.x + playerData.width / 2; 
    const playerCenterY = playerData.y + playerData.height / 2;
    const enemyCenterX = this.x + this.width / 2; 
    const enemyCenterY = this.y + this.height / 2;
    const diffX = playerCenterX - enemyCenterX; 
    const diffY = playerCenterY - enemyCenterY;
    const distanceToPlayer = Math.sqrt(diffX * diffX + diffY * diffY);

    // Ranged/Goblin Archer attack logic
    const isRangedType = this.type === 'ranged' || this.type === 'goblin_archer';
    if (isRangedType && this.rangedAttackCooldownTimer <= 0) {
        const attackRange = this.type === 'ranged' ? RANGED_ENEMY_ATTACK_RANGE : GOBLIN_ARCHER_ATTACK_RANGE;
        if (distanceToPlayer <= attackRange) {
            const attackCooldown = this.type === 'ranged' ? gameConfig.RANGED_ENEMY_ATTACK_COOLDOWN : gameConfig.GOBLIN_ARCHER_ATTACK_COOLDOWN;
            const projectileColor = this.type === 'ranged' ? gameConfig.ENEMY_PROJECTILE_COLOR : gameConfig.GOBLIN_ARCHER_PROJECTILE_COLOR;
            
            this.justFiredProjectile = new EnemyProjectile(enemyCenterX, enemyCenterY, playerCenterX, playerCenterY, gameConfig.ENEMY_PROJECTILE_SPEED, projectileColor, ENEMY_PROJECTILE_SIZE);
            this.rangedAttackCooldownTimer = attackCooldown;

            if (this.type === 'goblin_archer') {
                this.postShotRetreatTimer = this.POST_SHOT_RETREAT_DURATION;
            }
        }
    }


    // Movement logic (applies to both melee and ranged if not actively attacking or if player is too close/far for ranged)
    if (distanceToPlayer <= ENEMY_DETECTION_RANGE && distanceToPlayer > 0) {
      let targetMoveX = 0; let targetMoveY = 0;
      // Melee enemies or ranged enemies that are not stopping to shoot will chase
      if (distanceToPlayer > ENEMY_CHASE_STOP_DISTANCE || this.type === 'melee') {
        targetMoveX = (diffX / distanceToPlayer) * this.speed;
        targetMoveY = (diffY / distanceToPlayer) * this.speed;
      }
      // If ranged and player is very close, they might still move
      else if (isRangedType && distanceToPlayer < ENEMY_CHASE_STOP_DISTANCE / 2) {
         targetMoveX = -(diffX / distanceToPlayer) * this.speed * 0.5; // Back away if too close
         targetMoveY = -(diffY / distanceToPlayer) * this.speed * 0.5;
      }

      
      let newEnemyX = this.x + targetMoveX;
      if (targetMoveX !== 0) {
        if (!this.isCollidingWithWall(newEnemyX, this.y)) {
          this.x = newEnemyX;
        } else {
          if (targetMoveX > 0) { 
            const wallTileCol = Math.floor((newEnemyX + this.width) / gameConfig.TILE_SIZE);
            this.x = wallTileCol * gameConfig.TILE_SIZE - this.width;
          } else { 
            const wallTileCol = Math.floor(newEnemyX / gameConfig.TILE_SIZE);
            this.x = (wallTileCol + 1) * gameConfig.TILE_SIZE;
          }
        }
      }

      let newEnemyY = this.y + targetMoveY;
      if (targetMoveY !== 0) {
        if (!this.isCollidingWithWall(this.x, newEnemyY)) { 
          this.y = newEnemyY;
        } else {
          if (targetMoveY > 0) { 
            const wallTileRow = Math.floor((newEnemyY + this.height) / gameConfig.TILE_SIZE);
            this.y = wallTileRow * gameConfig.TILE_SIZE - this.height;
          } else { 
            const wallTileRow = Math.floor(newEnemyY / gameConfig.TILE_SIZE);
            this.y = (wallTileRow + 1) * gameConfig.TILE_SIZE;
          }
        }
      }
    }
    this.x = Math.max(0, Math.min(this.x, CANVAS_WIDTH - this.width));
    this.y = Math.max(0, Math.min(this.y, CANVAS_HEIGHT - this.height));
  }
}