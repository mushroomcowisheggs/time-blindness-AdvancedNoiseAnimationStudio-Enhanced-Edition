// assets/js/main.js
import NoiseGenerator from './classes/NoiseGenerator.js';
import ContentRenderer from './classes/ContentRenderer.js';
import DepthProcessor from './classes/DepthProcessor.js';
import AnimationController from './classes/AnimationController.js';

// === Add FFmpeg local module imports ===
import { FFmpeg } from '@ffmpeg/ffmpeg';
const coreURL = new URL('../../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js', import.meta.url).href;
const wasmURL = new URL('../../node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm', import.meta.url).href;

// === Get Canvas ===
const canvas = document.getElementById('noiseCanvas');
const width = canvas.width;
const height = canvas.height;

// === Instantiate Core Components ===
const noiseGen = new NoiseGenerator(width, height);
const contentRenderer = new ContentRenderer(width, height);
const depthProcessor = new DepthProcessor(width, height);
const controller = new AnimationController(canvas, noiseGen, contentRenderer, depthProcessor);

// Sync initial state to UI default values
noiseGen.refresh('content', 'vertical');

// === General Collapsible Panel ===
window.toggleSection = function(sectionId) {
    const header = document.querySelector(`#${sectionId}Content`).previousElementSibling;
    const content = document.getElementById(`${sectionId}Content`);
    const isCollapsed = content.classList.contains('collapsed');
    if (isCollapsed) {
        content.classList.remove('collapsed');
        header.classList.remove('collapsed');
    } else {
        content.classList.add('collapsed');
        header.classList.add('collapsed');
    }
};

// === Depth Control Events ===
document.querySelectorAll('input[name="depthSource"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        depthProcessor.depthSource = e.target.value;
        document.getElementById('depthImageGroup').style.display = depthProcessor.depthSource === 'image' ? 'block' : 'none';
        document.getElementById('depthVideoGroup').style.display = depthProcessor.depthSource === 'video' ? 'block' : 'none';
    });
});

document.getElementById('depthImageInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    depthProcessor.loadDepthImage(file);
});

document.getElementById('depthVideoInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    depthProcessor.loadDepthVideo(file);
});

document.getElementById('foregroundSpeed').addEventListener('input', (e) => {
    depthProcessor.foregroundSpeed = parseFloat(e.target.value) || 60;
});
document.getElementById('lowerThreshold').addEventListener('input', (e) => {
    depthProcessor.lowerThreshold = parseInt(e.target.value);
    document.getElementById('lowerThresholdValue').textContent = depthProcessor.lowerThreshold;
    if (depthProcessor.lowerThreshold > depthProcessor.upperThreshold) {
        depthProcessor.upperThreshold = depthProcessor.lowerThreshold;
        document.getElementById('upperThreshold').value = depthProcessor.upperThreshold;
        document.getElementById('upperThresholdValue').textContent = depthProcessor.upperThreshold;
    }
});
document.getElementById('upperThreshold').addEventListener('input', (e) => {
    depthProcessor.upperThreshold = parseInt(e.target.value);
    document.getElementById('upperThresholdValue').textContent = depthProcessor.upperThreshold;
    if (depthProcessor.upperThreshold < depthProcessor.lowerThreshold) {
        depthProcessor.lowerThreshold = depthProcessor.upperThreshold;
        document.getElementById('lowerThreshold').value = depthProcessor.lowerThreshold;
        document.getElementById('lowerThresholdValue').textContent = depthProcessor.lowerThreshold;
    }
});
document.getElementById('edgeThreshold').addEventListener('input', (e) => {
    depthProcessor.edgeThreshold = parseInt(e.target.value);
    document.getElementById('edgeThresholdValue').textContent = depthProcessor.edgeThreshold;
});
document.getElementById('depthScale').addEventListener('input', (e) => {
    depthProcessor.depthScale = parseFloat(e.target.value) || 2;
});

// === Content Control Events ===
document.getElementById('contentType').addEventListener('change', (e) => {
    contentRenderer.contentType = e.target.value;
    document.getElementById('textControls').style.display = contentRenderer.contentType === 'text' ? 'block' : 'none';
    document.getElementById('imageControls').style.display = contentRenderer.contentType === 'image' ? 'block' : 'none';
    document.getElementById('shapeControls').style.display = contentRenderer.contentType === 'shape' ? 'block' : 'none';
    document.getElementById('polygonSides').style.display = contentRenderer.contentType === 'shape' && contentRenderer.shapeType === 'polygon' ? 'block' : 'none';
    contentRenderer.contentX = width / 2;
    contentRenderer.contentY = height / 2;
    controller.contentX = width / 2;
    controller.contentY = height / 2;
    contentRenderer.markDirty();
    document.getElementById('contentStatus').classList.add('active');
});

