
'use strict';

// ==========================================
// ELEMENTOS DEL HTML
// ==========================================

const minInput = document.getElementById('minutos');
const secInput = document.getElementById('segundos');
const progress = document.getElementById('avance');

const startLabel = document.getElementById('hora-inicio');
const endLabel = document.getElementById('hora-final');
const statusLabel = document.getElementById('estado');

const playButton = document.getElementById('play');
const stopButton = document.getElementById('stop');
const resetButton = document.getElementById('reset');

const addButtons = [...document.querySelectorAll('[data-add]')];
const btnFullscreen = document.getElementById('btn-fullscreen');

// ==========================================
// CONFIGURACIÓN
// ==========================================

const CIRCUMFERENCE = 2 * Math.PI * 106;
const MAX_SECONDS = 9999 * 60 + 59;

const limaClock = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
});

let configuredSeconds = 300;
let remainingMs = configuredSeconds * 1000;

let deadline = 0;
let intervalId = null;

let running = false;
let hasStarted = false;

// ==========================================
// SISTEMA DE AUDIO
// ==========================================

let audioContext = null;
let activeOscillators = [];

function prepareSound() {
    const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    if (!audioContext) {
        audioContext = new AudioContextClass();
    }

    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(console.error);
    }
}

// Detener cualquier alarma anterior
function stopFinishSound() {
    activeOscillators.forEach(oscillator => {
        try {
            oscillator.stop();
        } catch (error) {
            // El oscilador ya terminó
        }
    });

    activeOscillators = [];
}

// ==========================================
// ALARMA: TAN TAN × 4
// ==========================================

function playFinishSound() {
    stopFinishSound();

    if (!audioContext || audioContext.state !== 'running') {
        return;
    }

    const now = audioContext.currentTime;

    const repetitions = 5;
    const notesPerRepeat = 2;

    for (let r = 0; r < repetitions; r++) {
        for (let i = 0; i < notesPerRepeat; i++) {

            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();

            oscillator.type = 'triangle';
            oscillator.frequency.value = 880;

            // Dos pitidos cortos y pausa entre repeticiones
            const start = now + r * 1.68 + i * 0.4;
            const end = start + 0.28;

            gain.gain.setValueAtTime(0.0001, start);

            gain.gain.exponentialRampToValueAtTime(
                0.4,
                start + 0.025
            );

            gain.gain.setValueAtTime(
                0.4,
                end - 0.08
            );

            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                end
            );

            oscillator.connect(gain);
            gain.connect(audioContext.destination);

            activeOscillators.push(oscillator);

            oscillator.start(start);
            oscillator.stop(end);

            oscillator.onended = () => {
                oscillator.disconnect();
                gain.disconnect();

                activeOscillators = activeOscillators.filter(
                    item => item !== oscillator
                );
            };
        }
    }
}

// ==========================================
// FUNCIONES DEL TEMPORIZADOR
// ==========================================

function formatLima(date) {
    return limaClock.format(date);
}

function displaySeconds(seconds) {
    minInput.value = String(
        Math.floor(seconds / 60)
    ).padStart(2, '0');

    secInput.value = String(
        seconds % 60
    ).padStart(2, '0');
}

function readSeconds() {
    const m = Number(minInput.value || 0);
    const s = Number(secInput.value || 0);

    return Math.min(MAX_SECONDS, m * 60 + s);
}

// ==========================================
// PROGRESO CIRCULAR
// ==========================================

function updateProgress() {
    const fraction = configuredSeconds > 0
        ? Math.max(
            0,
            Math.min(
                1,
                remainingMs / (configuredSeconds * 1000)
            )
        )
        : 0;

    progress.style.strokeDashoffset = String(
        CIRCUMFERENCE * (1 - fraction)
    );
}

// ==========================================
// ACTUALIZACIÓN VISUAL
// ==========================================

function render() {
    displaySeconds(
        Math.ceil(Math.max(0, remainingMs) / 1000)
    );

    updateProgress();

    minInput.disabled = running;
    secInput.disabled = running;

    addButtons.forEach(button => {
        button.disabled = running;
    });

    playButton.disabled = running || remainingMs <= 0;
    stopButton.disabled = !running;

    playButton.textContent =
        hasStarted && !running
            ? '▶ Continuar'
            : '▶ Play';
}

// ==========================================
// CONTROL DEL CONTADOR
// ==========================================

function stopTicker() {
    if (intervalId !== null) {
        clearInterval(intervalId);
    }

    intervalId = null;
}

