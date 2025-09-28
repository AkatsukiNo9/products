/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BOSS_SIZE,
  BOSS_PROJECTILE_SIZE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TileType,
} from './index.js';
import { gameMap } from './maps/map.js';
import { EnemyProjectile } from './items.js';

const BossState = Object.freeze({
  IDLE: 0,
  MOVING: 1,
  ATTACKING: 2,
  DASHING: 3,
  WARPING: 4,
  DEAD: 5,
});

// Module-scoped variable to hold all boss configurations
let allBossConfigs;

// Function to be called from game.js to initialize the configs
export function initializeBossData(configs) {
    allBossConfigs = configs;
}

export class Boss {
  id;
  name;
  x; y; width; height;
  speed;
  hp; maxHp;
  isAlive; isDead;
  isHit; hitTimer;

  phase;
  state;
  stateTimer;
  moveTargetX;
  moveTargetY;

  // Config-driven stats
  stats;

  // Dash attack properties
  isDashing;
  dashChargeTimer;
  dashTimer;
  dashTargetX;
  dashTargetY;
  postDashCooldown;

  // Projectile attack properties
  projectileAttackCooldown;
  
  // Warp properties
  warpCooldownTimer;
  warpChargeTimer;


  // Death properties
  deathTimer;


  constructor(x, y, id) {
    if (!allBossConfigs || !allBossConfigs[id]) {
        throw new Error(`Boss configuration for ID "${id}" not found.`);
    }
    this.stats = allBossConfigs[id];
    
    this.id = id;
    this.name = this.stats.name;
    this.x = x; this.y = y; this.width = BOSS_SIZE; this.height = BOSS_SIZE;
    this.speed = this.stats.speed;
    this.maxHp = this.stats.hp;
    this.hp = this.maxHp;

    this.isAlive = true;
    this.isDead = false;
    this.isHit = false;
    this.hitTimer = 0;

    this.phase = 1;
    this.state = BossState.IDLE;
    this.stateTimer = 1000; // Start moving after 1s
    this.moveTargetX = this.x;
    this.moveTargetY = this.y;

    this.isDashing = false;
    this.dashChargeTimer = 0;
    this.dashTimer = 0;
    this.dashTargetX = 0;
    this.dashTargetY = 0;
    this.postDashCooldown = 0;

    this.projectileAttackCooldown = 0;
    this.deathTimer = this.stats.deathDuration;
    
    this.warpCooldownTimer = this.stats.warpCooldown || 0;
    this.warpChargeTimer = 0;
  }

  isCollidingWithWall(checkX, checkY) {
    const entityLeft = checkX;
    const entityRight = checkX + this.width;
    const entityTop = checkY;
    const entityBottom = checkY + this.height;

    const firstTileCol = Math.floor(entityLeft / CANVAS_WIDTH * 25);
    const lastTileCol = Math.floor((entityRight - 1) / CANVAS_WIDTH * 25);
    const firstTileRow = Math.floor(entityTop / CANVAS_HEIGHT * 18);
    const lastTileRow = Math.floor((entityBottom - 1) / CANVAS_HEIGHT * 18);

    if (!gameMap) return true;

    for (let r = firstTileRow; r <= lastTileRow; r++) {
      for (let c = firstTileCol; c <= lastTileCol; c++) {
        if (r < 0 || r >= 18 || c < 0 || c >= 25) return true;
        const tileType = gameMap[r]?.[c];
        if (tileType === TileType.WALL || tileType === TileType.DUNGEON_WALL) {
          return true;
        }
      }
    }
    return false;
  }

  takeDamage(amount) {
    if (!this.isAlive || this.isDashing) return false;
    this.hp -= amount;
    this.isHit = true;
    this.hitTimer = 100;

    if (this.phase === 1 && this.hp <= this.maxHp / 2) {
      this.phase = 2;
      this.speed *= this.stats.phase2SpeedMultiplier;
      console.log("Boss entered phase 2!");
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.isAlive = false;
      this.state = BossState.DEAD;
      console.log("Boss defeated!");
      return true; // Is defeated
    }
    return false; // Not defeated
  }

