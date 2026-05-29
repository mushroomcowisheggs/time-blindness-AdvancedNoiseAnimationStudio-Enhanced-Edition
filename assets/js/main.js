// assets/js/main.js
import NoiseGenerator from './classes/NoiseGenerator.js';
import ContentRenderer from './classes/ContentRenderer.js';
import DepthProcessor from './classes/DepthProcessor.js';
import AnimationController from './classes/AnimationController.js';
import eventBus from './classes/EventBus.js';
import animationState from './classes/AnimationState.js';
import Scheduler from './classes/Scheduler.js';
import ExportService from './classes/ExportService.js';
import FFmpegService from './classes/FFmpegService.js';
import UIController from './classes/UIController.js';
import BatchProcessor from './classes/BatchProcessor.js';

// === Add FFmpeg local module imports ===
import { FFmpeg } from '@ffmpeg/ffmpeg';
// Use absolute paths so dev server can serve the ffmpeg core files reliably
const coreURL = new URL('/node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js', import.meta.url).href;
const wasmURL = new URL('/node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm', import.meta.url).href;

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

// Subscribe to state changes and let the controller react to relevant updates
eventBus.on('state:change', ({ key, val }) => {
    // Central mapping from state keys -> component updates (keeps compatibility)
    switch (key) {
        case 'animationMode':
            controller.setAnimationMode(val);
            controller.refreshNoise();
            {
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
            }
            break;
        case 'backgroundMode':
            controller.backgroundMode = val;
            break;
        case 'movementDirection':
            controller.movementDirection = val;
            controller.backgroundOffset = 0;
            controller.foregroundOffset = 0;
            controller.refreshNoise();
            break;
        case 'animationSpeed':
            controller.animationSpeed = val;
            break;
        case 'backgroundDensity':
            noiseGen.backgroundDensity = val;
            controller.refreshNoise();
            break;
        case 'foregroundDensity':
            noiseGen.foregroundDensity = val;
            controller.refreshNoise();
            break;
        case 'noiseType':
            noiseGen.noiseType = val;
            document.querySelectorAll('.noise-parameters-group').forEach(g => g.style.display = 'none');
            const activeGroup = document.getElementById(val + 'Parameters');
            if (activeGroup) { activeGroup.style.display = 'block'; }
            document.getElementById('foregroundDensity').disabled = (val === 'colourful');
            
            // If not gradient, force to close unifiedGradient and corresponding UI
            if (val !== 'gradient' && controller.unifiedGradient) {
                animationState.set('unifiedGradient', false);
                const unifiedToggle = document.getElementById('unifiedGradientToggle');
                if (unifiedToggle) { unifiedToggle.checked = false; }
            }
            
            controller.refreshNoise();
            break;
        // Perlin
        case 'perlinFrequency': noiseGen.perlinFrequency = val; controller.refreshNoise(); break;
        case 'perlinAmplitude': noiseGen.perlinAmplitude = val; controller.refreshNoise(); break;
        case 'perlinOctaves': noiseGen.perlinOctaves = val; controller.refreshNoise(); break;
        case 'perlinPersistence': noiseGen.perlinPersistence = val; controller.refreshNoise(); break;
        // Gradient
        case 'gradientDirection': noiseGen.gradientDirection = val; controller.refreshNoise(); break;
        case 'gradientMin': noiseGen.gradientMin = val; controller.refreshNoise(); break;
        case 'gradientMax': noiseGen.gradientMax = val; controller.refreshNoise(); break;
        case 'gradientRawMode':
            noiseGen.gradientRawMode = val;
            controller.refreshNoise();   // regenerate background/foreground noise arrays
            break;
        case 'unifiedGradient':
            controller.unifiedGradient = val;
            // no need to refresh noise, just re-render (happens automatically)
            break;
        case 'unifiedGradient': controller.unifiedGradient = val; break;
        // Colourful
        case 'colourfulDensity': noiseGen.colourfulDensity = val; controller.refreshNoise(); break;
        // Dynamic
        case 'dynamicFrequencyX': noiseGen.dynamicFrequencyX = val; controller.refreshNoise(); break;
        case 'dynamicFrequencyY': noiseGen.dynamicFrequencyY = val; controller.refreshNoise(); break;
        case 'dynamicSpeed': noiseGen.dynamicSpeed = val; controller.refreshNoise(); break;
        case 'dynamicAmplitude': noiseGen.dynamicAmplitude = val; controller.refreshNoise(); break;
        // Foreground color
        case 'foregroundColorMode': controller.foregroundColorMode = val; document.getElementById('foregroundHslControls').style.display = val === 'hsl' ? 'block' : 'none'; document.getElementById('gradientMapControls').style.display = val === 'gradient' ? 'block' : 'none'; break;
        case 'foregroundHue': controller.foregroundHue = val; break;
        case 'foregroundSat': controller.foregroundSat = val; break;
        case 'foregroundLight': controller.foregroundLight = val; break;
        case 'gradStart': controller.gradStart = val; break;
        case 'gradEnd': controller.gradEnd = val; break;
        case 'blendMode': controller.blendMode = val; break;
        case 'speckleSize': noiseGen.speckleSize = val; controller.refreshNoise(); break;
        case 'removeBackgroundNoise': controller.removeBackgroundNoise = val; document.getElementById('backgroundColorGroup').style.display = val ? 'flex' : 'none'; break;
        case 'backgroundColor': controller.backgroundColor = val; break;
        case 'depthThreshold': controller.depthThreshold = val; break;
        // Transform / animation
        case 'rotationSpeed': controller.rotationSpeed = val; break;
        case 'scaleFactor': controller.scaleFactor = val; break;
        case 'depthScalingToggle': controller.useDepthScaling = val; break;
        case 'waveStrength': controller.waveStrength = val; break;
        case 'pathType': controller.pathType = val; controller.pathAngle = 0; document.getElementById('shapeMoveToggle').disabled = val !== 'none'; break;
        case 'pathSpeed': controller.pathSpeed = val; break;
        // Depth processor specific
        case 'depthSource': depthProcessor.depthSource = val; document.getElementById('depthImageGroup').style.display = val === 'image' ? 'block' : 'none'; document.getElementById('depthVideoGroup').style.display = val === 'video' ? 'block' : 'none'; break;
        case 'foregroundSpeed': depthProcessor.foregroundSpeed = val; break;
        case 'lowerThreshold': depthProcessor.lowerThreshold = val; document.getElementById('lowerThresholdValue').textContent = depthProcessor.lowerThreshold; break;
        case 'upperThreshold': depthProcessor.upperThreshold = val; document.getElementById('upperThresholdValue').textContent = depthProcessor.upperThreshold; break;
        case 'edgeThreshold': depthProcessor.edgeThreshold = val; document.getElementById('edgeThresholdValue').textContent = depthProcessor.edgeThreshold; break;
        case 'depthScale': depthProcessor.depthScale = val; break;
        // Content
        case 'contentType': contentRenderer.contentType = val; document.getElementById('textControls').style.display = contentRenderer.contentType === 'text' ? 'block' : 'none'; document.getElementById('imageControls').style.display = contentRenderer.contentType === 'image' ? 'block' : 'none'; document.getElementById('shapeControls').style.display = contentRenderer.contentType === 'shape' ? 'block' : 'none'; document.getElementById('polygonSides').style.display = contentRenderer.contentType === 'shape' && contentRenderer.shapeType === 'polygon' ? 'block' : 'none'; contentRenderer.contentX = width/2; contentRenderer.contentY = height/2; controller.contentX = width/2; controller.contentY = height/2; contentRenderer.markDirty(); document.getElementById('contentStatus').classList.add('active'); break;
        case 'textInput': contentRenderer.currentText = val; contentRenderer.markDirty(); break;
        case 'fontSize': contentRenderer.fontSize = val; contentRenderer.markDirty(); break;
        case 'shapeType': contentRenderer.shapeType = val; document.getElementById('polygonSides').style.display = contentRenderer.shapeType === 'polygon' ? 'block' : 'none'; contentRenderer.markDirty(); break;
        case 'shapeSize': contentRenderer.shapeSize = val; contentRenderer.markDirty(); break;
        case 'shapeSides': contentRenderer.shapeSides = val; contentRenderer.markDirty(); break;
        case 'shapeMoveToggle': controller.shapeMoveEnabled = val; break;
        case 'randomPosition':
            const cx = Math.random() * width;
            const cy = Math.random() * height;
            contentRenderer.contentX = cx; contentRenderer.contentY = cy; controller.contentX = cx; controller.contentY = cy; contentRenderer.markDirty();
            break;
        // Keyframe apply handled via separate event
        default:
            break;
    }
});

