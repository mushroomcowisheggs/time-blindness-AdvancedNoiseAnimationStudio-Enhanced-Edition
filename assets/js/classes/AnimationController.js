// assets/js/classes/AnimationController.js
import RenderEngine from './RenderEngine.js';
import MotionState from './MotionState.js';

export default class AnimationController {
    constructor(canvas, noiseGenerator, contentRenderer, depthProcessor) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.width = canvas.width;
        this.height = canvas.height;
        
        this.noiseGenerator = noiseGenerator;
        this.contentRenderer = contentRenderer;
        this.depthProcessor = depthProcessor;
        
        this.isPaused = false;
        this.animationFrameId = null;
        this.startTime = null;
        this.lastTimestamp = null;
        this.animationMode = 'content';
        this.isDepthAnimationMode = false;
        
        this.backgroundMode = 'dynamic';
        this.movementDirection = 'vertical';
        this.animationSpeed = 1;
        this.rotationSpeed = 0;
        this.scaleFactor = 1;
        this.useDepthScaling = false;
        this.waveStrength = 0;
        this.pathType = 'none';
        this.pathSpeed = 0;
        this.pathAngle = 0;
        this.speckleSize = 2;
        this.removeBackgroundNoise = false;
        this.backgroundColor = '#ffffff';
        this.depthThreshold = 5;
        this.enableOpposingMotion = false;
        
        this.foregroundColorMode = 'grayscale';
        this.foregroundHue = 0;
        this.foregroundSat = 100;
        this.foregroundLight = 50;
        this.gradStart = '#0000ff';
        this.gradEnd = '#ff0000';
        this.blendMode = 'normal';
        
        this.backgroundOffset = 0;
        this.foregroundOffset = 0;
        // Create motion state and initialize values
        this.motionState = new MotionState(this.width, this.height);
        this.motionState.backgroundOffset = this.backgroundOffset;
        this.motionState.foregroundOffset = this.foregroundOffset;
        this.motionState.pathType = this.pathType;
        this.motionState.pathSpeed = this.pathSpeed;
        this.motionState.shapeVelX = this.shapeVelX;
        this.motionState.shapeVelY = this.shapeVelY;
        this.motionState.shapeMoveEnabled = this.shapeMoveEnabled;
        this.motionState.keyframeAnimations = this.keyframeAnimations;
        
        this.keyframeAnimations = {};
        this.keyframeStartTime = null;
        
        this.depthVideoSyncBaseTime = null;
        this.pauseTimestamp = null;
        this._depthVideoWasPlayingBeforePause = false;
        
        this.shapeMoveEnabled = false;
        this.contentX = this.width / 2;
        this.contentY = this.height / 2;
        this.shapeVelX = 2;
        this.shapeVelY = 2;
        
        // Mirror content position into motionState
        this.motionState.contentX = this.contentX;
        this.motionState.contentY = this.contentY;
        this.contentRenderer.contentX = this.motionState.contentX;
        this.contentRenderer.contentY = this.motionState.contentY;
        
