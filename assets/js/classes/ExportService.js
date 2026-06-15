// assets/js/classes/ExportService.js
export default class ExportService {
    constructor(controller, ffmpegService, { fps = 30 } = {}) {
        this.controller = controller;
        this.ffmpegService = ffmpegService;
        this.fps = fps;
        this.renderEngine = controller.renderEngine;
    }

    getFrameAtTime(timestamp) {
        if (this.controller?.renderEngine && this.controller?.motionState) {
            try {
                return this.controller.renderEngine.renderToImageData(this.controller, this.controller.motionState, timestamp);
            } catch (e) {
                console.warn('ExportService: fallback to controller.getFrameAtTime', e);
            }
        }
        return this.controller.getFrameAtTime(timestamp);
    }

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
            mediaRecorder.ondataavailable = (ev) => { if (ev.data?.size) recorded.push(ev.data); };
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
                } catch (e) { console.warn(e); }
                frameIndex++;
                if (frameIndex < frameCount) setTimeout(drawNext, 1000 / fps);
                else setTimeout(() => { try { mediaRecorder.stop(); } catch (e) { mediaRecorder.dispatchEvent(new Event('stop')); } }, 100);
            };
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

        await ffmpegService.reset();

        const depthVideo = (controller.animationMode === 'depth' && controller.depthProcessor.depthSource === 'video')
            ? controller.depthProcessor.depthVideo : null;
        let origVideoTime = 0, origVideoPaused = true;
        if (depthVideo) {
            origVideoTime = depthVideo.currentTime;
            origVideoPaused = depthVideo.paused;
            depthVideo.pause();
        }

        const baseTime = performance.now();
        const offCanvas = new OffscreenCanvas(width, height);
        const offCtx = offCanvas.getContext('2d');

        for (let i = 0; i < totalFrames; i++) {
            const fakeTimestamp = baseTime + i * frameInterval;
            const elapsed = (fakeTimestamp - baseTime) / 1000;
            const delta = (i === 0) ? 0 : (frameInterval / 1000);

            controller.updateMotionStateForElapsed(elapsed, delta, fakeTimestamp);
            if (controller.noiseGenerator.noiseType === 'dynamic') {
                await controller.noiseGenerator.refresh(controller.animationMode, controller.movementDirection, fakeTimestamp);
            }
            if (depthVideo) await this._seekDepthVideo(depthVideo, elapsed);

            renderEngine.renderToContext(offCtx, controller, controller.motionState, fakeTimestamp, delta, elapsed);
            const blob = await offCanvas.convertToBlob({ type: 'image/png' });
            const dataURL = URL.createObjectURL(blob);
            await ffmpegService.writeFrame(dataURL, i);
            URL.revokeObjectURL(dataURL);

            if (onProgress) onProgress(Math.round((i + 1) / totalFrames * 100), `Frame ${i + 1}/${totalFrames}`);
        }

        Object.assign(controller.motionState, savedMotionState);
        controller.isPaused = true;
        controller.startTime = null;
        controller.lastTimestamp = null;
        if (depthVideo) {
            depthVideo.currentTime = origVideoTime;
            if (!origVideoPaused) depthVideo.play().catch(() => {});
        }
        if (!wasPaused) controller.resume();

        await ffmpegService.exec([
            '-framerate', String(fps),
            '-i', '/input/frame%05d.png',
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
            '-pix_fmt', 'yuv420p',
            '/output/output.mp4'
        ]);

        const outputBlob = await ffmpegService.readOutput('output.mp4');
        return outputBlob;
    }
}