document.getElementById('textInput').addEventListener('input', (e) => {
    contentRenderer.currentText = e.target.value;
    contentRenderer.markDirty();
});
document.getElementById('fontSize').addEventListener('input', (e) => {
    contentRenderer.fontSize = Math.max(5, parseInt(e.target.value));
    contentRenderer.markDirty();
});
document.getElementById('imageInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => {
            contentRenderer.currentImage = img;
            contentRenderer.contentX = width / 2;
            contentRenderer.contentY = height / 2;
            controller.contentX = width / 2;
            controller.contentY = height / 2;
            contentRenderer.markDirty();
        };
        img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
});
document.getElementById('shapeType').addEventListener('change', (e) => {
    contentRenderer.shapeType = e.target.value;
    document.getElementById('polygonSides').style.display = contentRenderer.shapeType === 'polygon' ? 'block' : 'none';
    contentRenderer.markDirty();
});
document.getElementById('shapeSize').addEventListener('input', (e) => {
    contentRenderer.shapeSize = Math.max(10, parseInt(e.target.value));
    contentRenderer.markDirty();
});
document.getElementById('shapeSides').addEventListener('input', (e) => {
    contentRenderer.shapeSides = Math.max(3, parseInt(e.target.value));
    contentRenderer.markDirty();
});
document.getElementById('shapeMoveToggle').addEventListener('change', (e) => {
    controller.shapeMoveEnabled = e.target.checked;
});
document.getElementById('randomPosition').addEventListener('click', () => {
    const cx = Math.random() * width;
    const cy = Math.random() * height;
    contentRenderer.contentX = cx;
    contentRenderer.contentY = cy;
    controller.contentX = cx;
    controller.contentY = cy;
    contentRenderer.markDirty();
});

// === Animation Control Events ===
document.getElementById('animationMode').addEventListener('change', (e) => {
    controller.setAnimationMode(e.target.value);
    controller.refreshNoise();
    // UI linkage
    const isDepth = controller.isDepthAnimationMode;
    ['#rotationSpeed','#scaleFactor','#waveStrength','#pathType','#pathSpeed','#depthScalingToggle',
     '#keyframeParam','#keyframeStart','#keyframeEnd','#keyframeDuration','#keyframeLoop','#applyKeyframe']
        .forEach(sel => { const el = document.querySelector(sel); if (el) el.disabled = isDepth; });
    ['#foregroundSpeed','#lowerThreshold','#upperThreshold','#edgeThreshold','#depthScale']
        .forEach(sel => { const el = document.querySelector(sel); if (el) el.disabled = !isDepth; });
    const contentPanelInputs = document.querySelectorAll('#contentContent input, #contentContent select, #contentContent button');
    contentPanelInputs.forEach(el => el.disabled = isDepth);
    const depthContent = document.getElementById('depthContent');
    const contentContent = document.getElementById('contentContent');
    const depthHeader = depthContent.previousElementSibling;
    const contentHeader = contentContent.previousElementSibling;
    if (isDepth) {
        depthContent.classList.remove('collapsed');
        depthHeader.classList.remove('collapsed');
        contentContent.classList.add('collapsed');
        contentHeader.classList.add('collapsed');
    } else {
        contentContent.classList.remove('collapsed');
        contentHeader.classList.remove('collapsed');
        depthContent.classList.add('collapsed');
        depthHeader.classList.add('collapsed');
    }
});

document.getElementById('backgroundMode').addEventListener('change', (e) => {
    controller.backgroundMode = e.target.value;
});

document.getElementById('movementDirection').addEventListener('change', (e) => {
    controller.movementDirection = e.target.value;
    controller.backgroundOffset = 0;
    controller.foregroundOffset = 0;
    controller.refreshNoise();
});

document.getElementById('animationSpeed').addEventListener('input', (e) => {
    controller.animationSpeed = parseFloat(e.target.value) || 2;
});

document.getElementById('backgroundDensity').addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    noiseGen.backgroundDensity = value / 100;
    document.getElementById('backgroundDensityValue').textContent = value + '%';
    controller.refreshNoise();
});
document.getElementById('foregroundDensity').addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    noiseGen.foregroundDensity = value / 100;
    document.getElementById('foregroundDensityValue').textContent = value + '%';
    controller.refreshNoise();
});

// Noise Type
document.getElementById('noiseType').addEventListener('change', (e) => {
    noiseGen.noiseType = e.target.value;
    document.querySelectorAll('.noise-parameters-group').forEach(g => g.style.display = 'none');
    const activeGroup = document.getElementById(e.target.value + 'Parameters');
    if (activeGroup) activeGroup.style.display = 'block';
    document.getElementById('foregroundDensity').disabled = (e.target.value === 'colourful');
    controller.refreshNoise();
});