// Handle file-loading actions emitted via state
eventBus.on('state:change', async ({ key, val }) => {
    if (key === 'depthImageFile') {
        try { await depthProcessor.loadDepthImage(val); } catch (e) { console.warn('Depth image load failed', e); }
    } else if (key === 'depthVideoFile') {
        try { await depthProcessor.loadDepthVideo(val); } catch (e) { console.warn('Depth video load failed', e); }
    } else if (key === 'contentImageFile') {
        try {
            const img = await loadImageFromFile(val);
            contentRenderer.currentImage = img;
            contentRenderer.contentX = width/2;
            contentRenderer.contentY = height/2;
            controller.contentX = width/2;
            controller.contentY = height/2;
            contentRenderer.markDirty();
            contentRenderer.contentType = 'image';
            const sel = document.getElementById('contentType'); if (sel) sel.value = 'image';
            document.getElementById('contentStatus').classList.add('active');
        } catch (e) { console.warn('Content image load failed', e); }
    } else if (key === 'applyKeyframe') {
        // val expected to be an object: { param, start, end, duration, loop }
        try {
            const k = val;
            controller.keyframeAnimations[k.param] = { start: k.start, end: k.end, duration: k.duration, loop: !!k.loop };
            controller.keyframeStartTime = null;
        } catch (e) { console.warn('Apply keyframe failed', e); }
    }
});

