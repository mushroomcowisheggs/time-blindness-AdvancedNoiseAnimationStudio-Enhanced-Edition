// assets/js/classes/AnimationController.js
import { hexToRgb, getCoordinateColor, applyColorToPixel, blendPixel } from '../utils.js';

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
        
        this.foregroundColorMode = 'grayscale';
        this.foregroundHue = 0;
        this.foregroundSat = 100;
        this.foregroundLight = 50;
        this.gradStart = '#0000ff';
        this.gradEnd = '#ff0000';
        this.blendMode = 'normal';
        
        this.backgroundOffset = 0;
        this.foregroundOffset = 0;
        
        this.keyframeAnimations = {};
        this.keyframeStartTime = null;
        
        this.depthVideoSyncBaseTime = null;
        
        this.shapeMoveEnabled = false;
        this.contentX = this.width / 2;
        this.contentY = this.height / 2;
        this.shapeVelX = 2;
        this.shapeVelY = 2;
        
        this.contentRenderer.contentX = this.contentX;
        this.contentRenderer.contentY = this.contentY;
        
        this._boundAnimate = this._animate.bind(this);
    }
    
    _getOffsetIndex(x, y, offset) {
        const intOffset = Math.floor(offset);
        if (this.movementDirection === 'vertical') {
            const sy = ((y + intOffset) % this.height + this.height) % this.height;
            return sy * this.width + x;
        } else {
            const sx = ((x + intOffset) % this.width + this.width) % this.width;
            return y * this.width + sx;
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
        this.contentX += this.shapeVelX;
        this.contentY += this.shapeVelY;
        const shapeSize = this.contentRenderer.shapeSize;
        const halfSize = shapeSize / 2;
        if (this.contentX < halfSize || this.contentX > this.width - halfSize) this.shapeVelX *= -1;
        if (this.contentY < halfSize || this.contentY > this.height - halfSize) this.shapeVelY *= -1;
        this.contentRenderer.contentX = this.contentX;
        this.contentRenderer.contentY = this.contentY;
    }
    
    _updatePath() {
        if (this.animationMode !== 'content' || this.pathType === 'none') return;
        const radius = Math.min(this.width, this.height) * 0.3;
        let offsetX = 0, offsetY = 0;
        if (this.pathType === 'circle') {
            offsetX = Math.cos(this.pathAngle) * radius;
            offsetY = Math.sin(this.pathAngle) * radius;
        } else if (this.pathType === 'figure8') {
            offsetX = Math.cos(this.pathAngle) * radius;
            offsetY = Math.sin(this.pathAngle * 2) * radius / 2;
        }
        this.contentX = this.width / 2 + offsetX;
        this.contentY = this.height / 2 + offsetY;
        this.contentRenderer.contentX = this.contentX;
        this.contentRenderer.contentY = this.contentY;
        this.contentRenderer.markDirty();
    }
    
    _getBackgroundImageData() {
        const imageData = this.ctx.createImageData(this.width, this.height);
        const data = imageData.data;
        if (this.removeBackgroundNoise) {
            const bg = hexToRgb(this.backgroundColor);
            for (let i = 0; i < data.length; i += 4) {
                data[i] = bg.r;
                data[i+1] = bg.g;
                data[i+2] = bg.b;
                data[i+3] = 255;
            }
        } else {
            const noiseField = this.noiseGenerator.noiseField;
            for (let i = 0; i < this.width * this.height; i++) {
                const val = noiseField[i];
                const idx = i * 4;
                data[idx] = val;
                data[idx+1] = val;
                data[idx+2] = val;
                data[idx+3] = 255;
            }
        }
        return imageData;
    }
    
    _renderDepthMode(currentDepthData, elapsedSeconds, timestamp) {
        const { width, height, movementDirection, depthProcessor, noiseGenerator, removeBackgroundNoise, backgroundColor, depthThreshold, backgroundMode, blendMode, foregroundColorMode } = this;
        const pixelsPerSecond = depthProcessor.foregroundSpeed * depthProcessor.depthScale;
        const totalOffset = pixelsPerSecond * elapsedSeconds;
        const offset = movementDirection === 'vertical'
            ? Math.floor(totalOffset) % height
            : Math.floor(totalOffset) % width;

        const imageData = this.ctx.createImageData(width, height);
        const data = imageData.data;
        const noiseField = noiseGenerator.noiseField;
        const solidBg = hexToRgb(backgroundColor);
        const colorParams = {
            foregroundHue: this.foregroundHue,
            foregroundSat: this.foregroundSat,
            gradStart: this.gradStart,
            gradEnd: this.gradEnd
        };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                let depth = 0;
                if (currentDepthData) {
                    depth = currentDepthData[i];
                    if (depth >= depthProcessor.lowerThreshold && depth <= depthProcessor.upperThreshold) {
                        const neighbors = [];
                        if (x > 0) neighbors.push(currentDepthData[i - 4]);
                        if (x < width - 1) neighbors.push(currentDepthData[i + 4]);
                        if (y > 0) neighbors.push(currentDepthData[(y - 1) * width * 4 + x * 4]);
                        if (y < height - 1) neighbors.push(currentDepthData[(y + 1) * width * 4 + x * 4]);
                        for (const nd of neighbors) {
                            if (Math.abs(depth - nd) > depthProcessor.edgeThreshold) {
                                depth = 0;
                                break;
                            }
                        }
                    }
                }

                // Foreground sampling with depth offset
                let offsetX = x, offsetY = y;
                if (depth >= depthProcessor.lowerThreshold && depth <= depthProcessor.upperThreshold) {
                    if (movementDirection === 'vertical') offsetY = (y + offset) % height;
                    else offsetX = (x + offset) % width;
                }
                const sampleIndex = offsetY * width + offsetX;
                const noiseValue = noiseField[sampleIndex];

                let fgColor;
                if (noiseGenerator.noiseType === 'colourful') {
                    if (noiseValue > 0) {
                        fgColor = getCoordinateColor(offsetX, offsetY, timestamp);
                    } else {
                        fgColor = { r: 0, g: 0, b: 0 };
                    }
                } else {
                    fgColor = applyColorToPixel(noiseValue, foregroundColorMode, colorParams);
                }

                // Quick path: removeBackgroundNoise + low depth -> solid color
                const isDepthLow = currentDepthData && currentDepthData[i] < (depthThreshold * 2.55);
                if (removeBackgroundNoise && isDepthLow) {
                    data[i] = solidBg.r;
                    data[i+1] = solidBg.g;
                    data[i+2] = solidBg.b;
                    data[i+3] = 255;
                    continue;
                }

                // Calculate background color based on backgroundMode
                let bgColor = { r: 0, g: 0, b: 0 };
                switch (backgroundMode) {
                    case 'static':
                        bgColor = solidBg;
                        break;
                    case 'dynamic': {
                        const bgNoiseVal = noiseGenerator.backgroundNoise[sampleIndex] ?? 0;
                        bgColor = applyColorToPixel(bgNoiseVal, foregroundColorMode, colorParams);
                        break;
                    }
                    case 'mixed': {
                        const bgNoiseVal = noiseGenerator.backgroundNoise[sampleIndex] ?? 0;
                        const dynamicBg = applyColorToPixel(bgNoiseVal, foregroundColorMode, colorParams);
                        bgColor = blendPixel(solidBg, dynamicBg, blendMode);
                        break;
                    }
                    default:
                        bgColor = solidBg;
                }

                // Final blend between background and foreground
                const finalColor = blendPixel(bgColor, fgColor, blendMode);
                data[i] = finalColor.r;
                data[i+1] = finalColor.g;
                data[i+2] = finalColor.b;
                data[i+3] = 255;
            }
        }
        this.ctx.putImageData(imageData, 0, 0);
    }
    
    _renderContentMode(deltaSeconds, elapsedSeconds, timestamp) {
        const { width, height, noiseGenerator, contentRenderer, movementDirection, backgroundMode, animationSpeed, useDepthScaling, rotationSpeed, scaleFactor, waveStrength, foregroundColorMode, blendMode } = this;
        
        let speedMultiplier = 1.0;
        if (useDepthScaling && this.depthProcessor.depthImageData) {
            const cx = Math.floor(this.contentX);
            const cy = Math.floor(this.contentY);
            if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
                const depthIdx = (cy * width + cx) * 4;
                const depthVal = this.depthProcessor.depthImageData[depthIdx];
                speedMultiplier = 0.3 + (depthVal / 255) * 2.2;
            }
        }
        
        const pixelsPerSecond = 60;
        const scrollDelta = pixelsPerSecond * animationSpeed * deltaSeconds * speedMultiplier;
        if (movementDirection === 'vertical') {
            this.backgroundOffset = (this.backgroundOffset + scrollDelta) % height;
            this.foregroundOffset = (this.foregroundOffset - scrollDelta + height) % height;
        } else {
            this.backgroundOffset = (this.backgroundOffset + scrollDelta) % width;
            this.foregroundOffset = (this.foregroundOffset - scrollDelta + width) % width;
        }
        
        const backgroundImageData = this._getBackgroundImageData();
        const backgroundData = backgroundImageData.data;
        
        let foregroundData;
        const needTransform = (this.rotationSpeed !== 0 || this.scaleFactor !== 1 || this.waveStrength !== 0 || this.pathType !== 'none' || this.shapeMoveEnabled);
        if (!needTransform && contentRenderer.useMaskCache) {
            foregroundData = contentRenderer.getMaskData();
        } else {
            foregroundData = contentRenderer.renderTransformedContent(
                this.contentX, this.contentY,
                this.rotationSpeed * elapsedSeconds,
                this.scaleFactor,
                this.waveStrength,
                timestamp / 1000
            );
        }
        
        const resultData = this.ctx.createImageData(width, height);
        const outData = resultData.data;
        const noiseType = noiseGenerator.noiseType;
        const foregroundNoise = noiseGenerator.foregroundNoise;
        const backgroundNoise = noiseGenerator.backgroundNoise;
        const colorParams = {
            foregroundHue: this.foregroundHue,
            foregroundSat: this.foregroundSat,
            gradStart: this.gradStart,
            gradEnd: this.gradEnd
        };
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const isForeground = foregroundData[idx] > 128;
                
                if (isForeground) {
                    const noiseIdx = this._getOffsetIndex(x, y, this.foregroundOffset);
                    const noiseVal = foregroundNoise[noiseIdx];
                    let color;
                    if (noiseType === 'colourful' && foregroundColorMode === 'grayscale') {
                        if (noiseVal > 0) {
                            const sampleX = movementDirection === 'vertical' ? x : ((x + Math.floor(this.foregroundOffset)) % width + width) % width;
                            const sampleY = movementDirection === 'vertical' ? ((y + Math.floor(this.foregroundOffset)) % height + height) % height : y;
                            color = getCoordinateColor(sampleX, sampleY, timestamp);
                        } else {
                            color = { r: 0, g: 0, b: 0 };
                        }
                    } else {
                        color = applyColorToPixel(noiseVal, foregroundColorMode, colorParams);
                    }
                    outData[idx] = color.r;
                    outData[idx+1] = color.g;
                    outData[idx+2] = color.b;
                    outData[idx+3] = 255;
                } else {
                    if (backgroundMode === 'static') {
                        outData[idx] = backgroundData[idx];
                        outData[idx+1] = backgroundData[idx+1];
                        outData[idx+2] = backgroundData[idx+2];
                        outData[idx+3] = 255;
                    } else {
                        const noiseIdx = this._getOffsetIndex(x, y, this.backgroundOffset);
                        const noiseVal = backgroundNoise[noiseIdx];
                        let noiseColor;
                        if (noiseType === 'colourful' && foregroundColorMode === 'grayscale') {
                            if (noiseVal > 0) {
                                const sampleX = movementDirection === 'vertical' ? x : ((x + Math.floor(this.backgroundOffset)) % width + width) % width;
                                const sampleY = movementDirection === 'vertical' ? ((y + Math.floor(this.backgroundOffset)) % height + height) % height : y;
                                noiseColor = getCoordinateColor(sampleX, sampleY, timestamp);
                            } else {
                                noiseColor = { r: 0, g: 0, b: 0 };
                            }
                        } else {
                            noiseColor = applyColorToPixel(noiseVal, foregroundColorMode, colorParams);
                        }
                        if (backgroundMode === 'dynamic') {
                            outData[idx] = noiseColor.r;
                            outData[idx+1] = noiseColor.g;
                            outData[idx+2] = noiseColor.b;
                            outData[idx+3] = 255;
                        } else if (backgroundMode === 'mixed') {
                            const bgColor = {
                                r: backgroundData[idx],
                                g: backgroundData[idx + 1],
                                b: backgroundData[idx + 2]
                            };
                            const blended = blendPixel(bgColor, noiseColor, blendMode);
                            outData[idx] = blended.r;
                            outData[idx+1] = blended.g;
                            outData[idx+2] = blended.b;
                            outData[idx+3] = 255;
                        }
                    }
                }
            }
        }
        this.ctx.putImageData(resultData, 0, 0);
    }
    
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
        
        if (this.noiseGenerator.noiseType === 'dynamic') {
            this.noiseGenerator.refresh(this.animationMode, this.movementDirection);
        }
        
        if (this.animationMode === 'content' && this.pathType !== 'none') {
            this.pathAngle += this.pathSpeed * deltaSeconds;
            this.pathAngle %= (2 * Math.PI);
            this._updatePath();
        }
        
        if (this.animationMode === 'content' && this.contentRenderer.contentType === 'shape' && this.pathType === 'none') {
            this._updateShapeMovement(deltaSeconds);
            this.contentRenderer.markDirty();
        }
        
        if (this.isDepthAnimationMode && this.depthProcessor.depthSource === 'video') {
        const video = this.depthProcessor.depthVideo;
        if (video && video.readyState >= 2 && video.duration && isFinite(video.duration)) {
            if (this.depthVideoSyncBaseTime === null) {
                this.depthVideoSyncBaseTime = timestamp;
                const targetTime = elapsedSeconds % video.duration;
                if (Math.abs(video.currentTime - targetTime) > 0.1) {
                    video.currentTime = targetTime;
                }
                video.play().catch(e => console.warn);
            } else {
                if (video.paused) {
                    video.play().catch(e => console.warn);
                }
            }
        }
    }
        
        const currentDepthData = this.depthProcessor.getCurrentDepthData();
        
        if (this.isDepthAnimationMode || this.depthProcessor.depthImageData) {
            if (this.isDepthAnimationMode) {
                this._renderDepthMode(currentDepthData, elapsedSeconds, timestamp);
                return;
            }
        }
        
        if (this.animationMode === 'content') {
            this._renderContentMode(deltaSeconds, elapsedSeconds, timestamp);
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
    }
    
    resume() {
        if (this.isPaused) {
            this.isPaused = false;
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
}