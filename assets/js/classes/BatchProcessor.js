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
        let current = 0;

        // Save original state
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
                        document.getElementById('contentType').value = 'image';
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
                // After export, attempt to free temporary resources for each iteration
                try { await this._performGC(); } catch (e) { /* swallow */ }
            }
        } finally {
            // Recover state
            this.contentRenderer.currentImage = originalContentImage;
            this.depthProcessor.depthImageData = originalDepthData;
            Object.assign(animationState._state, originalStateSnapshot);
            if (!originalIsPaused) this.controller.resume();
            this.isRunning = false;
        }
    }

    // processVideos - accepts FileList/Array of video files, determines each video's duration
    // and exports using that video's duration. Ensures GC and FFmpeg unload between videos.
    async processVideos(files, mode, onProgress) {
        if (this.isRunning) throw new Error('Batch already in progress');
        this.isRunning = true;

        const total = files.length;

        // Save original state
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

                // Get video duration
                const duration = await this._getVideoDuration(file);
                const durationSeconds = Math.max(0.1, duration);

                if (mode === 'depth') {
                    // Load as depth video source
                    await this.depthProcessor.loadDepthVideo(file);
                    this.depthProcessor.depthSource = 'video';
                    this.controller.setAnimationMode('depth');
                } else {
                    // mode === 'content': extract a poster frame and use as foreground image
                    const posterImg = await this._extractVideoPoster(file);
                    if (posterImg) {
                        this.contentRenderer.currentImage = posterImg;
                        this.contentRenderer.contentType = 'image';
                        document.getElementById('contentType').value = 'image';
                        this.contentRenderer.markDirty();
                    }
                    // Ensure animation mode is content (depth video not used)
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

                // Thorough cleanup after each video to prevent memory leaks
                try {
                    if (this.exportService && this.exportService.ffmpegService) {
                        await this.exportService.ffmpegService.unload();
                    }
                    // Revoke any blob URL created inside DepthProcessor.loadDepthVideo
                    if (this.depthProcessor.depthVideo && this.depthProcessor.depthVideo.src) {
                        const src = this.depthProcessor.depthVideo.src;
                        if (src.startsWith('blob:')) URL.revokeObjectURL(src);
                        this.depthProcessor.depthVideo.pause();
                        this.depthProcessor.depthVideo.removeAttribute('src');
                        this.depthProcessor.depthVideo.load();
                        this.depthProcessor.depthVideo = null;
                    }
                } catch (e) {
                    console.warn('Cleanup failed after video export', e);
                }

                // Reload FFmpeg for next iteration
                await this.exportService.ffmpegService.load();
                await this._yieldAndCollect();
            }
        } finally {
            // Restore state
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
            const onLoaded = () => {
                const d = isFinite(v.duration) ? v.duration : 0;
                cleanup();
                resolve(d);
            };
            const onError = () => { cleanup(); resolve(0); };
            function cleanup() {
                v.removeEventListener('loadedmetadata', onLoaded);
                v.removeEventListener('error', onError);
                try { URL.revokeObjectURL(url); } catch (e) {}
            }
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
            const onLoaded = () => {
                v.currentTime = Math.min(0.5, Math.max(0, v.duration * 0.01));
                const onSeeked = () => {
                    const c = document.createElement('canvas');
                    c.width = this.contentRenderer.width;
                    c.height = this.contentRenderer.height;
                    const ctx = c.getContext('2d');
                    ctx.drawImage(v, 0, 0, c.width, c.height);
                    const img = new Image();
                    img.onload = () => { cleanup(); resolve(img); };
                    img.onerror = () => { cleanup(); resolve(null); };
                    img.src = c.toDataURL('image/png');
                };
                v.addEventListener('seeked', onSeeked, { once: true });
            };
            const onError = () => { cleanup(); resolve(null); };
            const cleanup = () => { try { URL.revokeObjectURL(url); } catch (e) {}; v.remove(); };
            v.addEventListener('loadedmetadata', onLoaded, { once: true });
            v.addEventListener('error', onError, { once: true });
        });
    }

    _yieldAndCollect() {
        return new Promise((resolve) => {
            // Allow event loop to run and hint GC
            setTimeout(() => {
                try {
                    if (window && typeof window.gc === 'function') window.gc();
                } catch (e) {}
                resolve();
            }, 100);
        });
    }

    _loadVideo(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.src = url;
            video.muted = true;
            video.loop = false;
            const onLoaded = () => {
                video.removeEventListener('loadedmetadata', onLoaded);
                resolve({ video, url, duration: video.duration });
            };
            const onError = (e) => {
                video.removeEventListener('error', onError);
                try { URL.revokeObjectURL(url); } catch (e2) {}
                reject(e);
            };
            video.addEventListener('loadedmetadata', onLoaded);
            video.addEventListener('error', onError);
        });
    }

    async _performGC() {
        // Best-effort cleanup between batch items
        try {
            // Try to unload ffmpeg to free memory if available
            const ff = this.exportService && this.exportService.ffmpegService;
            if (ff && typeof ff.unload === 'function') {
                await ff.unload();
            }
        } catch (e) {
            // ignore errors during GC
        }
        // allow event loop to clear references
        await new Promise(r => setTimeout(r, 50));
        try { if (typeof globalThis.gc === 'function') globalThis.gc(); } catch (e) {}
    }
}