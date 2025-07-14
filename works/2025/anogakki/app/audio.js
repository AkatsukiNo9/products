/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Constants
export const A4_HZ = 440;
export const OCTAVE_SHIFT_LEVELS = [-2, -1, 0, 1, 2];

// Audio state
let audioContext = null;
let activeOscillator = null;
let activeGain = null;

export function getAudioContext() {
    return audioContext;
}

export function initializeAudio() {
    // For browsers that require a user gesture to start AudioContext
    const initAudio = () => {
        if (!audioContext) {
            audioContext = new AudioContext();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(err => console.error("Error resuming AudioContext:", err));
        }
        // Remove the event listener once the context is initialized
        document.removeEventListener('click', initAudioUserGesture);
        document.removeEventListener('touchstart', initAudioUserGesture);
    };

    const initAudioUserGesture = () => {
        initAudio();
    };
    
    // Attempt to initialize directly, might work if not restricted
    initAudio();

    // If still suspended, add listeners for a user gesture
    if (audioContext && audioContext.state === 'suspended') {
        document.addEventListener('click', initAudioUserGesture, { once: true });
        document.addEventListener('touchstart', initAudioUserGesture, { once: true });
    }
}


export function playOrUpdateSound(xPercent, yPercent, params) {
    if (!audioContext) {
        console.warn("AudioContext not initialized. Attempting to initialize.");
        initializeAudio(); // Try to initialize again
        if (!audioContext) {
            console.error("Failed to initialize AudioContext. Sound cannot be played.");
            return;
        }
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(err => console.error("Error resuming AudioContext:", err));
    }


    const volume = Math.max(0, Math.min(1, params.minVolume + yPercent * (params.maxVolume - params.minVolume)));
    const pitchOctave = params.minPitchOctave + xPercent * (params.maxPitchOctave - params.minPitchOctave);
    const finalOctave = pitchOctave + params.currentGlobalOctaveShift;
    const frequency = A4_HZ * Math.pow(2, finalOctave);

    if (!activeOscillator || !activeGain) {
        stopSound(false); // Quick stop if any old nodes exist

        activeOscillator = audioContext.createOscillator();
        activeGain = audioContext.createGain();

        activeOscillator.type = params.instrumentType;
        activeOscillator.connect(activeGain);
        activeGain.connect(audioContext.destination);
        
        activeOscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        activeGain.gain.setValueAtTime(volume, audioContext.currentTime);
        
        try {
            activeOscillator.start();
        } catch (e) {
            console.warn("Error starting oscillator, attempting to recover:", e);
            stopSound(true); 
            playOrUpdateSound(xPercent, yPercent, params); // Retry
            return;
        }

    } else {
        // Ensure instrument type is updated if it changed
        if (activeOscillator.type !== params.instrumentType) {
             activeOscillator.type = params.instrumentType;
        }
        activeOscillator.frequency.setTargetAtTime(frequency, audioContext.currentTime, 0.01);
        activeGain.gain.setTargetAtTime(volume, audioContext.currentTime, 0.01);
    }
}

export function stopSound(useFadeOut = true) {
    if (audioContext && activeOscillator && activeGain) {
        const now = audioContext.currentTime;
        if (useFadeOut) {
            activeGain.gain.cancelScheduledValues(now);
            activeGain.gain.setValueAtTime(activeGain.gain.value, now); 
            activeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
            activeOscillator.stop(now + 0.2);
        } else {
            // For an immediate stop, ensure values are cleared if context isn't closing
             if (audioContext.state !== 'closed') {
                activeGain.gain.cancelScheduledValues(now);
                activeGain.gain.setValueAtTime(0.0001, now); // Set to very low value
             }
            activeOscillator.stop(now);
        }
    }
    activeOscillator = null;
    activeGain = null;
}

export function closeAudio() {
    if (audioContext && audioContext.state !== 'closed') {
        stopSound(false); // Quick stop, no fade
        audioContext.close().catch(console.error);
        audioContext = null;
    }
}