// Perlin Parameters
document.getElementById('perlinFrequency').addEventListener('input', (e) => {
    noiseGen.perlinFrequency = parseFloat(e.target.value);
    document.getElementById('perlinFrequencyValue').textContent = noiseGen.perlinFrequency.toFixed(3);
    controller.refreshNoise();
});
document.getElementById('perlinAmplitude').addEventListener('input', (e) => {
    noiseGen.perlinAmplitude = parseInt(e.target.value);
    document.getElementById('perlinAmplitudeValue').textContent = noiseGen.perlinAmplitude;
    controller.refreshNoise();
});
document.getElementById('perlinOctaves').addEventListener('input', (e) => {
    noiseGen.perlinOctaves = Math.max(1, parseInt(e.target.value));
    controller.refreshNoise();
});
document.getElementById('perlinPersistence').addEventListener('input', (e) => {
    noiseGen.perlinPersistence = parseFloat(e.target.value);
    document.getElementById('perlinPersistenceValue').textContent = noiseGen.perlinPersistence.toFixed(2);
    controller.refreshNoise();
});

// Gradient Parameters
document.getElementById('gradientDirection').addEventListener('change', (e) => {
    noiseGen.gradientDirection = e.target.value;
    controller.refreshNoise();
});
document.getElementById('gradientMin').addEventListener('input', (e) => {
    noiseGen.gradientMin = parseInt(e.target.value);
    document.getElementById('gradientMinValue').textContent = noiseGen.gradientMin;
    controller.refreshNoise();
});
document.getElementById('gradientMax').addEventListener('input', (e) => {
    noiseGen.gradientMax = parseInt(e.target.value);
    document.getElementById('gradientMaxValue').textContent = noiseGen.gradientMax;
    controller.refreshNoise();
});

// Colourful
document.getElementById('colourfulDensity').addEventListener('input', (e) => {
    noiseGen.colourfulDensity = parseInt(e.target.value) / 100;
    document.getElementById('colourfulDensityValue').textContent = (noiseGen.colourfulDensity * 100) + '%';
    controller.refreshNoise();
});

// Dynamic
document.getElementById('dynamicFrequencyX').addEventListener('input', (e) => {
    noiseGen.dynamicFrequencyX = parseFloat(e.target.value);
    controller.refreshNoise();
});
document.getElementById('dynamicFrequencyY').addEventListener('input', (e) => {
    noiseGen.dynamicFrequencyY = parseFloat(e.target.value);
    controller.refreshNoise();
});
document.getElementById('dynamicSpeed').addEventListener('input', (e) => {
    noiseGen.dynamicSpeed = parseFloat(e.target.value);
    controller.refreshNoise();
});
document.getElementById('dynamicAmplitude').addEventListener('input', (e) => {
    noiseGen.dynamicAmplitude = parseInt(e.target.value);
    controller.refreshNoise();
});

// Foreground Color Mode
document.getElementById('foregroundColorMode').addEventListener('change', (e) => {
    controller.foregroundColorMode = e.target.value;
    document.getElementById('foregroundHslControls').style.display = e.target.value === 'hsl' ? 'block' : 'none';
    document.getElementById('gradientMapControls').style.display = e.target.value === 'gradient' ? 'block' : 'none';
});
document.getElementById('foregroundHue').addEventListener('input', (e) => {
    controller.foregroundHue = parseInt(e.target.value);
    document.getElementById('foregroundHueValue').textContent = controller.foregroundHue;
});
document.getElementById('foregroundSat').addEventListener('input', (e) => {
    controller.foregroundSat = parseInt(e.target.value);
    document.getElementById('foregroundSatValue').textContent = controller.foregroundSat;
});
document.getElementById('foregroundLight').addEventListener('input', (e) => {
    controller.foregroundLight = parseInt(e.target.value);
    document.getElementById('foregroundLightValue').textContent = controller.foregroundLight;
});
document.getElementById('gradStart').addEventListener('input', (e) => { controller.gradStart = e.target.value; });
document.getElementById('gradEnd').addEventListener('input', (e) => { controller.gradEnd = e.target.value; });
document.getElementById('blendMode').addEventListener('change', (e) => { controller.blendMode = e.target.value; });

document.getElementById('speckleSize').addEventListener('input', (e) => {
    noiseGen.speckleSize = Math.max(1, parseInt(e.target.value));
    controller.refreshNoise();
});

document.getElementById('removeBackgroundNoise').addEventListener('change', (e) => {
    controller.removeBackgroundNoise = e.target.checked;
    document.getElementById('backgroundColorGroup').style.display = controller.removeBackgroundNoise ? 'flex' : 'none';
});
document.getElementById('backgroundColor').addEventListener('input', (e) => { controller.backgroundColor = e.target.value; });
document.getElementById('depthThreshold').addEventListener('input', (e) => {
    controller.depthThreshold = parseInt(e.target.value);
    document.getElementById('depthThresholdValue').textContent = controller.depthThreshold;
});

