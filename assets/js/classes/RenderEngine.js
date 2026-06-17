import { hexToRgb, getCoordinateColor } from '../utils.js';
import ColorMapper from './ColorMapper.js';

export default class RenderEngine {
    constructor(controller) {
        this.controller = controller;
        this.width = controller.width;
        this.height = controller.height;
        this.colorMapper = new ColorMapper();
    }

    // Pure rendering: produce ImageData for given controller/motionState at timestamp
    renderToImageData(controller, motionState, timestamp, deltaSeconds = 0, elapsedSeconds = 0) {
        const w = this.width;
        const h = this.height;
        let offscreen, ctx;
        if (typeof OffscreenCanvas !== 'undefined') {
            offscreen = new OffscreenCanvas(w, h);
            ctx = offscreen.getContext('2d', { willReadFrequently: true });
        } else {
            offscreen = document.createElement('canvas');
            offscreen.width = w;
            offscreen.height = h;
            ctx = offscreen.getContext('2d', { willReadFrequently: true });
        }
        // Delegate the actual drawing using existing renderToContext logic
        this.renderToContext(ctx, controller, motionState, timestamp, deltaSeconds, elapsedSeconds);
        try {
            return ctx.getImageData(0, 0, w, h);
        } catch (e) {
            // Some OffscreenCanvas contexts may not implement getImageData in older browsers
            // Fallback: copy pixels by putting into a visible canvas then reading
            if (offscreen instanceof OffscreenCanvas) {
                const tmp = document.createElement('canvas');
                tmp.width = w; tmp.height = h;
                const tmpCtx = tmp.getContext('2d', { willReadFrequently: true });
                tmpCtx.drawImage(offscreen, 0, 0);
                return tmpCtx.getImageData(0, 0, w, h);
            }
            throw e;
        }
    }

    // Render into provided 2D context for given timestamp
    // Accepts an explicit motionState to avoid reaching back into controller internals
    renderToContext(ctx, controller, motionState, timestamp, deltaSeconds = 0, elapsedSeconds = 0) {
        const c = controller;
        // choose depth/content mode
        if (c.isDepthAnimationMode) {
            this._renderDepthMode(ctx, c, motionState, elapsedSeconds, timestamp);
        } else {
            this._renderContentMode(ctx, c, motionState, elapsedSeconds, timestamp);
        }
    }

    _getOffsetIndex(width, height, movementDirection, x, y, offset) {
        const intOffset = Math.floor(offset);
        if (movementDirection === 'vertical') {
            const sy = ((y + intOffset) % height + height) % height;
            return sy * width + x;
        } else {
            const sx = ((x + intOffset) % width + width) % width;
            return y * width + sx;
        }
    }

