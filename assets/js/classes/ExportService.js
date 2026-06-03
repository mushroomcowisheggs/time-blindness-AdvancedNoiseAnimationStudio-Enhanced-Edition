export default class ExportService {
    constructor(controller, ffmpegService, { fps = 30 } = {}) {
        this.controller = controller;
        this.ffmpegService = ffmpegService;
        this.fps = fps;
        this.renderEngine = controller.renderEngine;
    }

    getFrameAtTime(timestamp) {
        // Use RenderEngine's pure renderer to avoid swapping controller canvas
        if (this.controller && this.controller.renderEngine && this.controller.motionState) {
            try {
                return this.controller.renderEngine.renderToImageData(this.controller, this.controller.motionState, timestamp);
            } catch (e) {
                console.warn('ExportService: renderToImageData failed, falling back to controller.getFrameAtTime', e);
            }
        }
        return this.controller.getFrameAtTime(timestamp);
    }

    // Quick client-side export: draw frames to a canvas at target FPS and record via MediaRecorder
    quickExport(durationSeconds = 5, fps = this.fps) {
        return new Promise((resolve, reject) => {
            const width = this.controller.width;
            const height = this.controller.height;
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.style.display = 'none';
            document.body.appendChild(canvas);
            const ctx = canvas.getContext('2d');

            const stream = canvas.captureStream(fps);
            let recorded = [];
            let mediaRecorder;
            try {
                mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
            } catch (e) {
                try { mediaRecorder = new MediaRecorder(stream); } catch (err) { document.body.removeChild(canvas); return reject(err); }
            }

            mediaRecorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) recorded.push(ev.data); };
            mediaRecorder.onstop = () => {
                const blob = new Blob(recorded, { type: 'video/webm' });
                document.body.removeChild(canvas);
                resolve(blob);
            };

            const frameCount = Math.max(1, Math.floor(durationSeconds * fps));
            let frameIndex = 0;
            const startTime = performance.now();

            mediaRecorder.start();

            const drawNext = () => {
                const t = (frameIndex / fps) * 1000 + startTime;
                try {
                    const imgData = this.getFrameAtTime(t);
                    if (imgData) ctx.putImageData(imgData, 0, 0);
                } catch (e) {
                    console.warn('ExportService: getFrameAtTime failed', e);
                }
                frameIndex++;
                if (frameIndex < frameCount) {
                    setTimeout(drawNext, 1000 / fps);
                } else {
                    setTimeout(() => {
                        try { mediaRecorder.stop(); } catch (e) { console.warn(e); mediaRecorder.dispatchEvent(new Event('stop')); }
                    }, 100);
                }
            };

            // kick off drawing loop
            drawNext();
        });
    }
    
    _seekDepthVideo(video, timeInSeconds) {
        return new Promise((resolve) => {
            if (!video || video.readyState < 2) { resolve(); return; }
            const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                resolve();
            };
            video.addEventListener('seeked', onSeeked);
            video.currentTime = timeInSeconds;
            setTimeout(() => {
                video.removeEventListener('seeked', onSeeked);
                resolve();
            }, 2000);
        });
    }
    
    // FFmpeg-based export stub: accepts array of ImageData or blobs and attempts to run ffmpeg.wasm if available.
    async exportWithFFmpeg(frames, options = {}) {
        if (typeof FFmpeg === 'undefined') throw new Error('FFmpeg not available');
        // TODO: implement frame encoding into a byte stream and feed to ffmpeg.wasm
        throw new Error('exportWithFFmpeg not implemented');
    }
    
    async exportToMP4(durationSeconds, onProgress) {
        const { controller, ffmpegService, renderEngine, fps } = this;
        await ffmpegService.load();

        const wasPaused = controller.isPaused;
        if (!wasPaused) controller.pause();

        const savedMotionState = {
            backgroundOffset: controller.motionState.backgroundOffset,
            foregroundOffset: controller.motionState.foregroundOffset,
            contentX: controller.motionState.contentX,
            contentY: controller.motionState.contentY,
            pathAngle: controller.motionState.pathAngle,
        };
        controller.motionState.backgroundOffset = 0;
        controller.motionState.foregroundOffset = 0;
        controller.motionState.contentX = controller.width / 2;
        controller.motionState.contentY = controller.height / 2;
        controller.motionState.pathAngle = 0;
        
        const width = controller.width;
        const height = controller.height;
        const totalFrames = Math.ceil(durationSeconds * fps);
        const frameInterval = 1000 / fps;

        await ffmpegService.ensureDirectoryEmpty('/input');
        await ffmpegService.ensureDirectoryEmpty('/output');

        // Save original depth video state
        const depthVideo = (controller.animationMode === 'depth' && controller.depthProcessor.depthSource === 'video')
            ? controller.depthProcessor.depthVideo : null;
        let origVideoTime = 0, origVideoPaused = true;
        if (depthVideo) {
            origVideoTime = depthVideo.currentTime;
            origVideoPaused = depthVideo.paused;
            depthVideo.pause();
        }

        // Lock time basis temperately
        const baseTime = performance.now();
        let prevTimestamp = baseTime;
        const offCanvas = new OffscreenCanvas(width, height);
        const offCtx = offCanvas.getContext('2d');
        
        for (let i = 0; i < totalFrames; i++) {
            const fakeTimestamp = baseTime + i * frameInterval;
            const elapsed = (fakeTimestamp - baseTime) / 1000;
            const delta = (i === 0) ? 0 : (frameInterval / 1000); // seconds since previous frame

            // Update motion state before rendering this frame (Content Mode)
            controller.updateMotionStateForElapsed(elapsed, delta, fakeTimestamp);
            
            if (controller.noiseGenerator.noiseType === 'dynamic') {
                await controller.noiseGenerator.refresh(
                    controller.animationMode,
                    controller.movementDirection,
                    fakeTimestamp   // Virtual
                );
            }
            
            if (depthVideo) {
                await this._seekDepthVideo(depthVideo, elapsed);
            }
            
            // Render directly to offscreen canvas with accurate elapsed and delta
            this.renderEngine.renderToContext(offCtx, controller, controller.motionState, fakeTimestamp, delta, elapsed);
            
            // Get ImageData and send to FFmpeg
            const blob = await offCanvas.convertToBlob({ type: 'image/png' });
            const dataURL = URL.createObjectURL(blob);
            await ffmpegService.writeFrame(dataURL, i);
            URL.revokeObjectURL(dataURL);

            if (onProgress) {
                onProgress(Math.round((i+1)/totalFrames*100), `Frame ${i+1}/${totalFrames}`);
            }
        }

        // Recover controller state
        Object.assign(controller.motionState, savedMotionState);
        controller.isPaused = true;
        controller.startTime = null;
        controller.lastTimestamp = null;
        if (depthVideo) {
            depthVideo.currentTime = origVideoTime;
            if (!origVideoPaused) depthVideo.play().catch(() => {});
        }
        if (!wasPaused) controller.resume();

        // Encoding
        await ffmpegService.exec([
            '-framerate', String(fps),
            '-i', '/input/frame%05d.png',
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
            '-pix_fmt', 'yuv420p',
            '/output/output.mp4'
        ]);
        return await ffmpegService.readOutput('output.mp4');
    }
}
