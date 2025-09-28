/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { gameConfig, PLAYER_SIZE } from './index.js';

export class NPC {
  x;
  y;
  width;
  height;
  id;
  name;
  questId;
  type;
  color;

  constructor(x, y, config) {
    this.x = x;
    this.y = y;
    this.width = PLAYER_SIZE; // NPCs are player-sized for now
    this.height = PLAYER_SIZE;
    this.id = config.id;
    this.name = config.name;
    this.questId = config.questId;
    this.type = config.type || 'quest';
    this.color = gameConfig.NPC_COLOR;
  }

  draw(context) {
    context.fillStyle = this.color;
    context.fillRect(this.x, this.y, this.width, this.height);
  }
}