// Should be created before supported services
const ffmpegService = new FFmpegService(coreURL, wasmURL);

// Before batchProcessor
const exportService = new ExportService(controller, ffmpegService, { fps: 30 });

const batchProcessor = new BatchProcessor(controller, exportService, contentRenderer, depthProcessor);

// Instantiate Scheduler and ExportService
const scheduler = new Scheduler(controller, animationState);

// Initialize UIController after dependent helpers and services exist
const uiController = new UIController({ controller, contentRenderer, depthProcessor, exportService, ffmpegService, scheduler, noiseGen, batchProcessor });
uiController.init();

// === Depth Control Events ===
document.querySelectorAll('input[name="depthSource"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        animationState.set('depthSource', e.target.value);
    });
});

document.getElementById('depthImageInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    animationState.set('depthImageFile', file);
});

document.getElementById('depthVideoInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    animationState.set('depthVideoFile', file);
});

document.getElementById('foregroundSpeed').addEventListener('input', (e) => {
    animationState.set('foregroundSpeed', parseFloat(e.target.value) || 60);
});
document.getElementById('lowerThreshold').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    animationState.set('lowerThreshold', v);
    document.getElementById('lowerThresholdValue').textContent = v;
    if (v > depthProcessor.upperThreshold) {
        animationState.set('upperThreshold', v);
        document.getElementById('upperThreshold').value = v;
        document.getElementById('upperThresholdValue').textContent = v;
    }
});
document.getElementById('upperThreshold').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    animationState.set('upperThreshold', v);
    document.getElementById('upperThresholdValue').textContent = v;
    if (v < depthProcessor.lowerThreshold) {
        animationState.set('lowerThreshold', v);
        document.getElementById('lowerThreshold').value = v;
        document.getElementById('lowerThresholdValue').textContent = v;
    }
});
document.getElementById('edgeThreshold').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    animationState.set('edgeThreshold', v);
    document.getElementById('edgeThresholdValue').textContent = v;
});
document.getElementById('depthScale').addEventListener('input', (e) => {
    animationState.set('depthScale', parseFloat(e.target.value) || 2);
});

// === Content Control Events ===
document.getElementById('contentType').addEventListener('change', (e) => {
    animationState.set('contentType', e.target.value);
});