        this._boundAnimate = this._animate.bind(this);
        // Attach render engine to delegate heavy rendering
        this.renderEngine = new RenderEngine(this);
    }

    // New API: render frame at a given timestamp into offscreen ImageData
    getFrameAtTime(timestamp) {
        // Use RenderEngine to produce ImageData for the requested timestamp
        const w = this.width, h = this.height;
        let off, ctx;
        if (typeof OffscreenCanvas !== 'undefined') {
            off = new OffscreenCanvas(w, h);
            ctx = off.getContext('2d');
        } else {
            off = document.createElement('canvas');
            off.width = w; off.height = h;
            ctx = off.getContext('2d');
        }
        const fakeNow = timestamp;
        const elapsedSeconds = (fakeNow - (this.startTime || fakeNow)) / 1000;
        const deltaSeconds = 0; // single-frame render, delta not meaningful
        this.updateMotionStateForElapsed(elapsedSeconds, deltaSeconds, timestamp);
        this.renderEngine.renderToContext(ctx, this, this.motionState, fakeNow, deltaSeconds, elapsedSeconds);
        try {
            return ctx.getImageData(0, 0, w, h);
        } catch (e) {
            // Some OffscreenCanvas contexts may not support getImageData; copy to a visible canvas
            if (off instanceof OffscreenCanvas) {
                const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
                const tmpCtx = tmp.getContext('2d');
                tmpCtx.drawImage(off, 0, 0);
                return tmpCtx.getImageData(0, 0, w, h);
            }
            throw e;
        }
    }
    
    _updateKeyframes(now) {
        if (!this.keyframeStartTime) this.keyframeStartTime = now;
        const elapsed = (now - this.keyframeStartTime) / 1000;
        for (let param in this.keyframeAnimations) {
            const anim = this.keyframeAnimations[param];
            let t;
            if (anim.loop && anim.duration > 0) {
                t = (elapsed % anim.duration) / anim.duration;
            } else {
                t = Math.min(1, elapsed / anim.duration);
            }
            const value = anim.start + (anim.end - anim.start) * t;
            if (param === 'speed') this.animationSpeed = value;
            else if (param === 'rotation') this.rotationSpeed = value;
            else if (param === 'scale') this.scaleFactor = value;
        }
    }
    
    _updateShapeMovement(deltaSeconds) {
        if (!this.shapeMoveEnabled) return;
        this.motionState.contentX += this.shapeVelX;
        this.motionState.contentY += this.shapeVelY;
        const shapeSize = this.contentRenderer.shapeSize;
        const halfSize = shapeSize / 2;
        if (this.motionState.contentX < halfSize || this.motionState.contentX > this.width - halfSize) this.shapeVelX *= -1;
        if (this.motionState.contentY < halfSize || this.motionState.contentY > this.height - halfSize) this.shapeVelY *= -1;
        this.contentRenderer.contentX = this.motionState.contentX;
        this.contentRenderer.contentY = this.motionState.contentY;
    }
    
    _updatePath() {
        if (this.animationMode !== 'content' || this.pathType === 'none') return;
        const radius = Math.min(this.width, this.height) * 0.3;
        let offsetX = 0, offsetY = 0;
        if (this.pathType === 'circle') {
            offsetX = Math.cos(this.motionState.pathAngle) * radius;
            offsetY = Math.sin(this.motionState.pathAngle) * radius;
        } else if (this.pathType === 'figure8') {
            offsetX = Math.cos(this.motionState.pathAngle) * radius;
            offsetY = Math.sin(this.motionState.pathAngle * 2) * radius / 2;
        }
        this.motionState.contentX = this.width / 2 + offsetX;
        this.motionState.contentY = this.height / 2 + offsetY;
        this.contentRenderer.contentX = this.motionState.contentX;
        this.contentRenderer.contentY = this.motionState.contentY;
        this.contentRenderer.markDirty();
    }
    
    // Rendering is delegated to RenderEngine. Controller no longer contains duplicated render implementations.
    
    _animate(timestamp) {
        if (this.isPaused) {
            this.animationFrameId = null;
            return;
        }
        
        this.animationFrameId = requestAnimationFrame(this._boundAnimate);
        
        if (!this.startTime) {
            this.startTime = timestamp;
            this.lastTimestamp = timestamp;
        }
        const elapsedSeconds = (timestamp - this.startTime) / 1000;
        let deltaSeconds = (timestamp - this.lastTimestamp) / 1000;
        if (deltaSeconds > 0.1) deltaSeconds = 0.1;
        this.lastTimestamp = timestamp;
        
        this._updateKeyframes(timestamp);
        this.updateMotionStateForElapsed(elapsedSeconds, deltaSeconds, timestamp);
        
        if (this.noiseGenerator.noiseType === 'dynamic') {
            this.noiseGenerator.refresh(this.animationMode, this.movementDirection);
        }
        
        if (this.isDepthAnimationMode && this.depthProcessor.depthSource === 'video') {
            const video = this.depthProcessor.depthVideo;
            if (video && video.readyState >= 2 && video.duration && isFinite(video.duration)) {
                const shouldPlay = this._depthVideoWasPlayingBeforePause || (typeof window !== 'undefined' && !!window._depthVideoWasPlaying);
                if (this.depthVideoSyncBaseTime === null) {
                    this.depthVideoSyncBaseTime = timestamp;
                    const targetTime = elapsedSeconds % video.duration;
                    if (Math.abs(video.currentTime - targetTime) > 0.1) {
                        video.currentTime = targetTime;
                    }
                    if (shouldPlay) {
                        video.play().catch(e => console.warn(e));
                    }
                } else {
                    if (shouldPlay && video.paused) {
                        video.play().catch(e => console.warn(e));
                    }
                }
            }
        }
        
        const currentDepthData = this.depthProcessor.getCurrentDepthData();
        
        // Delegate rendering to RenderEngine (thinned controller)
        try {
            this.renderEngine.renderToContext(this.ctx, this, this.motionState, timestamp, deltaSeconds, elapsedSeconds);
        } catch (e) {
            throw e;
        }
    }
    
    start() {
        this.isPaused = false;
        this.startTime = null;
        this.animationFrameId = requestAnimationFrame(this._boundAnimate);
    }
    
    pause() {
        this.isPaused = true;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.pauseTimestamp = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const video = this.depthProcessor && this.depthProcessor.depthVideo;
        if (video && typeof video.paused === 'boolean') {
            this._depthVideoWasPlayingBeforePause = !video.paused;
        } else if (typeof window !== 'undefined') {
            this._depthVideoWasPlayingBeforePause = !!window._depthVideoWasPlaying;
        } else {
            this._depthVideoWasPlayingBeforePause = false;
        }
    }
    
    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            if (this.pauseTimestamp && this.startTime) {
                const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                const pausedDuration = now - this.pauseTimestamp;
                this.startTime += pausedDuration;
            }
            this.pauseTimestamp = null;
            this.depthVideoSyncBaseTime = null;   // Force re-sync on resume
            this.animationFrameId = requestAnimationFrame(this._boundAnimate);
        }
    }

    
    setAnimationMode(mode) {
        this.animationMode = mode;
        this.isDepthAnimationMode = (mode === 'depth');
        if (!this.isDepthAnimationMode) {
            this.depthVideoSyncBaseTime = null;
        } else {
        }
        this.backgroundOffset = 0;
        this.foregroundOffset = 0;
        this.startTime = null;
        this.contentRenderer.markDirty();
    }
    
    refreshNoise() {
        this.noiseGenerator.refresh(this.animationMode, this.movementDirection);
    }
    
    // Update motionState (offsets, content position) based on elapsed time and delta.
    // This mimics the state-update part of _animate without rendering.
    updateMotionStateForElapsed(elapsedSeconds, deltaSeconds, nowTimestamp) {
        // Update keyframes if any
        if (Object.keys(this.keyframeAnimations).length > 0) {
            if (!this.keyframeStartTime) this.keyframeStartTime = nowTimestamp;
            const keyElapsed = (nowTimestamp - this.keyframeStartTime) / 1000;
            for (let param in this.keyframeAnimations) {
                const anim = this.keyframeAnimations[param];
                let t;
                if (anim.loop && anim.duration > 0) {
                    t = (keyElapsed % anim.duration) / anim.duration;
                } else {
                    t = Math.min(1, keyElapsed / anim.duration);
                }
                const value = anim.start + (anim.end - anim.start) * t;
                if (param === 'speed') this.animationSpeed = value;
                else if (param === 'rotation') this.rotationSpeed = value;
                else if (param === 'scale') this.scaleFactor = value;
            }
        }

        // Depth scaling for content mode
        let speedMultiplier = 1.0;
        if (this.useDepthScaling && this.depthProcessor.depthImageData) {
            const cx = Math.floor(this.motionState.contentX);
            const cy = Math.floor(this.motionState.contentY);
            if (cx >= 0 && cx < this.width && cy >= 0 && cy < this.height) {
                const depthIdx = (cy * this.width + cx) * 4;
                const depthVal = this.depthProcessor.depthImageData[depthIdx];
                speedMultiplier = 0.3 + (depthVal / 255) * 2.2;
            }
        }

        const pixelsPerSecond = 60;
        const scrollDelta = pixelsPerSecond * this.animationSpeed * deltaSeconds * speedMultiplier;
        if (this.movementDirection === 'vertical') {
            this.motionState.backgroundOffset = (this.motionState.backgroundOffset + scrollDelta) % this.height;
            this.motionState.foregroundOffset = (this.motionState.foregroundOffset - scrollDelta + this.height) % this.height;
        } else {
            this.motionState.backgroundOffset = (this.motionState.backgroundOffset + scrollDelta) % this.width;
            this.motionState.foregroundOffset = (this.motionState.foregroundOffset - scrollDelta + this.width) % this.width;
        }

        // Path motion (content mode)
        if (this.animationMode === 'content' && this.pathType !== 'none') {
            this.motionState.pathAngle += this.pathSpeed * deltaSeconds;
            this.motionState.pathAngle %= (2 * Math.PI);
            const radius = Math.min(this.width, this.height) * 0.3;
            let offsetX = 0, offsetY = 0;
            if (this.pathType === 'circle') {
                offsetX = Math.cos(this.motionState.pathAngle) * radius;
                offsetY = Math.sin(this.motionState.pathAngle) * radius;
            } else if (this.pathType === 'figure8') {
                offsetX = Math.cos(this.motionState.pathAngle) * radius;
                offsetY = Math.sin(this.motionState.pathAngle * 2) * radius / 2;
            }
            this.motionState.contentX = this.width / 2 + offsetX;
            this.motionState.contentY = this.height / 2 + offsetY;
            this.contentRenderer.contentX = this.motionState.contentX;
            this.contentRenderer.contentY = this.motionState.contentY;
            this.contentRenderer.markDirty();
        }
        // Shape movement (if enabled and no path)
        else if (this.animationMode === 'content' && this.shapeMoveEnabled && this.pathType === 'none') {
            this.motionState.contentX += this.shapeVelX;
            this.motionState.contentY += this.shapeVelY;
            const shapeSize = this.contentRenderer.shapeSize;
            const halfSize = shapeSize / 2;
            if (this.motionState.contentX < halfSize || this.motionState.contentX > this.width - halfSize) this.shapeVelX *= -1;
            if (this.motionState.contentY < halfSize || this.motionState.contentY > this.height - halfSize) this.shapeVelY *= -1;
            this.contentRenderer.contentX = this.motionState.contentX;
            this.contentRenderer.contentY = this.motionState.contentY;
            this.contentRenderer.markDirty();
        }

        // Sync back to motionState (updated outward directly)
    }
}