// Pause
function togglePause() {
    const depthVideo = depthProcessor && depthProcessor.depthVideo ? depthProcessor.depthVideo : null;
    if (controller.isPaused) {
        controller.resume();
        document.querySelector('#canvasPauseButton span:not(.btn-icon)').textContent = 'Pause';
        document.querySelector('#canvasPauseButton .btn-icon').textContent = '⏸';
        document.getElementById('animationStatus').classList.add('active');
        // resume depth video only if it was playing before pause
        try {
            if (depthVideo && window._depthVideoWasPlaying) {
                depthVideo.play().catch(() => {});
            }
        } catch (e) {}
        window._depthVideoWasPlaying = false;
    } else {
        // remember whether depth video was playing so we can restore on resume
        try {
            window._depthVideoWasPlaying = !!(depthVideo && !depthVideo.paused && !depthVideo.ended);
            if (depthVideo) depthVideo.pause();
        } catch (e) { window._depthVideoWasPlaying = false; }
        
        controller.pause();
        document.querySelector('#canvasPauseButton span:not(.btn-icon)').textContent = 'Resume';
        document.querySelector('#canvasPauseButton .btn-icon').textContent = '▶';
        document.getElementById('animationStatus').classList.remove('active');
    }
}
document.getElementById('canvasPauseButton').addEventListener('click', togglePause);

// Recording (keep it simple, based on controller's canvas)
let isRecording = false;
let quickExportActive = false;
let mediaRecorder = null;
let recordTimer = null;
let recordedChunks = [];
function stopRecording() {
    if (recordTimer) { clearTimeout(recordTimer); recordTimer = null; }
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
}
function startRecording() {
    const durationSeconds = parseFloat(document.getElementById('recordDuration').value) || 5;
    const stream = canvas.captureStream(60);
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'noise-animation.webm';
        a.click();
        URL.revokeObjectURL(url);
        isRecording = false;
        const btn = document.getElementById('recordButton');
        btn.querySelector('span:not(.btn-icon)').textContent = 'Record';
        btn.querySelector('.btn-icon').textContent = '●';
        btn.classList.remove('recording');
        document.getElementById('recordingStatus').classList.remove('active');
        if (quickExportActive) {
            quickExportBtn.querySelector('span:last-child').textContent = 'Quick Export';
            quickExportBtn.classList.remove('recording');
            quickExportActive = false;
        }
    };
    isRecording = true;
    mediaRecorder.start();
    const btn = document.getElementById('recordButton');
    btn.querySelector('span:not(.btn-icon)').textContent = 'Recording...';
    btn.querySelector('.btn-icon').textContent = '⏹';
    btn.classList.add('recording');
    document.getElementById('recordingStatus').classList.add('active');
    recordTimer = setTimeout(() => {
        if (isRecording && mediaRecorder?.state === 'recording') stopRecording();
    }, durationSeconds * 1000);
}
document.getElementById('recordButton').addEventListener('click', () => {
    if (isRecording) stopRecording(); else startRecording();
});

// === Quick Export Button ===
const quickExportBtn = document.getElementById('quickExportButton');
const quickExportDurationSelect = document.getElementById('quickExportDuration');
quickExportBtn.addEventListener('click', () => {
    if (isRecording && !quickExportActive) {
        alert('Please stop the current recording before starting a quick export.');
        return;
    }
    if (quickExportActive) {
        stopRecording();
        return;
    }
    const dur = parseInt(quickExportDurationSelect.value) || 10;
    document.getElementById('recordDuration').value = dur;
    quickExportActive = true;
    startRecording();
    quickExportBtn.querySelector('span:last-child').textContent = 'Cancel Export';
    quickExportBtn.classList.add('recording');
});

// Transformation Parameters
document.getElementById('rotationSpeed').addEventListener('input', (e) => { controller.rotationSpeed = parseFloat(e.target.value); });
document.getElementById('scaleFactor').addEventListener('input', (e) => {
    controller.scaleFactor = parseFloat(e.target.value);
    document.getElementById('scaleValue').textContent = controller.scaleFactor.toFixed(2);
});
document.getElementById('depthScalingToggle').addEventListener('change', (e) => { controller.useDepthScaling = e.target.checked; });
document.getElementById('waveStrength').addEventListener('input', (e) => {
    controller.waveStrength = parseFloat(e.target.value);
    document.getElementById('waveStrengthValue').textContent = controller.waveStrength;
});
document.getElementById('pathType').addEventListener('change', (e) => {
    controller.pathType = e.target.value;
    controller.pathAngle = 0;
    document.getElementById('shapeMoveToggle').disabled = e.target.value !== 'none';
});
document.getElementById('pathSpeed').addEventListener('input', (e) => { controller.pathSpeed = parseFloat(e.target.value); });