document.getElementById('textInput').addEventListener('input', (e) => {
    animationState.set('textInput', e.target.value);
});
document.getElementById('fontSize').addEventListener('input', (e) => {
    animationState.set('fontSize', Math.max(5, parseInt(e.target.value)));
});
document.getElementById('imageInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    animationState.set('contentImageFile', file);
});
document.getElementById('shapeType').addEventListener('change', (e) => {
    animationState.set('shapeType', e.target.value);
});
document.getElementById('shapeSize').addEventListener('input', (e) => {
    animationState.set('shapeSize', Math.max(10, parseInt(e.target.value)));
});
document.getElementById('shapeSides').addEventListener('input', (e) => {
    animationState.set('shapeSides', Math.max(3, parseInt(e.target.value)));
});
document.getElementById('shapeMoveToggle').addEventListener('change', (e) => {
    animationState.set('shapeMoveToggle', e.target.checked);
});
document.getElementById('randomPosition').addEventListener('click', () => {
    animationState.set('randomPosition', Date.now());
});

// === Animation Control Events ===
document.getElementById('animationMode').addEventListener('change', (e) => {
    animationState.set('animationMode', e.target.value);
});

document.getElementById('backgroundMode').addEventListener('change', (e) => { animationState.set('backgroundMode', e.target.value); });

document.getElementById('movementDirection').addEventListener('change', (e) => { animationState.set('movementDirection', e.target.value); });

document.getElementById('animationSpeed').addEventListener('input', (e) => { animationState.set('animationSpeed', parseFloat(e.target.value) || 2); });

document.getElementById('backgroundDensity').addEventListener('input', (e) => { const value = parseInt(e.target.value); animationState.set('backgroundDensity', value/100); document.getElementById('backgroundDensityValue').textContent = value + '%'; });
document.getElementById('foregroundDensity').addEventListener('input', (e) => { const value = parseInt(e.target.value); animationState.set('foregroundDensity', value/100); document.getElementById('foregroundDensityValue').textContent = value + '%'; });

// Noise Type
document.getElementById('noiseType').addEventListener('change', (e) => { animationState.set('noiseType', e.target.value); });

// Perlin Parameters
document.getElementById('perlinFrequency').addEventListener('input', (e) => { const v = parseFloat(e.target.value); animationState.set('perlinFrequency', v); document.getElementById('perlinFrequencyValue').textContent = v.toFixed(3); });
document.getElementById('perlinAmplitude').addEventListener('input', (e) => { const v = parseInt(e.target.value); animationState.set('perlinAmplitude', v); document.getElementById('perlinAmplitudeValue').textContent = v; });
document.getElementById('perlinOctaves').addEventListener('input', (e) => { const v = Math.max(1, parseInt(e.target.value)); animationState.set('perlinOctaves', v); });
document.getElementById('perlinPersistence').addEventListener('input', (e) => { const v = parseFloat(e.target.value); animationState.set('perlinPersistence', v); document.getElementById('perlinPersistenceValue').textContent = v.toFixed(2); });

// Gradient Parameters
document.getElementById('gradientDirection').addEventListener('change', (e) => { animationState.set('gradientDirection', e.target.value); });
document.getElementById('gradientMin').addEventListener('input', (e) => { const v = parseInt(e.target.value); animationState.set('gradientMin', v); document.getElementById('gradientMinValue').textContent = v; });
document.getElementById('gradientMax').addEventListener('input', (e) => { const v = parseInt(e.target.value); animationState.set('gradientMax', v); document.getElementById('gradientMaxValue').textContent = v; });
// Raw gradient toggle (Content Mode)
const gradientRawToggle = document.getElementById('gradientRawToggle');
if (gradientRawToggle) {
    gradientRawToggle.addEventListener('change', (e) => {
        animationState.set('gradientRawMode', e.target.checked);
    });
}
// Unified gradient toggle (Depth Mode)
const unifiedGradientToggle = document.getElementById('unifiedGradientToggle');
if (unifiedGradientToggle) {
    unifiedGradientToggle.addEventListener('change', (e) => {
        animationState.set('unifiedGradient', e.target.checked);
    });
}

// Colourful
document.getElementById('colourfulDensity').addEventListener('input', (e) => { const v = parseInt(e.target.value)/100; animationState.set('colourfulDensity', v); document.getElementById('colourfulDensityValue').textContent = (v*100) + '%'; });

