/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { playOrUpdateSound, stopSound, OCTAVE_SHIFT_LEVELS, A4_HZ, initializeAudio as initializeAudioSystem, getAudioContext } from './audio.js';
import { getGlobalOctaveShiftIndex, setGlobalOctaveShiftIndex, getOctaveShiftValue } from './index.js';

// --- Constants for Scales and Notes ---
const SCALES = {
    'major': { name: 'メジャースケール', intervals: [0, 2, 4, 5, 7, 9, 11] },
    'natural-minor': { name: 'ナチュラルマイナースケール', intervals: [0, 2, 3, 5, 7, 8, 10] },
    'harmonic-minor': { name: 'ハーモニックマイナースケール', intervals: [0, 2, 3, 5, 7, 8, 11] },
    'major-pentatonic': { name: 'メジャーペンタトニックスケール', intervals: [0, 2, 4, 7, 9] },
    'minor-pentatonic': { name: 'マイナーペンタトニックスケール', intervals: [0, 3, 5, 7, 10] },
    'chromatic': { name: 'クロマチックスケール', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
};
const DEFAULT_SCALE_KEY = 'major';
const A4_MIDI_NUMBER = 69; 
const NOTE_NAMES_CDE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_DOREMI = ['ド', 'ド♯', 'レ', 'レ♯', 'ミ', 'ファ', 'ファ♯', 'ソ', 'ソ♯', 'ラ', 'ラ♯', 'シ'];

const NOTE_NOTATION_SYSTEMS = {
    'doremi': { name: 'ドレミファソラシ', notes: NOTE_NAMES_DOREMI },
    'cde': { name: 'C D E F G A B', notes: NOTE_NAMES_CDE },
};
const DEFAULT_NOTE_NOTATION_KEY = 'doremi';

// --- Animation Constants ---
const SHAPE_ANIMATION_INTERVAL = 100; // ms, for approx. 10 shapes/sec
const SHAPE_TARGET_SCALE = 4; // Smaller expansion

const SHAPE_CONFIGURATIONS = [
    { type: 'circle', fill: true }, { type: 'circle', fill: false },
    { type: 'triangle', fill: true }, { type: 'triangle', fill: false },
    { type: 'square', fill: true }, { type: 'square', fill: false },
    { type: 'pentagon', fill: true }, { type: 'pentagon', fill: false },
];
const SHAPE_COLORS = ['color-teal', 'color-pink'];


// --- DOM Elements ---
let minVolumeEl;
let maxVolumeEl;
let minPitchEl;
let maxPitchEl;
let instrumentTypeEl;
let instrumentAreaEl;
let octaveButtonElements;

let helpButtonEl;
let helpModalOverlayEl;
let helpModalContentEl;
let helpModalCloseButtonEl;

let scaleSelectorEl;
let noteIndicatorsContainerEl; 
let clickAnimationsContainerEl; // For click animations

let currentFrequencyDisplayEl;
let currentVolumeDisplayEl;

let toggleNoteLinesEl;
let togglePitchModeEl;
let noteNotationSelectorEl; 

let isMouseDownInInstrumentArea = false;

// --- State Variables ---
let showNoteLines = true;
let pitchModeIsContinuous = false; // Default to Discrete
let currentNoteNotationSystem = DEFAULT_NOTE_NOTATION_KEY; 

let currentlyVisibleQuantizedNotes = [];
let displayedDiscreteNotes = []; // Notes for discrete mode visual slots

// Animation state
let currentAnimatingShapeConfig = null;
let shapeAnimationIntervalId = null;
let latestPointerCoords = null; // x, y as percentages (0-1)
let lastSnappedMidiNoteForAnimation = null;


// --- Utility Functions ---
function getSoundParameters() {
    return {
        minVolume: parseFloat(minVolumeEl.value) / 100,
        maxVolume: parseFloat(maxVolumeEl.value) / 100,
        minPitchOctave: parseFloat(minPitchEl.value), 
        maxPitchOctave: parseFloat(maxPitchEl.value), 
        instrumentType: instrumentTypeEl.value,
        currentGlobalOctaveShift: getOctaveShiftValue(), 
    };
}

function ensureAudioContextActive() {
    let audioCtx = getAudioContext();
    if (!audioCtx) {
        initializeAudioSystem(); 
        audioCtx = getAudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(err => console.error("UI: Error resuming AudioContext:", err));
    }
    return audioCtx;
}

function getNoteNameFromMidiNumber(midiNumber) {
    if (midiNumber < 0 || midiNumber > 127) return ''; 
    const noteArray = NOTE_NOTATION_SYSTEMS[currentNoteNotationSystem]?.notes || NOTE_NAMES_CDE;
    const noteIndex = midiNumber % 12;
    const octave = Math.floor(midiNumber / 12) - 1; 
    return noteArray[noteIndex] + octave;
}

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}


