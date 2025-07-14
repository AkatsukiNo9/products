/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeAudio, closeAudio, getAudioContext, OCTAVE_SHIFT_LEVELS } from './audio.js';
import { initializeUI, updateOctaveButtonStatesUI } from './ui.js'; // Changed import

// Audio state shared with UI
let currentGlobalOctaveShiftIndex = 2; // Corresponds to 0 in OCTAVE_SHIFT_LEVELS

export function getGlobalOctaveShiftIndex() {
    return currentGlobalOctaveShiftIndex;
}

export function setGlobalOctaveShiftIndex(index) {
    currentGlobalOctaveShiftIndex = index;
}

export function getOctaveShiftValue() {
    return OCTAVE_SHIFT_LEVELS[currentGlobalOctaveShiftIndex];
}

document.addEventListener('DOMContentLoaded', () => {
    initializeAudio();
    initializeUI(); 
    updateOctaveButtonStatesUI(); // Initial button active state update
});

// Clean up audio resources when the page is unloaded
window.addEventListener('pagehide', () => {
    const audioCtx = getAudioContext();
    if (audioCtx && audioCtx.state !== 'closed') {
        closeAudio();
    }
});
// Handle visibility change to stop sound if page becomes hidden
document.addEventListener('visibilitychange', () => {
    const audioCtx = getAudioContext();
    if (document.visibilityState === 'hidden') {
        // Potentially stop sound or pause context if desired
        // For now, rely on mouseup/touchend to stop sound.
        // If audio is playing and page is hidden, it might continue.
        // closeAudio(); // This might be too aggressive
    } else if (document.visibilityState === 'visible') {
        // Resume context if it was suspended
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(console.error);
        }
    }
});
