import animationState from './AnimationState.js';

export default class UIController {
    constructor({ controller, contentRenderer, depthProcessor, exportService, ffmpegService, scheduler, noiseGen, batchProcessor }) {
        this.controller = controller;
        this.contentRenderer = contentRenderer;
        this.depthProcessor = depthProcessor;
        this.exportService = exportService;
        this.ffmpegService = ffmpegService;
        this.batchProcessor = batchProcessor;
        this.scheduler = scheduler;
        this.noiseGen = noiseGen;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordTimer = null;
        this.recordedChunks = [];
    }

    init() {
        const controller = this.controller;
        const contentRenderer = this.contentRenderer;
        const depthProcessor = this.depthProcessor;

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

        // Pause button handled via scheduler
        const pauseBtn = document.getElementById('canvasPauseButton');
        if (pauseBtn) pauseBtn.addEventListener('click', () => {
            const depthVideo = depthProcessor && depthProcessor.depthVideo ? depthProcessor.depthVideo : null;
            if (controller.isPaused) {
                this.scheduler.resume();
                document.querySelector('#canvasPauseButton span:not(.btn-icon)').textContent = 'Pause';
                document.querySelector('#canvasPauseButton .btn-icon').textContent = '⏸';
                document.getElementById('animationStatus').classList.add('active');
                try { if (depthVideo && window._depthVideoWasPlaying) depthVideo.play().catch(() => {}); } catch (e) {}
                window._depthVideoWasPlaying = false;
            } else {
                try { window._depthVideoWasPlaying = !!(depthVideo && !depthVideo.paused && !depthVideo.ended); if (depthVideo) depthVideo.pause(); } catch (e) { window._depthVideoWasPlaying = false; }
                this.scheduler.pause();
                document.querySelector('#canvasPauseButton span:not(.btn-icon)').textContent = 'Resume';
                document.querySelector('#canvasPauseButton .btn-icon').textContent = '▶';
                document.getElementById('animationStatus').classList.remove('active');
            }
        });

        // Recording handlers
        const recordBtn = document.getElementById('recordButton');
        if (recordBtn) {
            recordBtn.addEventListener('click', () => {
                if (this.isRecording) this._stopRecording(); else this._startRecording();
            });
        }

        // === Quick Export Button ===
        const quickExportBtn = document.getElementById('quickExportButton');
        const quickExportDurationSelect = document.getElementById('quickExportDuration');
        if (quickExportBtn) quickExportBtn.addEventListener('click', () => {
            if (this.isRecording) { alert('Please stop the current recording before starting a quick export.'); return; }
            const dur = parseInt(quickExportDurationSelect.value) || 10;
            quickExportBtn.disabled = true;
            quickExportBtn.querySelector('span:last-child').textContent = 'Exporting...';
            this.exportService.quickExport(dur, 30).then((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `quick-export-${dur}s.webm`; a.click(); URL.revokeObjectURL(url);
            }).catch(err => { console.error('Quick export failed', err); alert('Quick export failed: ' + (err && err.message ? err.message : String(err))); }).finally(() => {
                quickExportBtn.disabled = false; quickExportBtn.querySelector('span:last-child').textContent = 'Quick Export'; quickExportBtn.classList.remove('recording');
            });
        });

        // Transformation UI handlers moved to animationState elsewhere

        // Keyframes
        document.getElementById('applyKeyframe').addEventListener('click', () => {
            const param = document.getElementById('keyframeParam').value;
            const start = parseFloat(document.getElementById('keyframeStart').value);
            const end = parseFloat(document.getElementById('keyframeEnd').value);
            const duration = parseFloat(document.getElementById('keyframeDuration').value);
            const loop = document.getElementById('keyframeLoop').checked;
            animationState.set('applyKeyframe', { param, start, end, duration, loop });
        });

        // Initialization
        controller.start();
        const depthStatus = document.getElementById('depthStatus'); if (depthStatus) depthStatus.classList.add('active');
        const contentStatus = document.getElementById('contentStatus'); if (contentStatus) contentStatus.classList.add('active');
        document.getElementById('animationMode').dispatchEvent(new Event('change'));
        if (this.noiseGen) this.noiseGen.refresh('content', 'vertical');

        // Depth audio toggle (playback only). Default: muted
        window.depthAudioMuted = true;
        const depthAudioBtn = document.getElementById('depthAudioToggle');
        const updateDepthAudioButton = () => {
            if (!depthAudioBtn) return;
            const icon = depthAudioBtn.querySelector('.btn-icon');
            const label = depthAudioBtn.querySelector('span:last-child');
            if (window.depthAudioMuted) { if (icon) icon.textContent = '🔇'; if (label) label.textContent = 'Muted'; }
            else { if (icon) icon.textContent = '🔊'; if (label) label.textContent = 'Unmuted'; }
        };
        if (depthAudioBtn) {
            updateDepthAudioButton();
            depthAudioBtn.addEventListener('click', () => {
                window.depthAudioMuted = !window.depthAudioMuted;
                try { if (depthProcessor && depthProcessor.depthVideo) depthProcessor.depthVideo.muted = window.depthAudioMuted; } catch (e) {}
                updateDepthAudioButton();
            });
        }
        // === High‑quality MP4 export (offscreen canvas + local ffmpeg.wasm) ===
        const hqExportBtn = document.getElementById('hqExportButton');
        if (hqExportBtn && !hqExportBtn._hqExportBound) {
            hqExportBtn._hqExportBound = true;
            hqExportBtn.addEventListener('click', async () => {
                const dur = parseInt(document.getElementById('hqExportDuration').value) || 10;
                const progressContainer = document.getElementById('hqProgressContainer');
                const progressBar = document.getElementById('hqProgressBar');
                const progressText = document.getElementById('hqProgressText');
                progressContainer.style.display = 'block';
                hqExportBtn.disabled = true;
                try {
                    const blob = await this.exportService.exportToMP4(dur, (percent, msg) => {
                        progressBar.style.width = percent + '%';
                        progressText.textContent = msg;
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `noise-animation-${dur}s.mp4`;
                    a.click();
                    URL.revokeObjectURL(url);
                } catch (err) {
                    console.error(err);
                    alert('Export failed: ' + err.message);
                } finally {
                    progressContainer.style.display = 'none';
                    hqExportBtn.disabled = false;
                }
            });
        }
        
        // Bind batch export button
        // Bind image batch export button
        const imageBatchBtn = document.getElementById('batchExportImagesBtn');
        if (imageBatchBtn && !imageBatchBtn._bound) {
            imageBatchBtn._bound = true;
            imageBatchBtn.addEventListener('click', async () => {
                if (this.batchProcessor.isRunning) {
                    alert('Batch export already in progress, please wait.');
                    return;
                }
                const imageInput = document.getElementById('batchImageInput');
                const imageFiles = imageInput ? Array.from(imageInput.files) : [];
                if (!imageFiles.length) {
                    alert('Please select at least one image.');
                    return;
                }
                const mode = document.getElementById('batchMode').value;
                const duration = parseInt(document.getElementById('batchDuration').value) || 10;
                const progressDiv = document.getElementById('batchProgressContainer');
                const progressBar = document.getElementById('batchProgressBar');
                const progressText = document.getElementById('batchProgressText');
                progressDiv.style.display = 'block';
                try {
                    await this.batchProcessor.processImages(imageFiles, mode, duration, (idx, total, fileName, status) => {
                        const percent = Math.round((idx / total) * 100);
                        progressBar.style.width = percent + '%';
                        progressText.innerText = `${fileName}: ${status}`;
                    });
                } catch (err) {
                    console.error(err);
                    alert('Batch export failed: ' + err.message);
                } finally {
                    progressDiv.style.display = 'none';
                }
            });
        }

        // Bind video batch export button
        const videoBatchBtn = document.getElementById('batchExportVideosBtn');
        if (videoBatchBtn && !videoBatchBtn._bound) {
            videoBatchBtn._bound = true;
            videoBatchBtn.addEventListener('click', async () => {
                if (this.batchProcessor.isRunning) {
                    alert('Batch export already in progress, please wait.');
                    return;
                }
                const videoInput = document.getElementById('batchVideoInput');
                const videoFiles = videoInput ? Array.from(videoInput.files) : [];
                if (!videoFiles.length) {
                    alert('Please select at least one video.');
                    return;
                }
                // Force depth mode for videos (ignore dropdown value)
                const mode = 'depth';
                const progressDiv = document.getElementById('batchProgressContainer');
                const progressBar = document.getElementById('batchProgressBar');
                const progressText = document.getElementById('batchProgressText');
                progressDiv.style.display = 'block';
                try {
                    await this.batchProcessor.processVideos(videoFiles, mode, (idx, total, fileName, status) => {
                        const percent = Math.round((idx / total) * 100);
                        progressBar.style.width = percent + '%';
                        progressText.innerText = `${fileName}: ${status}`;
                    });
                } catch (err) {
                    console.error(err);
                    alert('Batch video export failed: ' + err.message);
                } finally {
                    progressDiv.style.display = 'none';
                }
            });
        }
    }

    _stopRecording() {
        if (this.recordTimer) { clearTimeout(this.recordTimer); this.recordTimer = null; }
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') this.mediaRecorder.stop();
    }

    _startRecording() {
        const canvas = this.controller.canvas;
        const durationSeconds = parseFloat(document.getElementById('recordDuration').value) || 5;
        const stream = canvas.captureStream(60);
        this.recordedChunks = [];
        this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
        this.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this.recordedChunks.push(e.data); };
        this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'noise-animation.webm'; a.click(); URL.revokeObjectURL(url);
            this.isRecording = false;
            const btn = document.getElementById('recordButton');
            btn.querySelector('span:not(.btn-icon)').textContent = 'Record'; btn.querySelector('.btn-icon').textContent = '●'; btn.classList.remove('recording');
            document.getElementById('recordingStatus').classList.remove('active');
        };
        this.isRecording = true;
        this.mediaRecorder.start();
        const btn = document.getElementById('recordButton');
        btn.querySelector('span:not(.btn-icon)').textContent = 'Recording...'; btn.querySelector('.btn-icon').textContent = '⏹'; btn.classList.add('recording');
        document.getElementById('recordingStatus').classList.add('active');
        this.recordTimer = setTimeout(() => { if (this.isRecording && this.mediaRecorder?.state === 'recording') this._stopRecording(); }, durationSeconds * 1000);
    }
}