// --- UI Update Functions ---

function updateSoundInfoDisplay(frequencyHz, volumeNormalized) {
    if (currentFrequencyDisplayEl) {
        currentFrequencyDisplayEl.textContent = frequencyHz !== null ? `${frequencyHz.toFixed(2)} Hz` : '--- Hz';
    }
    if (currentVolumeDisplayEl) {
        currentVolumeDisplayEl.textContent = volumeNormalized !== null ? `${Math.round(volumeNormalized * 100)}` : '---';
    }
}

function updateNoteVisualizers() {
    if (!minPitchEl || !maxPitchEl || !scaleSelectorEl || !noteIndicatorsContainerEl) {
        console.warn("Core elements for note visualization not ready.");
        return;
    }

    currentlyVisibleQuantizedNotes = [];
    displayedDiscreteNotes = [];

    const soundParams = getSoundParameters();
    const currentGlobalOctaveShift = soundParams.currentGlobalOctaveShift;
    const selectedScaleKey = scaleSelectorEl.value;
    const scaleInfo = SCALES[selectedScaleKey]; // User's selected scale for potential root note highlighting in continuous mode

    let intervalsToScan;
    let isDiscreteModeChromaticOverride = false; // Flag to indicate if discrete mode is overriding scale selection with chromatic
    const minMidiToScan = 21; // A0
    const maxMidiToScan = 108; // C8

    if (!pitchModeIsContinuous) { // Discrete mode always uses chromatic scale
        intervalsToScan = SCALES['chromatic'].intervals;
        isDiscreteModeChromaticOverride = true;
    } else if (scaleInfo) { // Continuous mode uses selected scale
        intervalsToScan = scaleInfo.intervals;
    } else { // Fallback for continuous mode if scaleInfo is somehow missing
        console.warn(`Scale not found: ${selectedScaleKey}, defaulting to chromatic for continuous display.`);
        intervalsToScan = SCALES['chromatic'].intervals;
    }


    for (let midiNote = minMidiToScan; midiNote <= maxMidiToScan; midiNote++) {
        const semitonesFromRootInScale = (midiNote - A4_MIDI_NUMBER) % 12; // For checking against 0-11 interval array
        const normalizedSemitone = (semitonesFromRootInScale + 12) % 12;

        if (intervalsToScan.includes(normalizedSemitone)) {
            const noteName = getNoteNameFromMidiNumber(midiNote);
            const totalSemitonesFromA4 = midiNote - A4_MIDI_NUMBER;
            const noteOctaveOffsetFromA4 = totalSemitonesFromA4 / 12;
            const instrumentRelativeOctaveForThisNote = noteOctaveOffsetFromA4 - currentGlobalOctaveShift;

            if (soundParams.maxPitchOctave <= soundParams.minPitchOctave) continue;

            const xPercent = (instrumentRelativeOctaveForThisNote - soundParams.minPitchOctave) /
                             (soundParams.maxPitchOctave - soundParams.minPitchOctave);
            
            const noteFrequency = A4_HZ * Math.pow(2, noteOctaveOffsetFromA4);

            if (xPercent >= -0.05 && xPercent <= 1.05) { // Allow slight overscan for notes just outside visible range
                currentlyVisibleQuantizedNotes.push({
                    xPercent: xPercent, 
                    frequency: noteFrequency,
                    name: noteName,
                    midiNote: midiNote
                });
            }
        }
    }
    currentlyVisibleQuantizedNotes.sort((a, b) => a.xPercent - b.xPercent);
    
    // displayedDiscreteNotes are those strictly within the 0-1 range for discrete mode slots
    displayedDiscreteNotes = currentlyVisibleQuantizedNotes.filter(n => n.xPercent >= 0 && n.xPercent <= 1);
    
    noteIndicatorsContainerEl.innerHTML = ''; 

    if (!showNoteLines) {
        noteIndicatorsContainerEl.style.display = 'none';
        return;
    }
    
    // Determine if container should be visible based on mode and available notes
    const shouldDisplayContainer = 
        (!pitchModeIsContinuous && displayedDiscreteNotes.length > 0) || 
        (pitchModeIsContinuous && currentlyVisibleQuantizedNotes.filter(n => n.xPercent >= 0 && n.xPercent <= 1).length > 0);
        
    noteIndicatorsContainerEl.style.display = shouldDisplayContainer ? '' : 'none';

    if (!shouldDisplayContainer) return;

    if (pitchModeIsContinuous) {
        // --- CONTINUOUS MODE (and showNoteLines is true) ---
        // Draw lines for notes that are visually within the 0-1 range
        const notesToDrawLinesFor = currentlyVisibleQuantizedNotes.filter(n => n.xPercent >= 0 && n.xPercent <= 1);
        for (const note of notesToDrawLinesFor) { 
            const lineEl = document.createElement('div');
            lineEl.className = 'note-indicator-line';
            lineEl.style.left = `${note.xPercent * 100}%`;

            if (note.midiNote === A4_MIDI_NUMBER) lineEl.classList.add('a4');
            // Root note styling only in continuous mode, based on the selected scale
            if (!isDiscreteModeChromaticOverride && scaleInfo && scaleInfo.intervals[0] === ((note.midiNote - A4_MIDI_NUMBER % 12) + 12) % 12) {
                lineEl.classList.add('root-note');
            }

            const textEl = document.createElement('span');
            textEl.className = 'note-indicator-text';
            textEl.textContent = note.name;
            if (note.midiNote === A4_MIDI_NUMBER) textEl.classList.add('a4-text-on-line');
            if (!isDiscreteModeChromaticOverride && scaleInfo && scaleInfo.intervals[0] === ((note.midiNote - A4_MIDI_NUMBER % 12) + 12) % 12) {
                textEl.classList.add('root-note-text-on-line');
            }

            lineEl.appendChild(textEl);
            noteIndicatorsContainerEl.appendChild(lineEl);
        }
    } else {
        // --- DISCRETE MODE (and showNoteLines is true) ---
        // displayedDiscreteNotes is already correctly populated (always chromatic in discrete mode)
        if (displayedDiscreteNotes.length > 0) {
            const numVisualNotes = displayedDiscreteNotes.length;
            const slotWidthPercent = 1.0 / numVisualNotes;

            for (let i = 0; i < numVisualNotes; i++) {
                const currentNoteData = displayedDiscreteNotes[i];

                if (i > 0) { 
                    const boundaryXVisualPercent = i * slotWidthPercent;
                    const boundaryEl = document.createElement('div');
                    boundaryEl.className = 'snap-boundary-indicator';
                    boundaryEl.style.left = `${boundaryXVisualPercent * 100}%`;
                    noteIndicatorsContainerEl.appendChild(boundaryEl);
                }

                const textPositionXVisualPercent = (i * slotWidthPercent) + (slotWidthPercent / 2);
                const textEl = document.createElement('span');
                textEl.className = 'note-indicator-text discrete-mode-text';
                textEl.textContent = currentNoteData.name;
                textEl.style.left = `${textPositionXVisualPercent * 100}%`;

                if (currentNoteData.midiNote === A4_MIDI_NUMBER) textEl.classList.add('a4-text');
                // Root note styling for discrete labels - only apply if NOT in discrete chromatic override AND it's a root.
                // Since discrete mode IS chromatic override, this effectively disables selected scale root highlighting here.
                if (!isDiscreteModeChromaticOverride && scaleInfo && scaleInfo.intervals[0] === ((currentNoteData.midiNote - A4_MIDI_NUMBER % 12) + 12) % 12) {
                    textEl.classList.add('root-note-text');
                }
                
                noteIndicatorsContainerEl.appendChild(textEl);
            }
        }
    }
}