    _renderDepthMode(ctx, c, motionState, elapsedSeconds, timestamp) {
        const { width, height } = this;
        const { movementDirection, depthProcessor, noiseGenerator } = c;
        const pixelsPerSecond = depthProcessor.foregroundSpeed * depthProcessor.depthScale;
        const totalOffset = pixelsPerSecond * elapsedSeconds;
        let rawOffset;
        if (movementDirection === 'vertical') {
            rawOffset = Math.floor(totalOffset) % height;
        } else {
            rawOffset = Math.floor(totalOffset) % width;
        }
        
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        const noiseField = noiseGenerator.noiseField;
        const solidBg = hexToRgb(c.backgroundColor);
        const colorParams = {
            foregroundHue: c.foregroundHue,
            foregroundSat: c.foregroundSat,
            gradStart: c.gradStart,
            gradEnd: c.gradEnd
        };

        const currentDepthData = depthProcessor.getCurrentDepthData();
        const useUnified = c.unifiedGradient && c.noiseGenerator.noiseType === 'gradient';
        
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

                let offsetX = x, offsetY = y;
                const isDepthInRange = (depth >= depthProcessor.lowerThreshold && depth <= depthProcessor.upperThreshold);
                if (isDepthInRange) {
                    // Inside the threshold: forward scrolling
                    if (movementDirection === 'vertical') {
                        offsetY = (y + rawOffset) % height;
                    } else {
                        offsetX = (x + rawOffset) % width;
                    }
                } else if (c.enableOpposingMotion) {
                    // Outside the threshold and reverse scrolling has been enabled
                    if (movementDirection === 'vertical') {
                        offsetY = (y - rawOffset + height) % height;
                    } else {
                        offsetX = (x - rawOffset + width) % width;
                    }
                } else {
                    // If reverse scrolling is not enabled, the original coordinates (stationary) will remain. 
                }
                const sampleIndex = offsetY * width + offsetX;
                const noiseValue = noiseField[sampleIndex];
                
                if (useUnified) {
                    const unifiedColor = this.colorMapper.applyColorToPixel(
                        noiseValue, 
                        c.foregroundColorMode, 
                        { foregroundHue: c.foregroundHue, foregroundSat: c.foregroundSat, gradStart: c.gradStart, gradEnd: c.gradEnd }
                    );
                    data[i] = unifiedColor.r;
                    data[i+1] = unifiedColor.g;
                    data[i+2] = unifiedColor.b;
                    data[i+3] = 255;
                    continue;
                }
                
                let fgColor;
                if (noiseGenerator.noiseType === 'colourful') {
                    if (noiseValue > 0) {
                        fgColor = getCoordinateColor(offsetX, offsetY, timestamp);
                    } else {
                        fgColor = { r: 0, g: 0, b: 0 };
                    }
                } else {
                    fgColor = this.colorMapper.applyColorToPixel(noiseValue, c.foregroundColorMode, colorParams);
                }

                const isDepthLow = currentDepthData && currentDepthData[i] < (c.depthThreshold * 2.55);
                if (c.removeBackgroundNoise && isDepthLow) {
                    data[i] = solidBg.r; data[i+1] = solidBg.g; data[i+2] = solidBg.b; data[i+3] = 255; continue;
                }
                let bgColor = { r: 0, g: 0, b: 0 };
                switch (c.backgroundMode) {
                    case 'static': bgColor = solidBg; break;
                    case 'dynamic': {
                        const bgNoiseVal = noiseGenerator.backgroundNoise[sampleIndex] ?? 0;
                        bgColor = this.colorMapper.applyColorToPixel(bgNoiseVal, c.foregroundColorMode, colorParams);
                        break;
                    }
                    case 'mixed': {
                        const bgNoiseVal = noiseGenerator.backgroundNoise[sampleIndex] ?? 0;
                        const dynamicBg = this.colorMapper.applyColorToPixel(bgNoiseVal, c.foregroundColorMode, colorParams);
                        bgColor = this.colorMapper.blendPixel(solidBg, dynamicBg, c.blendMode);
                        break;
                    }
                    default: bgColor = solidBg;
                }

                const finalColor = this.colorMapper.blendPixel(bgColor, fgColor, c.blendMode);
                data[i] = finalColor.r; data[i+1] = finalColor.g; data[i+2] = finalColor.b; data[i+3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }

    _renderContentMode(ctx, c, motionState, elapsedSeconds, timestamp) {
        const { width, height } = this;
        const { noiseGenerator, contentRenderer, movementDirection } = c;

        let speedMultiplier = 1.0;
        if (c.useDepthScaling && c.depthProcessor.depthImageData) {
            const cx = Math.floor(motionState.contentX);
            const cy = Math.floor(motionState.contentY);
            if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
                const depthIdx = (cy * width + cx) * 4;
                const depthVal = c.depthProcessor.depthImageData[depthIdx];
                speedMultiplier = 0.3 + (depthVal / 255) * 2.2;
            }
        }

        const backgroundImageData = (function(){
            const imageData = ctx.createImageData(width, height);
            const data = imageData.data;
            if (c.removeBackgroundNoise) {
                const bg = hexToRgb(c.backgroundColor);
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = bg.r; data[i+1] = bg.g; data[i+2] = bg.b; data[i+3] = 255;
                }
            } else {
                const noiseField = noiseGenerator.noiseField;
                for (let i = 0; i < width * height; i++) {
                    const val = noiseField[i];
                    const idx = i * 4;
                    data[idx] = val; data[idx+1] = val; data[idx+2] = val; data[idx+3] = 255;
                }
            }
            return imageData;
        })();
        const backgroundData = backgroundImageData.data;