function tick() {
    remainingMs = Math.max(
        0,
        deadline - Date.now()
    );

    if (remainingMs === 0) {
        stopTicker();

        running = false;
        hasStarted = false;

        statusLabel.textContent = '¡Tiempo terminado!';

        // Reproducir TAN TAN cuatro veces
        playFinishSound();
    }

    render();
}

// ==========================================
// VALIDACIÓN DE MINUTOS Y SEGUNDOS
// ==========================================

function normalizeInput(input) {
    input.value = input.value.replace(/\D/g, '');

    const limit = input === secInput ? 59 : 9999;

    const value = Math.min(
        Number(input.value || 0),
        limit
    );

    input.value = String(value).padStart(2, '0');

    configuredSeconds = readSeconds();
    remainingMs = configuredSeconds * 1000;

    hasStarted = false;

    startLabel.textContent = '--:--:--';
    endLabel.textContent = '--:--:--';

    statusLabel.textContent = 'Tiempo configurado.';

    stopFinishSound();
    render();
}

[minInput, secInput].forEach(input => {

    input.addEventListener('focus', () => {
        if (!running) input.select();
    });

    input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '');

        if (input.value !== '') {
            const limit = input === secInput ? 59 : 9999;

            if (Number(input.value) > limit) {
                input.value = String(limit);
            }
        }
    });

    input.addEventListener('blur', () => {
        if (!running) normalizeInput(input);
    });

    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            input.blur();
        }

        if (['-', '+', 'e', 'E', '.', ','].includes(event.key)) {
            event.preventDefault();
        }
    });
});

// ==========================================
// BOTONES PARA AÑADIR TIEMPO
// ==========================================

addButtons.forEach(button => {

    button.addEventListener('click', () => {
        if (running) return;

        stopFinishSound();

        configuredSeconds = Math.min(
            MAX_SECONDS,
            readSeconds() + Number(button.dataset.add)
        );

        remainingMs = configuredSeconds * 1000;
        hasStarted = false;

        startLabel.textContent = '--:--:--';
        endLabel.textContent = '--:--:--';

        statusLabel.textContent = 'Tiempo añadido.';

        render();
    });
});

// ==========================================
// BOTÓN PLAY
// ==========================================

playButton.addEventListener('click', () => {
    if (running) return;

    stopFinishSound();
    prepareSound();

    if (!hasStarted) {
        configuredSeconds = readSeconds();
        remainingMs = configuredSeconds * 1000;
    }

    if (remainingMs <= 0) return;

    const now = Date.now();

    if (!hasStarted) {
        startLabel.textContent = formatLima(new Date(now));
        hasStarted = true;
    }

    deadline = now + remainingMs;

    endLabel.textContent = formatLima(
        new Date(deadline)
    );

    running = true;

    statusLabel.textContent = 'Temporizador en marcha.';

    intervalId = setInterval(tick, 100);

    render();
});

// ==========================================
// BOTÓN STOP
// ==========================================

stopButton.addEventListener('click', () => {
    if (!running) return;

    remainingMs = Math.max(
        0,
        deadline - Date.now()
    );

    stopTicker();

    running = false;

    statusLabel.textContent = 'Temporizador pausado.';

    endLabel.textContent = '--:--:--';

    render();
});

// ==========================================
// BOTÓN RESET
// ==========================================

resetButton.addEventListener('click', () => {
    stopTicker();
    stopFinishSound();

    running = false;
    hasStarted = false;

    configuredSeconds = 300;
    remainingMs = configuredSeconds * 1000;

    startLabel.textContent = '--:--:--';
    endLabel.textContent = '--:--:--';

    statusLabel.textContent = 'Temporizador reiniciado.';

    render();
});

// ==========================================
// PANTALLA COMPLETA
// ==========================================

if (btnFullscreen) {

    btnFullscreen.addEventListener('click', async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (error) {
            console.error(
                'No se pudo cambiar a pantalla completa:',
                error
            );
        }
    });

    document.addEventListener('fullscreenchange', () => {
        const activo = Boolean(document.fullscreenElement);

        btnFullscreen.textContent = activo ? '✕' : '⛶';

        btnFullscreen.title = activo
            ? 'Salir de pantalla completa'
            : 'Pantalla completa';

        btnFullscreen.setAttribute(
            'aria-label',
            activo
                ? 'Salir de pantalla completa'
                : 'Activar pantalla completa'
        );
    });
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

progress.style.strokeDasharray = String(CIRCUMFERENCE);

render();