// --- Animation Functions ---
function createExpandingShape(pointerLocalXPercent, pointerLocalYPercent, shapeConfig) {
    if (!clickAnimationsContainerEl || !shapeConfig) return;

    const shapeEl = document.createElement('div');
    shapeEl.classList.add('expanding-shape', `shape-${shapeConfig.type}`);
    shapeEl.classList.add(getRandomElement(SHAPE_COLORS));

    if (!shapeConfig.fill) {
        shapeEl.classList.add('outline');
    }
    
    shapeEl.style.left = `${pointerLocalXPercent * 100}%`;
    shapeEl.style.top = `${pointerLocalYPercent * 100}%`;

    let rotationDeg = 0;
    if (shapeConfig.type !== 'circle') { 
        rotationDeg = Math.random() * 360;
    }
    
    clickAnimationsContainerEl.appendChild(shapeEl);
    void shapeEl.offsetWidth; 

    requestAnimationFrame(() => {
        shapeEl.style.transform = `translate(-50%, -50%) scale(${SHAPE_TARGET_SCALE}) rotate(${rotationDeg}deg)`;
        shapeEl.style.opacity = '0'; 
    });

    shapeEl.addEventListener('transitionend', () => {
        shapeEl.remove();
    }, { once: true });
}

// --- Event Handlers ---
function handleInstrumentAreaInteraction(event) {
    if (!ensureAudioContextActive()) {
        console.warn("Audio context not available for interaction.");
        return;
    }

    const rect = instrumentAreaEl.getBoundingClientRect();
    let clientX, clientY;

    if (event instanceof MouseEvent) {
        clientX = event.clientX;
        clientY = event.clientY;
    } else if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
        if (event.cancelable) event.preventDefault(); 
    } else {
        return; 
    }
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const currentPointerLocalXPercent = Math.max(0, Math.min(1, x / rect.width));
    const currentPointerLocalYPercent = Math.max(0, Math.min(1, y / rect.height));
    latestPointerCoords = { x: currentPointerLocalXPercent, y: currentPointerLocalYPercent };

    const yPercentForSound = 1 - currentPointerLocalYPercent; 
    const soundParams = getSoundParameters();

    let finalXPercentForSound;
    let finalFrequency;
    let currentMidiNoteForAnimation = null;

    if (!pitchModeIsContinuous && displayedDiscreteNotes.length > 0) {
        const numVisualSlots = displayedDiscreteNotes.length;
        const slotWidthPercent = 1.0 / numVisualSlots;
        let slotIndex = Math.floor(currentPointerLocalXPercent / slotWidthPercent);
        slotIndex = Math.max(0, Math.min(slotIndex, numVisualSlots - 1)); // Clamp index

        const selectedNoteFromSlot = displayedDiscreteNotes[slotIndex];
        
        finalXPercentForSound = selectedNoteFromSlot.xPercent; // Use the note's actual pitch-based xPercent
        finalFrequency = selectedNoteFromSlot.frequency;
        currentMidiNoteForAnimation = selectedNoteFromSlot.midiNote;

        if (currentMidiNoteForAnimation !== lastSnappedMidiNoteForAnimation) {
            lastSnappedMidiNoteForAnimation = currentMidiNoteForAnimation;
            currentAnimatingShapeConfig = getRandomElement(SHAPE_CONFIGURATIONS);
        }
    } else { // Continuous mode or no discrete notes to snap to
        finalXPercentForSound = currentPointerLocalXPercent; 
        const displayPitchOctave = soundParams.minPitchOctave + finalXPercentForSound * (soundParams.maxPitchOctave - soundParams.minPitchOctave);
        const displayFinalOctave = displayPitchOctave + soundParams.currentGlobalOctaveShift;
        finalFrequency = A4_HZ * Math.pow(2, displayFinalOctave);
        // In continuous mode, animation shape might not change per "note" in the same way
        // Resetting lastSnappedMidiNoteForAnimation ensures a new shape if mode was just switched
        if (lastSnappedMidiNoteForAnimation !== null) { 
            lastSnappedMidiNoteForAnimation = null;
            currentAnimatingShapeConfig = getRandomElement(SHAPE_CONFIGURATIONS);
        }
    }
    
    const displayVolumeNormalized = Math.max(0, Math.min(1, soundParams.minVolume + yPercentForSound * (soundParams.maxVolume - soundParams.minVolume)));
    updateSoundInfoDisplay(finalFrequency, displayVolumeNormalized);
    playOrUpdateSound(finalXPercentForSound, yPercentForSound, soundParams);
}