        let foregroundData;
        const needTransform = (c.rotationSpeed !== 0 || c.scaleFactor !== 1 || c.waveStrength !== 0 || c.pathType !== 'none' || c.shapeMoveEnabled);
        if (!needTransform && contentRenderer.useMaskCache) {
            foregroundData = contentRenderer.getMaskData();
        } else {
            foregroundData = contentRenderer.renderTransformedContent(
                motionState.contentX, motionState.contentY,
                c.rotationSpeed * elapsedSeconds,
                c.scaleFactor,
                c.waveStrength,
                timestamp / 1000
            );
        }

        const resultData = ctx.createImageData(width, height);
        const outData = resultData.data;
        const noiseType = noiseGenerator.noiseType;
        const foregroundNoise = noiseGenerator.foregroundNoise;
        const backgroundNoise = noiseGenerator.backgroundNoise;
        const colorParams = {
            foregroundHue: c.foregroundHue,
            foregroundSat: c.foregroundSat,
            gradStart: c.gradStart,
            gradEnd: c.gradEnd
        };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const isForeground = foregroundData[idx] > 128;

                if (isForeground) {
                    const noiseIdx = this._getOffsetIndex(width, height, movementDirection, x, y, motionState.foregroundOffset);
                    const noiseVal = foregroundNoise[noiseIdx];
                    let color;
                    if (noiseType === 'colourful' && c.foregroundColorMode === 'grayscale') {
                        if (noiseVal > 0) {
                            const sampleX = movementDirection === 'vertical' ? x : ((x + Math.floor(motionState.foregroundOffset)) % width + width) % width;
                            const sampleY = movementDirection === 'vertical' ? ((y + Math.floor(motionState.foregroundOffset)) % height + height) % height : y;
                            color = getCoordinateColor(sampleX, sampleY, timestamp);
                        } else {
                            color = { r: 0, g: 0, b: 0 };
                        }
                    } else {
                        color = this.colorMapper.applyColorToPixel(noiseVal, c.foregroundColorMode, colorParams);
                    }
                    outData[idx] = color.r; outData[idx+1] = color.g; outData[idx+2] = color.b; outData[idx+3] = 255;
                } else {
                    if (c.backgroundMode === 'static') {
                        outData[idx] = backgroundData[idx]; outData[idx+1] = backgroundData[idx+1]; outData[idx+2] = backgroundData[idx+2]; outData[idx+3] = 255;
                    } else {
                        const noiseIdx = this._getOffsetIndex(width, height, movementDirection, x, y, motionState.backgroundOffset);
                        const noiseVal = backgroundNoise[noiseIdx];
                        let noiseColor;
                        if (noiseType === 'colourful' && c.foregroundColorMode === 'grayscale') {
                            if (noiseVal > 0) {
                                const sampleX = movementDirection === 'vertical' ? x : ((x + Math.floor(motionState.backgroundOffset)) % width + width) % width;
                                const sampleY = movementDirection === 'vertical' ? ((y + Math.floor(motionState.backgroundOffset)) % height + height) % height : y;
                                noiseColor = getCoordinateColor(sampleX, sampleY, timestamp);
                            } else {
                                noiseColor = { r: 0, g: 0, b: 0 };
                            }
                        } else {
                            noiseColor = this.colorMapper.applyColorToPixel(noiseVal, c.foregroundColorMode, colorParams);
                        }
                        if (c.backgroundMode === 'dynamic') {
                            outData[idx] = noiseColor.r; outData[idx+1] = noiseColor.g; outData[idx+2] = noiseColor.b; outData[idx+3] = 255;
                        } else if (c.backgroundMode === 'mixed') {
                            const bgColor = { r: backgroundData[idx], g: backgroundData[idx+1], b: backgroundData[idx+2] };
                            const blended = this.colorMapper.blendPixel(bgColor, noiseColor, c.blendMode);
                            outData[idx] = blended.r; outData[idx+1] = blended.g; outData[idx+2] = blended.b; outData[idx+3] = 255;
                        }
                    }
                }
            }
        }
        ctx.putImageData(resultData, 0, 0);
    }
}