// Keyframes
document.getElementById('applyKeyframe').addEventListener('click', () => {
    const param = document.getElementById('keyframeParam').value;
    const start = parseFloat(document.getElementById('keyframeStart').value);
    const end = parseFloat(document.getElementById('keyframeEnd').value);
    const duration = parseFloat(document.getElementById('keyframeDuration').value);
    const loop = document.getElementById('keyframeLoop').checked;
    controller.keyframeAnimations[param] = { start, end, duration, loop };
    controller.keyframeStartTime = null;
});

// === Initialization Startup ===
controller.start();
document.getElementById('depthStatus').classList.add('active');
document.getElementById('contentStatus').classList.add('active');

// Trigger UI linkage based on default animation mode
document.getElementById('animationMode').dispatchEvent(new Event('change'));
noiseGen.refresh('content', 'vertical');

// Depth audio toggle (playback only). Default: muted
window.depthAudioMuted = true;
const depthAudioBtn = document.getElementById('depthAudioToggle');
function updateDepthAudioButton() {
    if (!depthAudioBtn) return;
    const icon = depthAudioBtn.querySelector('.btn-icon');
    const label = depthAudioBtn.querySelector('span:last-child');
    if (window.depthAudioMuted) {
        if (icon) icon.textContent = '🔇';
        if (label) label.textContent = 'Muted';
    } else {
        if (icon) icon.textContent = '🔊';
        if (label) label.textContent = 'Unmuted';
    }
}
if (depthAudioBtn) {
    updateDepthAudioButton();
    depthAudioBtn.addEventListener('click', () => {
        window.depthAudioMuted = !window.depthAudioMuted;
        try {
            if (depthProcessor && depthProcessor.depthVideo) depthProcessor.depthVideo.muted = window.depthAudioMuted;
        } catch (e) {}
        updateDepthAudioButton();
    });
}

// === High‑quality MP4 export (offscreen canvas + local ffmpeg.wasm) ===

let ffmpegInstance = null;
let ffmpegLoading = false;
let ffmpegLoaded = false;

// Keep a single FFmpeg instance for the batch export lifetime to avoid
// re-instantiation (which commonly triggers WASM OOM in browsers).
// Only use FFmpeg for Batch Export
async function loadFFmpeg() {
    if (ffmpegLoaded) return;
    if (ffmpegLoading) {
        return new Promise(resolve => {
            const check = setInterval(() => {
                if (ffmpegLoaded) { clearInterval(check); resolve(); }
            }, 200);
        });
    }
    ffmpegLoading = true;
    try {
        ffmpegInstance = new FFmpeg();
        ffmpegInstance.on('log', ({ message }) => console.log('[ffmpeg]', message));
        // Load using locally bundled core files
        await ffmpegInstance.load({ coreURL, wasmURL });
        ffmpegLoaded = true;
        await ensureDirectoryEmpty('/output');
        await ensureDirectoryEmpty('/input');
    } catch (e) {
        console.error('Failed to load FFmpeg:', e);
        alert('Failed to load FFmpeg.wasm. This may be due to browser WASM memory limits. Try smaller batch sizes or run encoding on a native/server FFmpeg.');
        throw e;
    } finally {
        ffmpegLoading = false;
    }
}

async function removeDirContents(path) {
    try {
        const entries = await ffmpegInstance.listDir(path);
        for (const entry of entries) {
            if (entry.name === '.' || entry.name === '..') continue;
            const fullPath = `${path}/${entry.name}`;
            if (entry.isDir) {
                await removeDirContents(fullPath);
                await ffmpegInstance.deleteDir(fullPath);
            } else {
                await ffmpegInstance.deleteFile(fullPath);
            }
        }
    } catch (e) {
        // Directory may not exist yet or may already be empty.
    }
}

async function ensureDirectoryEmpty(path) {
    await removeDirContents(path);
    try {
        await ffmpegInstance.createDir(path);
    } catch (e) {
        // Ignore if the directory already exists.
    }
}

// Attempt to fully unload FFmpeg.wasm to free WASM heap between chunks.
async function unloadFFmpeg() {
    if (!ffmpegInstance) return;
    try {
        // remove any files to reduce FS memory held by the module
        await removeDirContents('/output');
        await removeDirContents('/input');
    } catch (e) {
        // ignore
    }
    try {
        if (typeof ffmpegInstance.exit === 'function') {
            await ffmpegInstance.exit();
        } else if (typeof ffmpegInstance.close === 'function') {
            await ffmpegInstance.close();
        }
    } catch (e) {
        console.warn('FFmpeg unload failed:', e);
    }
    ffmpegInstance = null;
    ffmpegLoaded = false;
    // yield to event loop to give GC a chance
    await new Promise(r => setTimeout(r, 50));
}