function onMouseDown(event) {
    if (event.button !== 0) return;
    if (!instrumentAreaEl.contains(event.target) && event.target !== instrumentAreaEl) return;
    
    ensureAudioContextActive(); 

    isMouseDownInInstrumentArea = true;
    instrumentAreaEl.classList.add('active'); 
    
    currentAnimatingShapeConfig = getRandomElement(SHAPE_CONFIGURATIONS);
    lastSnappedMidiNoteForAnimation = null; 

    handleInstrumentAreaInteraction(event); 

    if (latestPointerCoords && currentAnimatingShapeConfig) {
        createExpandingShape(latestPointerCoords.x, latestPointerCoords.y, currentAnimatingShapeConfig);
    }

    if (shapeAnimationIntervalId !== null) clearInterval(shapeAnimationIntervalId);
    shapeAnimationIntervalId = window.setInterval(() => {
        if (isMouseDownInInstrumentArea && latestPointerCoords && currentAnimatingShapeConfig) {
            createExpandingShape(latestPointerCoords.x, latestPointerCoords.y, currentAnimatingShapeConfig);
        }
    }, SHAPE_ANIMATION_INTERVAL);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(event) {
    if (!isMouseDownInInstrumentArea) return;
    handleInstrumentAreaInteraction(event);
}

function onMouseUp(event) {
    if (event.button !== 0 || !isMouseDownInInstrumentArea) return;
    
    isMouseDownInInstrumentArea = false;
    instrumentAreaEl.classList.remove('active');
    stopSound();
    updateSoundInfoDisplay(null, null); 

    if (shapeAnimationIntervalId !== null) {
        clearInterval(shapeAnimationIntervalId);
        shapeAnimationIntervalId = null;
    }
    latestPointerCoords = null;
    currentAnimatingShapeConfig = null;
    lastSnappedMidiNoteForAnimation = null;

    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
}

function onTouchStart(event) {
    if (!instrumentAreaEl.contains(event.target) && event.target !== instrumentAreaEl) return;
    
    ensureAudioContextActive(); 
    
    isMouseDownInInstrumentArea = true; 
    instrumentAreaEl.classList.add('active');
    
    currentAnimatingShapeConfig = getRandomElement(SHAPE_CONFIGURATIONS);
    lastSnappedMidiNoteForAnimation = null;

    handleInstrumentAreaInteraction(event); 

    if (latestPointerCoords && currentAnimatingShapeConfig) {
        createExpandingShape(latestPointerCoords.x, latestPointerCoords.y, currentAnimatingShapeConfig);
    }

    if (shapeAnimationIntervalId !== null) clearInterval(shapeAnimationIntervalId);
    shapeAnimationIntervalId = window.setInterval(() => {
        if (isMouseDownInInstrumentArea && latestPointerCoords && currentAnimatingShapeConfig) {
            createExpandingShape(latestPointerCoords.x, latestPointerCoords.y, currentAnimatingShapeConfig);
        }
    }, SHAPE_ANIMATION_INTERVAL);

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
}

function onTouchMove(event) {
    if (!isMouseDownInInstrumentArea) return;
    if (event.cancelable) event.preventDefault(); 
    handleInstrumentAreaInteraction(event);
}

function onTouchEnd() {
    if (!isMouseDownInInstrumentArea) return;
    isMouseDownInInstrumentArea = false;
    instrumentAreaEl.classList.remove('active');
    stopSound();
    updateSoundInfoDisplay(null, null); 

    if (shapeAnimationIntervalId !== null) {
        clearInterval(shapeAnimationIntervalId);
        shapeAnimationIntervalId = null;
    }
    latestPointerCoords = null;
    currentAnimatingShapeConfig = null;
    lastSnappedMidiNoteForAnimation = null;

    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
}

function handleOctaveSelectorButtonClick(event) {
    ensureAudioContextActive();
    const button = event.currentTarget;
    const shiftValue = parseInt(button.dataset.octaveShift || '0', 10);
    
    const newIndex = OCTAVE_SHIFT_LEVELS.indexOf(shiftValue);
    if (newIndex !== -1) {
        setGlobalOctaveShiftIndex(newIndex);
        updateOctaveButtonStatesUI();
        updateNoteVisualizers(); 
    } else {
        console.warn(`Invalid octave shift value: ${shiftValue}`);
    }
}

export function updateOctaveButtonStatesUI() {
    if (!octaveButtonElements) return;
    const currentShiftValue = getOctaveShiftValue();
    octaveButtonElements.forEach(button => {
        const buttonShiftValue = parseInt(button.dataset.octaveShift || '999', 10); 
        if (buttonShiftValue === currentShiftValue) {
            button.classList.add('active');
            button.setAttribute('aria-pressed', 'true');
        } else {
            button.classList.remove('active');
            button.setAttribute('aria-pressed', 'false');
        }
    });
}

function validateRangeInputs(minEl, maxEl, event, isPitch = false) {
    let minVal = parseFloat(minEl.value);
    let maxVal = parseFloat(maxEl.value);

    if (isPitch) {
        if (isNaN(minVal)) minEl.value = "-0.75"; 
        if (isNaN(maxVal)) maxEl.value = "0.75"; 
        minVal = parseFloat(minEl.value); 
        maxVal = parseFloat(maxEl.value); 
        if (minVal >= maxVal) { 
            if (event && event.target?.id === minEl.id) {
               maxEl.value = String(minVal + 0.01); 
           } else {
               minEl.value = String(maxVal - 0.01); 
           }
        }
    } else { 
        minVal = Math.max(0, Math.min(100, isNaN(minVal) ? 0 : minVal));
        maxVal = Math.max(0, Math.min(100, isNaN(maxVal) ? 100 : maxVal));
        
        minEl.value = String(minVal);
        maxEl.value = String(maxVal);

        if (minVal > maxVal) {
             if (event && event.target?.id === minEl.id) {
                maxEl.value = String(minVal); 
            } else {
                minEl.value = String(maxVal); 
            }
        }
    }
    if (isPitch) { 
        updateNoteVisualizers(); 
    }
}

// --- Help Modal Logic ---
function showHelpModal() {
    if (helpModalOverlayEl && helpButtonEl) {
        helpModalOverlayEl.classList.add('visible');
        helpModalOverlayEl.setAttribute('aria-hidden', 'false');
        helpButtonEl.setAttribute('aria-expanded', 'true');
        helpModalCloseButtonEl?.focus(); 
    }
}

function hideHelpModal() {
    if (helpModalOverlayEl && helpButtonEl) {
        helpModalOverlayEl.classList.remove('visible');
        helpModalOverlayEl.setAttribute('aria-hidden', 'true');
        helpButtonEl.setAttribute('aria-expanded', 'false');
        helpButtonEl?.focus(); 
    }
}

function toggleHelpModal() {
    ensureAudioContextActive(); 
    if (helpModalOverlayEl && helpModalOverlayEl.classList.contains('visible')) {
        hideHelpModal();
    } else {
        showHelpModal();
    }
}

// --- Initialization ---
export function initializeUI() {
    minVolumeEl = document.getElementById('min-volume');
    maxVolumeEl = document.getElementById('max-volume');
    minPitchEl = document.getElementById('min-pitch');
    maxPitchEl = document.getElementById('max-pitch');
    instrumentTypeEl = document.getElementById('instrument-type');
    instrumentAreaEl = document.getElementById('instrument-area');
    octaveButtonElements = document.querySelectorAll('.octave-selector-button');
    
    currentFrequencyDisplayEl = document.getElementById('current-frequency-display');
    currentVolumeDisplayEl = document.getElementById('current-volume-display');

    scaleSelectorEl = document.getElementById('scale-selector');
    noteIndicatorsContainerEl = document.getElementById('note-indicators-container');
    clickAnimationsContainerEl = document.getElementById('click-animations-container');


    helpButtonEl = document.getElementById('help-button');
    helpModalOverlayEl = document.getElementById('help-modal-overlay');
    if (helpModalOverlayEl) { 
        helpModalContentEl = helpModalOverlayEl.querySelector('.help-modal-content');
        helpModalCloseButtonEl = helpModalOverlayEl.querySelector('.modal-close-button');
    }

    toggleNoteLinesEl = document.getElementById('toggle-note-lines');
    togglePitchModeEl = document.getElementById('toggle-pitch-mode');
    noteNotationSelectorEl = document.getElementById('note-notation-selector');


    if (scaleSelectorEl) {
        for (const key in SCALES) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = SCALES[key].name;
            scaleSelectorEl.appendChild(option);
        }
        scaleSelectorEl.value = DEFAULT_SCALE_KEY; 
        scaleSelectorEl.addEventListener('change', updateNoteVisualizers);
    }

    if (noteNotationSelectorEl) {
        for (const key in NOTE_NOTATION_SYSTEMS) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = NOTE_NOTATION_SYSTEMS[key].name;
            noteNotationSelectorEl.appendChild(option);
        }
        noteNotationSelectorEl.value = DEFAULT_NOTE_NOTATION_KEY;
        noteNotationSelectorEl.addEventListener('change', () => {
            currentNoteNotationSystem = noteNotationSelectorEl.value;
            updateNoteVisualizers();
        });
    }


    if (!instrumentAreaEl || octaveButtonElements.length === 0 || !minVolumeEl || !maxVolumeEl || !minPitchEl || !maxPitchEl || 
        !instrumentTypeEl || !currentFrequencyDisplayEl || !currentVolumeDisplayEl || !scaleSelectorEl || 
        !noteIndicatorsContainerEl || !toggleNoteLinesEl || !togglePitchModeEl || !noteNotationSelectorEl ||
        !clickAnimationsContainerEl ) { 
        console.error("One or more core UI elements could not be found. Application might not work as expected.");
        return; 
    }
    
    // Event Listeners
    instrumentTypeEl.addEventListener('change', updateNoteVisualizers); 

    if (instrumentAreaEl) {
        instrumentAreaEl.addEventListener('mousedown', onMouseDown);
        instrumentAreaEl.addEventListener('touchstart', onTouchStart, { passive: false });
    }
    
    if (octaveButtonElements.length > 0) {
        octaveButtonElements.forEach(button => {
            button.addEventListener('click', handleOctaveSelectorButtonClick);
        });
    }

    if (minVolumeEl && maxVolumeEl) {
        minVolumeEl.addEventListener('input', (e) => validateRangeInputs(minVolumeEl, maxVolumeEl, e));
        maxVolumeEl.addEventListener('input', (e) => validateRangeInputs(minVolumeEl, maxVolumeEl, e));
    }
    if (minPitchEl && maxPitchEl) {
        minPitchEl.addEventListener('input', (e) => validateRangeInputs(minPitchEl, maxPitchEl, e, true));
        maxPitchEl.addEventListener('input', (e) => validateRangeInputs(minPitchEl, maxPitchEl, e, true));
    }
    
    if (helpButtonEl && helpModalOverlayEl && helpModalContentEl && helpModalCloseButtonEl) {
        helpButtonEl.addEventListener('click', toggleHelpModal);
        helpModalCloseButtonEl.addEventListener('click', hideHelpModal);
        helpModalOverlayEl.addEventListener('click', (event) => {
            if (event.target === helpModalOverlayEl) hideHelpModal();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && helpModalOverlayEl.classList.contains('visible')) hideHelpModal();
        });
    } else {
        console.warn('Help modal UI elements not fully found. Help functionality may be limited or disabled.');
        if(helpButtonEl) helpButtonEl.style.display = 'none'; 
    }

    toggleNoteLinesEl.addEventListener('change', () => {
        showNoteLines = toggleNoteLinesEl.checked;
        updateNoteVisualizers(); 
    });

    togglePitchModeEl.addEventListener('change', () => {
        pitchModeIsContinuous = togglePitchModeEl.value === 'continuous';
        lastSnappedMidiNoteForAnimation = null; 
        if (!pitchModeIsContinuous) { 
            currentAnimatingShapeConfig = getRandomElement(SHAPE_CONFIGURATIONS);
        } else { // Reset animation config if switching to continuous
            currentAnimatingShapeConfig = getRandomElement(SHAPE_CONFIGURATIONS);
        }
        updateNoteVisualizers(); 
    });

    // Initial UI State Updates
    toggleNoteLinesEl.checked = showNoteLines;
    pitchModeIsContinuous = false; // Default to discrete
    togglePitchModeEl.value = 'discrete'; 
    currentNoteNotationSystem = noteNotationSelectorEl.value;


    updateOctaveButtonStatesUI(); 
    if (minVolumeEl && maxVolumeEl) validateRangeInputs(minVolumeEl, maxVolumeEl, null); 
    if (minPitchEl && maxPitchEl) validateRangeInputs(minPitchEl, maxPitchEl, null, true); 
    updateSoundInfoDisplay(null, null); 
    updateNoteVisualizers(); 
}
