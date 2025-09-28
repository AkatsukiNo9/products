/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Player instance is no longer needed here as attack logic is moved to game.js
export const keysPressed = {};

export function setupInputHandlers() {
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    keysPressed[key] = true;
    
    // Attack action (Enter or Space) and interaction (e) are now handled in game.js 
    // to respect the current game state (e.g., only attack/interact when PLAYING)

    // Prevent default scrolling for arrow keys, WASD, Space, and E
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " ", "e", "q"].includes(key)) {
      event.preventDefault();
    }
  });

  window.addEventListener('keyup', (event) => {
    keysPressed[event.key.toLowerCase()] = false;
  });
}