// Reliable seek: waits for 'seeked' event and verifies frame is ready
function seekDepthVideo(video, timeInSeconds) {
    return new Promise((resolve) => {
        if (!video || video.readyState < 2) { resolve(); return; }
        const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            if (!video.seeking && video.readyState >= 2) {
                resolve();
            } else {
                setTimeout(resolve, 50);
            }
        };
        video.addEventListener('seeked', onSeeked);
        video.currentTime = timeInSeconds;
        setTimeout(() => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
        }, 2000);
    });
}

async function startHQExport(durationSeconds) {
    if (!ffmpegLoaded) {
        await loadFFmpeg();
        if (!ffmpegLoaded) return;
    }

    const hqBtn = document.getElementById('hqExportButton');
    const progressContainer = document.getElementById('hqProgressContainer');
    const progressBar = document.getElementById('hqProgressBar');
    const progressText = document.getElementById('hqProgressText');

    // 1. Pause main animation (state remains unchanged)
    const wasPaused = controller.isPaused;
    if (!wasPaused) controller.pause();

    // 2. Create offscreen canvas
    const offCanvas = document.createElement('canvas');
    offCanvas.width = canvas.width;
    offCanvas.height = canvas.height;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    // 3. Swap controller target to offscreen canvas
    const origCanvas = controller.canvas;
    const origCtx = controller.ctx;
    controller.canvas = offCanvas;
    controller.ctx = offCtx;

    // 4. Prevent new rAF loops
    const origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = () => 0;

    // 5. Allow manual _animate calls
    controller.isPaused = false;
    controller.animationFrameId = null;

    // 6. Handle depth video source
    const isDepthMode = controller.animationMode === 'depth';
    const depthVideo = (isDepthMode && depthProcessor.depthSource === 'video')
        ? depthProcessor.depthVideo
        : null;

    let origVideoTime = 0;
    let origVideoPaused = true;
    if (depthVideo) {
        origVideoTime = depthVideo.currentTime;
        origVideoPaused = depthVideo.paused;
        depthVideo.pause();
    }

    // 7. Capture settings
    const fps = 30;
    const totalFrames = Math.ceil(durationSeconds * fps);
    const frameInterval = 1000 / fps;
    const baseTime = performance.now();

    controller.startTime = baseTime;
    controller.lastTimestamp = baseTime;

    // UI state
    hqBtn.disabled = true;
    hqBtn.querySelector('span:last-child').textContent = 'Processing...';
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = 'Capturing frames 0%';

    await ensureDirectoryEmpty('/input');
    await ensureDirectoryEmpty('/output');

    // 8. Frame capture loop
    for (let i = 0; i < totalFrames; i++) {
        const frameTimeSeconds = (i * frameInterval) / 1000;
        const fakeTimestamp = baseTime + i * frameInterval;

        if (depthVideo) {
            await seekDepthVideo(depthVideo, frameTimeSeconds);
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        controller._animate(fakeTimestamp);
        const dataURL = offCanvas.toDataURL('image/png');
        await writeFrameToFFmpeg(dataURL, i);

        const percent = Math.round(((i + 1) / totalFrames) * 100);
        progressBar.style.width = percent + '%';
        progressText.textContent = `Capturing frame ${i + 1}/${totalFrames} (${percent}%)`;
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    // 9. Restore controller
    controller.canvas = origCanvas;
    controller.ctx = origCtx;
    window.requestAnimationFrame = origRAF;
    controller.startTime = null;
    controller.lastTimestamp = null;
    controller.isPaused = true;
    controller.animationFrameId = null;

    if (depthVideo) {
        try {
            if (!origVideoPaused) {
                depthVideo.currentTime = origVideoTime;
                depthVideo.play();
            } else {
                depthVideo.currentTime = origVideoTime;
            }
        } catch(e) {}
    }

    // 10. Encode video
    progressText.textContent = 'Encoding video...';
    try {
        await ffmpegInstance.exec([
            '-framerate', String(fps),
            '-i', '/input/frame%05d.png',
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
            '-pix_fmt', 'yuv420p',
            '/output/output.mp4'
        ]);
    } catch (e) {
        console.error('Encoding failed:', e);
        alert('Video encoding failed. Please try again.');
        finishExport(wasPaused, hqBtn, progressContainer);
        return;
    }

    // 11. Download
    try {
        progressText.textContent = 'Downloading video...';
        const blob = await readOutputFile('output.mp4');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `noise-animation-${durationSeconds}s.mp4`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Download failed:', e);
        alert('Video download failed. Please try again.');
        finishExport(wasPaused, hqBtn, progressContainer);
        return;
    }

    // 12. Cleanup
    try {
        await removeDirContents('/output');
        await removeDirContents('/input');
    } catch (e) {
        console.debug('Cleanup warning (non-critical):', e);
    }

    finishExport(wasPaused, hqBtn, progressContainer);
}


function finishExport(wasPaused, btn, progressContainer) {
    progressContainer.style.display = 'none';
    btn.disabled = false;
    btn.querySelector('span:last-child').textContent = 'Export HQ';
    if (!wasPaused) controller.resume();
}

// ----- Batch export and reusable export helper -----
let batchInProgress = false;

async function exportVideoFromCurrentState(durationSeconds, outputFileName, progressCallback) {
    if (!ffmpegLoaded) await loadFFmpeg();
    if (!ffmpegLoaded) throw new Error('FFmpeg not loaded');

    const wasPaused = controller.isPaused;
    if (!wasPaused) controller.pause();

    const offCanvas = document.createElement('canvas');
    offCanvas.width = canvas.width;
    offCanvas.height = canvas.height;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    const origCanvas = controller.canvas;
    const origCtx = controller.ctx;
    controller.canvas = offCanvas;
    controller.ctx = offCtx;

    const origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = () => 0;

    controller.isPaused = false;
    controller.animationFrameId = null;

    const depthVideo = (controller.animationMode === 'depth' && depthProcessor.depthSource === 'video')
        ? depthProcessor.depthVideo
        : null;
    let origVideoTime = 0, origVideoPaused = true;
    if (depthVideo) {
        origVideoTime = depthVideo.currentTime;
        origVideoPaused = depthVideo.paused;
        depthVideo.pause();
    }

    const fps = 30;
    const totalFrames = Math.ceil(durationSeconds * fps);
    const frameInterval = 1000 / fps;
    const baseTime = performance.now();
    controller.startTime = baseTime;
    controller.lastTimestamp = baseTime;

    await ensureDirectoryEmpty('/input');
    await ensureDirectoryEmpty('/output');

    for (let i = 0; i < totalFrames; i++) {
        const frameTimeSeconds = (i * frameInterval) / 1000;
        const fakeTimestamp = baseTime + i * frameInterval;

        if (depthVideo) {
            await seekDepthVideo(depthVideo, frameTimeSeconds);
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        controller._animate(fakeTimestamp);
        const dataURL = offCanvas.toDataURL('image/png');
        await writeFrameToFFmpeg(dataURL, i);

        if (typeof progressCallback === 'function') {
            const percent = Math.round(((i + 1) / totalFrames) * 100);
            progressCallback(percent, `Capturing frame ${i+1}/${totalFrames} (${percent}%)`);
        }

        await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Restore
    controller.canvas = origCanvas;
    controller.ctx = origCtx;
    window.requestAnimationFrame = origRAF;
    controller.startTime = null;
    controller.lastTimestamp = null;
    controller.isPaused = true;
    controller.animationFrameId = null;

    if (depthVideo) {
        try {
            depthVideo.currentTime = origVideoTime;
            if (!origVideoPaused) depthVideo.play().catch(() => {});
        } catch(e) {}
    }

    // Encode
    await ffmpegInstance.exec([
        '-framerate', String(fps),
        '-i', '/input/frame%05d.png',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
        '-pix_fmt', 'yuv420p',
        '/output/output.mp4'
    ]);

    const blob = await readOutputFile('output.mp4');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputFileName;
    a.click();
    URL.revokeObjectURL(url);

    try {
        await removeDirContents('/output');
        await removeDirContents('/input');
        // attempt to remove any leftover FS root entries to reduce memory pressure
        try { await ffmpegInstance.deleteFile('/output/output.mp4'); } catch (e) {}
        try { await ffmpegInstance.deleteFile('/input/frame00000.png'); } catch (e) {}
    } catch (e) {
        console.debug('Cleanup warning (non-critical):', e);
    }

    if (!wasPaused) controller.resume();
}

// Helper: load Image from File
function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Batch export images: images (File[]), mode = 'content'|'depth'
async function batchExportImages(images, mode, durationSeconds) {
    if (!ffmpegLoaded) await loadFFmpeg();
    if (!ffmpegLoaded) return;

    const total = images.length;
    if (total === 0) return;

    const progressDiv = document.getElementById('batchProgressContainer');
    const progressBar = document.getElementById('batchProgressBar');
    const progressText = document.getElementById('batchProgressText');
    progressDiv.style.display = 'block';
    batchInProgress = true;

    // Save original state
    const originalContentImage = contentRenderer.currentImage;
    const originalDepthImageData = depthProcessor.depthImageData;
    const originalIsPaused = controller.isPaused;

    if (!originalIsPaused) controller.pause();

    // Chunking: process in batches to reduce memory pressure and allow user control.
    const CHUNK_SIZE = 25; // default files per chunk (tunable)
    const numChunks = Math.ceil(total / CHUNK_SIZE);
    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, total);
        for (let i = start; i < end; i++) {
        const file = images[i];
        const percent = Math.round((i / total) * 100);
        progressBar.style.width = percent + '%';
        progressText.innerText = `Processing ${i+1}/${total}: ${file.name} (${percent}%)`;

        if (mode === 'content') {
            const img = await loadImageFromFile(file);
            contentRenderer.currentImage = img;
            contentRenderer.markDirty();
            if (contentRenderer.contentType !== 'image') {
                contentRenderer.contentType = 'image';
                document.getElementById('contentType').value = 'image';
            }
        } else {
            // Depth mode
            try {
                await depthProcessor.loadDepthImage(file);
            } catch (e) {
                console.warn('Failed to load depth image for', file.name, e);
            }
        }

        controller.refreshNoise();
        controller.startTime = null;
        controller.depthVideoSyncBaseTime = null;

        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const outputName = `${baseName}_${mode}_${durationSeconds}s.mp4`;

        // per-file progress callback
        const progressCallback = (pct, text) => {
            progressBar.style.width = Math.round(((i + pct/100) / total) * 100) + '%';
            progressText.innerText = `${file.name} — ${text}`;
        };

        try {
            await exportVideoFromCurrentState(durationSeconds, outputName, progressCallback);
        } catch (e) {
            console.error('Batch export failed for', file.name, e);
            progressText.innerText = `Failed: ${file.name}`;
        }

        // continue to next file; we keep the FFmpeg instance alive for the whole batch
        }

        // After finishing this chunk, automatically continue to the next chunk.
        // To mitigate WASM heap pressure we attempt to fully unload and reload
        // the FFmpeg instance between chunks (if the environment supports it).
        if (chunkIndex < numChunks - 1) {
            try {
                await unloadFFmpeg();
                // short pause to let the engine tear down
                await new Promise(r => setTimeout(r, 100));
                await loadFFmpeg();
            } catch (e) {
                console.warn('Failed to reload FFmpeg between chunks:', e);
                // if reload fails, continue with the existing instance (if any)
            }
        }
    }

    // Restore originals
    if (mode === 'content') {
        contentRenderer.currentImage = originalContentImage;
        contentRenderer.markDirty();
    } else {
        depthProcessor.depthImageData = originalDepthImageData;
    }
    if (!originalIsPaused) controller.resume();

    progressBar.style.width = '100%';
    progressText.innerText = `Batch export complete — ${total} videos.`;
    setTimeout(() => { progressDiv.style.display = 'none'; }, 3000);
    batchInProgress = false;
}

// Bind the button (only once)
const hqExportBtn = document.getElementById('hqExportButton');
if (hqExportBtn && !hqExportBtn._hqExportBound) {
    hqExportBtn._hqExportBound = true;
    hqExportBtn.addEventListener('click', () => {
        const dur = parseInt(document.getElementById('hqExportDuration').value) || 10;
        startHQExport(dur);
    });
}

// Bind batch export button
const batchBtn = document.getElementById('batchExportButton');
if (batchBtn && !batchBtn._batchBound) {
    batchBtn._batchBound = true;
    batchBtn.addEventListener('click', async () => {
        if (batchInProgress) {
            alert('Batch export already in progress, please wait.');
            return;
        }
        const fileInput = document.getElementById('batchImageInput');
        const files = fileInput ? Array.from(fileInput.files) : [];
        if (!files || files.length === 0) {
            alert('Please select at least one image for batch export.');
            return;
        }
        const mode = document.getElementById('batchMode').value;
        const duration = parseInt(document.getElementById('batchDuration').value) || 10;
        await batchExportImages(files, mode, duration);
    });
}

// Helper: write a dataURL frame into FFmpeg's virtual FS
async function writeFrameToFFmpeg(dataURL, index) {
    if (!ffmpegInstance) throw new Error('FFmpeg not initialized');
    const name = `/input/frame${String(index).padStart(5, '0')}.png`;
    try {
        const resp = await fetch(dataURL);
        const ab = await resp.arrayBuffer();
        const uint8 = new Uint8Array(ab);
        if (typeof ffmpegInstance.FS === 'function') {
            ffmpegInstance.FS('writeFile', name, uint8);
        } else if (typeof ffmpegInstance.writeFile === 'function') {
            await ffmpegInstance.writeFile(name, uint8);
        } else {
            throw new Error('No FS write API available on ffmpegInstance');
        }
    } catch (e) {
        console.error('Failed to write frame to FFmpeg FS:', e);
        throw e;
    }
}

// Helper: read an output file from FFmpeg's FS and return a Blob
async function readOutputFile(path) {
    if (!ffmpegInstance) throw new Error('FFmpeg not initialized');
    try {
        let data;
        if (typeof ffmpegInstance.FS === 'function') {
            data = ffmpegInstance.FS('readFile', `/output/${path}`);
        } else if (typeof ffmpegInstance.readFile === 'function') {
            data = await ffmpegInstance.readFile(`/output/${path}`);
        } else {
            throw new Error('No FS read API available on ffmpegInstance');
        }
        return new Blob([data], { type: path.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream' });
    } catch (e) {
        console.error('Failed to read output file from FFmpeg FS:', e);
        throw e;
    }
}