  update(deltaTime, playerData) {
    if (this.isDead) return [];

    if (!this.isAlive) {
      this.deathTimer -= deltaTime;
      if (this.deathTimer <= 0) {
        this.isDead = true;
      }
      return [];
    }

    if (this.hitTimer > 0) {
      this.hitTimer -= deltaTime;
      if (this.hitTimer <= 0) this.isHit = false;
    }
    if (this.projectileAttackCooldown > 0) this.projectileAttackCooldown -= deltaTime;
    if (this.postDashCooldown > 0) this.postDashCooldown -= deltaTime;
    if (this.warpCooldownTimer > 0) this.warpCooldownTimer -= deltaTime;
    
    this.stateTimer -= deltaTime;

    const projectiles = [];

    // State machine
    if (this.stateTimer <= 0) {
      this.chooseNextAction(playerData);
    }
    
    switch (this.state) {
        case BossState.MOVING:
            this.handleMovement(deltaTime);
            break;
        case BossState.ATTACKING:
            const newProjectiles = this.handleAttacking(playerData);
            projectiles.push(...newProjectiles);
            break;
        case BossState.DASHING:
            this.handleDashing(deltaTime, playerData);
            break;
        case BossState.WARPING:
            this.handleWarping(deltaTime, playerData);
            break;
    }

    this.x = Math.max(0, Math.min(this.x, CANVAS_WIDTH - this.width));
    this.y = Math.max(0, Math.min(this.y, CANVAS_HEIGHT - this.height));
    
    return projectiles;
  }

  chooseNextAction(playerData) {
    if (this.isDashing || this.dashChargeTimer > 0 || this.postDashCooldown > 0 || this.warpChargeTimer > 0) return;

    if (this.state === BossState.MOVING) { // Was moving, now stop and attack
        this.state = BossState.IDLE;
        this.stateTimer = 2000 + Math.random() * 1000; // Wait for 2-3s

    } else { // Was idle/attacking, now move
        this.state = BossState.MOVING;
        this.stateTimer = 1500 + Math.random() * 1000; // Move for 1.5-2.5s
        
        // Pick a new random point to move to
        this.moveTargetX = Math.random() * (CANVAS_WIDTH - this.width);
        this.moveTargetY = Math.random() * (CANVAS_HEIGHT - this.height);
    }

    // Decide on special attacks while idle
    if (this.state === BossState.IDLE) {
        const canWarp = this.stats.warpCooldown && this.warpCooldownTimer <= 0;
        if (canWarp && Math.random() < 0.5) { // 50% chance to warp
            this.state = BossState.WARPING;
            this.warpChargeTimer = this.stats.warpChargeTime;
            this.stateTimer = this.stats.warpChargeTime; // Prevent state change during charge
            return;
        }

        const canDash = this.phase === 2 && this.postDashCooldown <= 0;
        const roll = Math.random();

        if (canDash && roll < 0.4) { // 40% chance to dash
            this.state = BossState.DASHING;
            this.dashChargeTimer = this.stats.dashChargeTime;
            this.dashTargetX = playerData.x;
            this.dashTargetY = playerData.y;
        } else if (this.projectileAttackCooldown <= 0) { // Else, shoot projectiles
            this.state = BossState.ATTACKING;
            this.projectileAttackCooldown = this.stats.projectileCooldown;
        }
    }
  }

  handleMovement(_deltaTime) {
    const diffX = this.moveTargetX - this.x;
    const diffY = this.moveTargetY - this.y;
    const distance = Math.sqrt(diffX * diffX + diffY * diffY);

    if (distance > this.speed) {
      let moveX = (diffX / distance) * this.speed;
      let moveY = (diffY / distance) * this.speed;
      
      let newX = this.x + moveX;
      let newY = this.y + moveY;
      
      if (!this.isCollidingWithWall(newX, newY)) {
        this.x = newX;
        this.y = newY;
      } else {
        // Hit a wall, stop moving for this cycle
        this.stateTimer = 0;
      }
    } else {
        // Reached destination, stop moving
        this.stateTimer = 0;
    }
  }

  handleAttacking(playerData) {
    const playerCenterX = playerData.x + playerData.width / 2;
    const playerCenterY = playerData.y + playerData.height / 2;
    const bossCenterX = this.x + this.width / 2;
    const bossCenterY = this.y + this.height / 2;
    
    const projectiles = [];
    const numProjectiles = 5;
    const spreadAngle = Math.PI / 3; // 60 degrees

    const angleToPlayer = Math.atan2(playerCenterY - bossCenterY, playerCenterX - bossCenterX);

    for (let i = 0; i < numProjectiles; i++) {
        const angle = angleToPlayer - spreadAngle / 2 + (spreadAngle / (numProjectiles - 1)) * i;
        const targetX = bossCenterX + Math.cos(angle);
        const targetY = bossCenterY + Math.sin(angle);
        
        const proj = new EnemyProjectile(bossCenterX, bossCenterY, targetX, targetY, this.stats.projectileSpeed, this.stats.projectileColor, BOSS_PROJECTILE_SIZE);
        projectiles.push(proj);
    }

    this.state = BossState.IDLE; // Go back to idle after firing
    this.stateTimer = 1000; // Short pause
    return projectiles;
  }

