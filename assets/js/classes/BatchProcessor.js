// assets/js/classes/BatchProcessor.js
import animationState from './AnimationState.js';

export default class BatchProcessor {
    constructor(controller, exportService, contentRenderer, depthProcessor) {
        this.controller = controller;
        this.exportService = exportService;
        this.contentRenderer = contentRenderer;
        this.depthProcessor = depthProcessor;
        this.isRunning = false;
    }

    async processImages(files, mode, durationSeconds, onProgress) {
        if (this.isRunning) throw new Error('Batch already in progress');
        this.isRunning = true;

        const total = files.length;
        const originalContentImage = this.contentRenderer.currentImage;
        const originalDepthData = this.depthProcessor.depthImageData;
        const originalIsPaused = this.controller.isPaused;
        const originalStateSnapshot = JSON.parse(JSON.stringify(animationState._state));

        if (!originalIsPaused) this.controller.pause();

        try {
            for (let i = 0; i < total; i++) {
                const file = files[i];
                if (onProgress) onProgress(i, total, file.name, 'loading...');

                if (mode === 'content') {
                    const img = await this._loadImage(file);
                    this.contentRenderer.currentImage = img;
                    this.contentRenderer.markDirty();
                    if (this.contentRenderer.contentType !== 'image') {
                        this.contentRenderer.contentType = 'image';
                        const contentTypeSelect = document.getElementById('contentType');
                        if (contentTypeSelect) contentTypeSelect.value = 'image';
                    }
                } else {
                    await this.depthProcessor.loadDepthImage(file);
                }

                this.controller.refreshNoise();
                this.controller.startTime = null;
                this.controller.depthVideoSyncBaseTime = null;

                const baseName = file.name.replace(/\.[^/.]+$/, '');
                const outputName = `${baseName}_${mode}_${durationSeconds}s.mp4`;

                const progressCallback = (percent, msg) => {
                    if (onProgress) onProgress(i, total, file.name, `${percent}% - ${msg}`);
                };

                const blob = await this.exportService.exportToMP4(durationSeconds, progressCallback);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = outputName;
                a.click();
                URL.revokeObjectURL(url);

                // Force memory cleanup: unload and reload FFmpeg worker
                await this.exportService.ffmpegService.unload();
                await this.exportService.ffmpegService.load();
                await this._yieldAndCollect();
            }
        } finally {
            this.contentRenderer.currentImage = originalContentImage;
            this.depthProcessor.depthImageData = originalDepthData;
            Object.assign(animationState._state, originalStateSnapshot);
            if (!originalIsPaused) this.controller.resume();
            this.isRunning = false;
        }
    }

    async processVideos(files, mode, onProgress) {
        if (this.isRunning) throw new Error('Batch already in progress');
        this.isRunning = true;

        const total = files.length;
        const originalContentImage = this.contentRenderer.currentImage;
        const originalDepthData = this.depthProcessor.depthImageData;
        const originalDepthVideo = this.depthProcessor.depthVideo;
        const originalIsPaused = this.controller.isPaused;
        const originalStateSnapshot = JSON.parse(JSON.stringify(animationState._state));

        if (!originalIsPaused) this.controller.pause();

        try {
            for (let i = 0; i < total; i++) {
                const file = files[i];
                if (onProgress) onProgress(i, total, file.name, 'loading video...');

                const duration = await this._getVideoDuration(file);
                const durationSeconds = Math.max(0.1, duration);

                if (mode === 'depth') {
                    await this.depthProcessor.loadDepthVideo(file);
                    this.depthProcessor.depthSource = 'video';
                    this.controller.setAnimationMode('depth');
                } else {
                    const posterImg = await this._extractVideoPoster(file);
                    if (posterImg) {
                        this.contentRenderer.currentImage = posterImg;
                        this.contentRenderer.contentType = 'image';
                        const contentTypeSelect = document.getElementById('contentType');
                        if (contentTypeSelect) contentTypeSelect.value = 'image';
                        this.contentRenderer.markDirty();
                    }
                    this.controller.setAnimationMode('content');
                }

                this.controller.refreshNoise();
                this.controller.startTime = null;
                this.controller.depthVideoSyncBaseTime = null;

                const baseName = file.name.replace(/\.[^/.]+$/, '');
                const outputName = `${baseName}_${mode}_${Math.round(durationSeconds)}s.mp4`;

                const progressCallback = (percent, msg) => {
                    if (onProgress) onProgress(i, total, file.name, `${percent}% - ${msg}`);
                };

                const blob = await this.exportService.exportToMP4(durationSeconds, progressCallback);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = outputName;
                a.click();
                URL.revokeObjectURL(url);

                // Clean up FFmpeg worker and depth video resources
                await this.exportService.ffmpegService.unload();
                if (this.depthProcessor.depthVideo) {
                    const src = this.depthProcessor.depthVideo.src;
                    if (src && src.startsWith('blob:')) URL.revokeObjectURL(src);
                    this.depthProcessor.depthVideo.pause();
                    this.depthProcessor.depthVideo.removeAttribute('src');
                    this.depthProcessor.depthVideo.load();
                    this.depthProcessor.depthVideo = null;
                }
                await this.exportService.ffmpegService.load();
                await this._yieldAndCollect();
            }
        } finally {
            this.contentRenderer.currentImage = originalContentImage;
            this.depthProcessor.depthImageData = originalDepthData;
            this.depthProcessor.depthVideo = originalDepthVideo;
            Object.assign(animationState._state, originalStateSnapshot);
            if (!originalIsPaused) this.controller.resume();
            this.isRunning = false;
        }
    }

    _loadImage(file) {
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

    _getVideoDuration(file) {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const v = document.createElement('video');
            v.preload = 'metadata';
            v.src = url;
            const cleanup = () => {
                v.removeEventListener('loadedmetadata', onLoaded);
                v.removeEventListener('error', onError);
                URL.revokeObjectURL(url);
            };
            const onLoaded = () => {
                const d = isFinite(v.duration) ? v.duration : 0;
                cleanup();
                resolve(d);
            };
            const onError = () => {
                cleanup();
                resolve(0);
            };
            v.addEventListener('loadedmetadata', onLoaded);
            v.addEventListener('error', onError);
        });
    }

    _extractVideoPoster(file) {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const v = document.createElement('video');
            v.preload = 'metadata';
            v.src = url;
            const cleanup = () => {
                URL.revokeObjectURL(url);
                v.remove();
            };
            const onLoaded = () => {
                v.currentTime = Math.min(0.5, Math.max(0, v.duration * 0.01));
                const onSeeked = () => {
                    const c = document.createElement('canvas');
                    c.width = this.contentRenderer.width;
                    c.height = this.contentRenderer.height;
                    const ctx = c.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(v, 0, 0, c.width, c.height);
                    const img = new Image();
                    img.onload = () => {
                        cleanup();
                        resolve(img);
                    };
                    img.onerror = () => {
                        cleanup();
                        resolve(null);
                    };
                    img.src = c.toDataURL('image/png');
                };
                v.addEventListener('seeked', onSeeked, { once: true });
            };
            const onError = () => {
                cleanup();
                resolve(null);
            };
            v.addEventListener('loadedmetadata', onLoaded, { once: true });
            v.addEventListener('error', onError, { once: true });
        });
    }

    _yieldAndCollect() {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (typeof window !== 'undefined' && window.gc) window.gc();
                resolve();
            }, 100);
        });
    }
}