// Dynamic
document.getElementById('dynamicFrequencyX').addEventListener('input', (e) => { animationState.set('dynamicFrequencyX', parseFloat(e.target.value)); });
document.getElementById('dynamicFrequencyY').addEventListener('input', (e) => { animationState.set('dynamicFrequencyY', parseFloat(e.target.value)); });
document.getElementById('dynamicSpeed').addEventListener('input', (e) => { animationState.set('dynamicSpeed', parseFloat(e.target.value)); });
document.getElementById('dynamicAmplitude').addEventListener('input', (e) => { animationState.set('dynamicAmplitude', parseInt(e.target.value)); });

// Foreground Color Mode
document.getElementById('foregroundColorMode').addEventListener('change', (e) => { animationState.set('foregroundColorMode', e.target.value); });
document.getElementById('foregroundHue').addEventListener('input', (e) => { const v = parseInt(e.target.value); animationState.set('foregroundHue', v); document.getElementById('foregroundHueValue').textContent = v; });
document.getElementById('foregroundSat').addEventListener('input', (e) => { const v = parseInt(e.target.value); animationState.set('foregroundSat', v); document.getElementById('foregroundSatValue').textContent = v; });
document.getElementById('foregroundLight').addEventListener('input', (e) => { const v = parseInt(e.target.value); animationState.set('foregroundLight', v); document.getElementById('foregroundLightValue').textContent = v; });
document.getElementById('gradStart').addEventListener('input', (e) => { animationState.set('gradStart', e.target.value); });
document.getElementById('gradEnd').addEventListener('input', (e) => { animationState.set('gradEnd', e.target.value); });
document.getElementById('blendMode').addEventListener('change', (e) => { animationState.set('blendMode', e.target.value); });

document.getElementById('speckleSize').addEventListener('input', (e) => { animationState.set('speckleSize', Math.max(1, parseInt(e.target.value))); });

document.getElementById('removeBackgroundNoise').addEventListener('change', (e) => { animationState.set('removeBackgroundNoise', e.target.checked); document.getElementById('backgroundColorGroup').style.display = e.target.checked ? 'flex' : 'none'; });
document.getElementById('backgroundColor').addEventListener('input', (e) => { animationState.set('backgroundColor', e.target.value); });
document.getElementById('depthThreshold').addEventListener('input', (e) => { const v = parseInt(e.target.value); animationState.set('depthThreshold', v); document.getElementById('depthThresholdValue').textContent = v; });

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

// Transformation Parameters
document.getElementById('rotationSpeed').addEventListener('input', (e) => { animationState.set('rotationSpeed', parseFloat(e.target.value)); });
document.getElementById('scaleFactor').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    animationState.set('scaleFactor', v);
    document.getElementById('scaleValue').textContent = (isNaN(v) ? 0 : v).toFixed(2);
});
document.getElementById('depthScalingToggle').addEventListener('change', (e) => { animationState.set('depthScalingToggle', e.target.checked); });
document.getElementById('waveStrength').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    animationState.set('waveStrength', isNaN(v) ? 0 : v);
    document.getElementById('waveStrengthValue').textContent = (isNaN(v) ? 0 : v);
});
document.getElementById('pathType').addEventListener('change', (e) => {
    const val = e.target.value;
    animationState.set('pathType', val);
    // keep immediate UI feedback for the toggle
    document.getElementById('shapeMoveToggle').disabled = val !== 'none';
});
document.getElementById('pathSpeed').addEventListener('input', (e) => { animationState.set('pathSpeed', parseFloat(e.target.value)); });

// Keyframes
document.getElementById('applyKeyframe').addEventListener('click', () => {
    const param = document.getElementById('keyframeParam').value;
    const start = parseFloat(document.getElementById('keyframeStart').value);
    const end = parseFloat(document.getElementById('keyframeEnd').value);
    const duration = parseFloat(document.getElementById('keyframeDuration').value);
    const loop = document.getElementById('keyframeLoop').checked;
    animationState.set('applyKeyframe', { param, start, end, duration, loop });
});

// === Initialization Startup ===
controller.start();
document.getElementById('depthStatus').classList.add('active');
document.getElementById('contentStatus').classList.add('active');

// Trigger UI linkage based on default animation mode
document.getElementById('animationMode').dispatchEvent(new Event('change'));
noiseGen.refresh('content', 'vertical');