  handleDashing(deltaTime, _playerData) {
    if (this.dashChargeTimer > 0) {
        this.dashChargeTimer -= deltaTime;
        if (this.dashChargeTimer <= 0) {
            this.isDashing = true;
            this.dashTimer = this.stats.dashDuration;
            // Lock in target
            const diffX = this.dashTargetX - this.x;
            const diffY = this.dashTargetY - this.y;
            const distance = Math.sqrt(diffX*diffX + diffY*diffY);
            if (distance > 0) {
              this.dashTargetX = (diffX / distance);
              this.dashTargetY = (diffY / distance);
            } else { // Player is on top of boss, dash up
              this.dashTargetX = 0;
              this.dashTargetY = -1;
            }
        }
        return;
    }
    
    if (this.isDashing) {
        this.dashTimer -= deltaTime;
        
        const dashSpeed = this.speed * this.stats.dashSpeedMultiplier;
        const moveX = this.dashTargetX * dashSpeed;
        const moveY = this.dashTargetY * dashSpeed;

        let newX = this.x + moveX;
        let newY = this.y + moveY;
        
        if (!this.isCollidingWithWall(newX, newY)) {
            this.x = newX;
            this.y = newY;
        } else {
            this.dashTimer = 0; // Stop dash if it hits a wall
        }

        if (this.dashTimer <= 0) {
            this.isDashing = false;
            this.state = BossState.IDLE;
            this.stateTimer = 1000; // Post-dash pause
            this.postDashCooldown = this.stats.dashCooldown;
        }
    }
  }

  handleWarping(deltaTime, playerData) {
      if (this.warpChargeTimer > 0) {
          this.warpChargeTimer -= deltaTime;
          if (this.warpChargeTimer <= 0) {
              // Execute warp: appear behind player
              const angleToPlayer = Math.atan2(this.y - playerData.y, this.x - playerData.x);
              const warpDist = 100;
              let warpX = playerData.x + Math.cos(angleToPlayer) * warpDist;
              let warpY = playerData.y + Math.sin(angleToPlayer) * warpDist;

              // Clamp to screen bounds
              warpX = Math.max(this.width, Math.min(warpX, CANVAS_WIDTH - this.width * 2));
              warpY = Math.max(this.height, Math.min(warpY, CANVAS_HEIGHT - this.height * 2));

              if (!this.isCollidingWithWall(warpX, warpY)) {
                  this.x = warpX;
                  this.y = warpY;
              } else {
                  // Fallback if warp position is in a wall
                  this.x = playerData.x + (Math.random() < 0.5 ? 80 : -80);
                  this.y = playerData.y;
              }
              
              this.state = BossState.IDLE;
              this.stateTimer = 500; // Post-warp pause
              this.warpCooldownTimer = this.stats.warpCooldown;
          }
      }
  }


  draw(context) {
    if (this.isDead) return;
    context.save();

    let currentColor = this.phase === 2 ? this.stats.enragedColor : this.stats.color;
    
    if (!this.isAlive) { // Death animation
        const blink = Math.floor(this.deathTimer / 100) % 2 === 0;
        if (blink) {
            context.fillStyle = this.stats.hitColor;
        } else {
            context.fillStyle = currentColor;
        }
    } else if (this.isHit) {
        currentColor = this.stats.hitColor;
    } else if (this.dashChargeTimer > 0) {
        const blink = Math.floor(this.dashChargeTimer / 100) % 2 === 0;
        currentColor = blink ? 'white' : currentColor;
    } else if (this.warpChargeTimer > 0) {
        const blink = Math.floor(this.warpChargeTimer / 80) % 2 === 0;
        context.globalAlpha = blink ? 0.3 : 0.8;
    }

    context.fillStyle = currentColor;
    context.fillRect(this.x, this.y, this.width, this.height);
    context.restore();
  }
}