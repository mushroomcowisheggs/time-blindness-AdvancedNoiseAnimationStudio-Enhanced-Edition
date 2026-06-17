// assets/js/classes/ContentRenderer.js
export default class ContentRenderer {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        
        this.contentType = 'text';
        this.currentText = 'NOISE';
        this.currentImage = null;
        this.fontSize = 30;
        this.shapeType = 'rectangle';
        this.shapeSize = 100;
        this.shapeSides = 5;
        this.contentX = width / 2;
        this.contentY = height / 2;
        
        this.maskData = null;
        this.maskDirty = true;
        this.useMaskCache = true;
        
        this.offCanvas = document.createElement('canvas');
        this.offCanvas.width = width;
        this.offCanvas.height = height;
        this.offCtx = this.offCanvas.getContext('2d', { willReadFrequently: true });
        
        this.cachedContentCanvas = document.createElement('canvas');
        this.cachedContentCanvas.width = width;
        this.cachedContentCanvas.height = height;
        this.cachedContentCtx = this.cachedContentCanvas.getContext('2d', { willReadFrequently: true });
        
        this.contentParamsHash = '';
        this.smallCanvas = document.createElement('canvas');
        this.smallCtx = this.smallCanvas.getContext('2d', { willReadFrequently: true });
        this.distortionScale = 0.1;
    }
    
    setSize(width, height) {
        this.width = width;
        this.height = height;
        this.offCanvas.width = width;
        this.offCanvas.height = height;
        this.smallCanvas.width = Math.ceil(width * this.distortionScale);
        this.smallCanvas.height = Math.ceil(height * this.distortionScale);
        this.maskDirty = true;
    }
    
    markDirty() {
        this.maskDirty = true;
    }
    
    isStatic(pathType, shapeMoveEnabled, waveStrength) {
        return pathType === 'none' && !shapeMoveEnabled && waveStrength === 0;
    }
    
    wrapTextLines(ctx, text, maxWidth) {
        const words = text.split(/\s+/);
        const lines = [];
        let line = "";
        words.forEach(word => {
            const testLine = line ? line + " " + word : word;
            if (ctx.measureText(testLine).width > maxWidth && line) {
                lines.push(line);
                line = word;
            } else {
                line = testLine;
            }
        });
        if (line) lines.push(line);
        return lines;
    }
    
    autoScaleFont(ctx, text, fontSize) {
        const minDim = Math.min(this.width, this.height);
        let trySize = minDim * (fontSize / 100);
        const maxWidth = this.width * 0.9;
        const maxHeight = this.height * 0.9;
        const lhFactor = 1.2;
        for (; trySize >= 10; trySize--) {
            ctx.font = `bold ${trySize}px sans-serif`;
            const lines = this.wrapTextLines(ctx, text, maxWidth);
            const totalH = lines.length * (trySize * lhFactor);
            if (totalH <= maxHeight) return trySize;
        }
        return 10;
    }
    
    drawShape(ctx, cx, cy) {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        const { shapeType, shapeSize, shapeSides } = this;
        if (shapeType === 'rectangle') {
            ctx.rect(cx - shapeSize / 2, cy - shapeSize / 2, shapeSize, shapeSize);
        } else if (shapeType === 'circle') {
            ctx.arc(cx, cy, shapeSize / 2, 0, 2 * Math.PI);
        } else if (shapeType === 'polygon') {
            const sides = Math.max(3, shapeSides);
            const r = shapeSize / 2;
            for (let i = 0; i < sides; i++) {
                const angle = (i / sides) * (2 * Math.PI);
                const px = cx + r * Math.cos(angle);
                const py = cy + r * Math.sin(angle);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
        }
        ctx.fill();
    }
    
    _updateMaskInternal() {
        const mCanvas = document.createElement('canvas');
        mCanvas.width = this.width;
        mCanvas.height = this.height;
        const mCtx = mCanvas.getContext('2d', { willReadFrequently: true });
        mCtx.clearRect(0, 0, this.width, this.height);
        
        const { contentType, currentText, currentImage, contentX, contentY, shapeType, fontSize, shapeSize, shapeSides } = this;
        
        if (contentType === 'text') {
            const finalSize = this.autoScaleFont(mCtx, currentText, fontSize);
            mCtx.font = `bold ${finalSize}px sans-serif`;
            mCtx.fillStyle = 'white';
            mCtx.textAlign = 'center';
            mCtx.textBaseline = 'middle';
            const maxWidth = this.width * 0.9;
            const lineH = finalSize * 1.2;
            const lines = this.wrapTextLines(mCtx, currentText, maxWidth);
            const totalH = lines.length * lineH;
            let startY = contentY - totalH / 2;
            lines.forEach(line => {
                mCtx.fillText(line, contentX, startY + lineH / 2);
                startY += lineH;
            });
        } else if (contentType === 'image' && currentImage) {
            const margin = 20;
            const mw = this.width - margin * 2;
            const mh = this.height - margin * 2;
            const scale = Math.min(mw / currentImage.width, mh / currentImage.height, 1);
            const dw = currentImage.width * scale;
            const dh = currentImage.height * scale;
            const dx = contentX - dw / 2;
            const dy = contentY - dh / 2;
            mCtx.drawImage(currentImage, dx, dy, dw, dh);
        } else if (contentType === 'shape') {
            this.drawShape(mCtx, contentX, contentY);
        }
        
        this.maskData = mCtx.getImageData(0, 0, this.width, this.height).data;
    }
    
    _updateContentCache() {
        const { width, height, contentType, currentText, currentImage, shapeType, shapeSize, shapeSides, fontSize } = this;
        // Check if content is changed
        const newHash = `${contentType}|${currentText}|${fontSize}|${currentImage?.src || ''}|${shapeType}|${shapeSize}|${shapeSides}`;
        if (this.contentParamsHash === newHash && this.cachedContentCanvas.width === width) {
            return;
        }
        this.contentParamsHash = newHash;
        
        const ctx = this.cachedContentCtx;
        ctx.clearRect(0, 0, width, height);
        
        if (contentType === 'text') {
            const finalSize = this.autoScaleFont(ctx, currentText, fontSize);
            ctx.font = `bold ${finalSize}px sans-serif`;
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const maxWidth = width * 0.9;
            const lineH = finalSize * 1.2;
            const lines = this.wrapTextLines(ctx, currentText, maxWidth);
            const totalH = lines.length * lineH;
            let startY = height / 2 - totalH / 2;
            lines.forEach(line => {
                ctx.fillText(line, width / 2, startY + lineH / 2);
                startY += lineH;
            });
        } else if (contentType === 'image' && currentImage) {
            const margin = 20;
            const mw = width - margin * 2;
            const mh = height - margin * 2;
            const imgScale = Math.min(mw / currentImage.width, mh / currentImage.height, 1);
            const dw = currentImage.width * imgScale;
            const dh = currentImage.height * imgScale;
            const dx = (width - dw) / 2;
            const dy = (height - dh) / 2;
            ctx.drawImage(currentImage, dx, dy, dw, dh);
        } else if (contentType === 'shape') {
            ctx.fillStyle = 'white';
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.beginPath();
            if (shapeType === 'rectangle') {
                ctx.rect(-shapeSize/2, -shapeSize/2, shapeSize, shapeSize);
            } else if (shapeType === 'circle') {
                ctx.arc(0, 0, shapeSize/2, 0, 2 * Math.PI);
            } else if (shapeType === 'polygon') {
                const sides = Math.max(3, shapeSides);
                const r = shapeSize/2;
                for (let i = 0; i < sides; i++) {
                    const angle = (i / sides) * 2 * Math.PI;
                    const px = r * Math.cos(angle);
                    const py = r * Math.sin(angle);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
            }
            ctx.fill();
            ctx.restore();
        }
    }
    
    getMaskData(forceUpdate = false) {
        if (forceUpdate || this.maskDirty || !this.maskData) {
            this._updateMaskInternal();
            this.maskDirty = false;
        }
        return this.maskData;
    }
    
    applyWaveDistortion(imageData, strength, time) {
        if (strength === 0) return;
        const w = imageData.width, h = imageData.height;
        const srcData = new Uint8ClampedArray(imageData.data);
        
        // Avoid repeated sin/cos calculation
        const rowOffsets = new Float32Array(h);
        const timeFactorRow = time * 0.05;
        for (let y = 0; y < h; y++) {
            rowOffsets[y] = Math.sin(y * 0.05 + timeFactorRow) * strength;
        }
        const colOffsets = new Float32Array(w);
        const timeFactorCol = time * 0.7;
        for (let x = 0; x < w; x++) {
            colOffsets[x] = Math.cos(x * 0.05 + timeFactorCol) * strength;
        }
        
        for (let y = 0; y < h; y++) {
            const offsetY = rowOffsets[y];
            const srcY = Math.min(h - 1, Math.max(0, y + offsetY));
            const srcRowStart = srcY * w * 4;
            const dstRowStart = y * w * 4;
            for (let x = 0; x < w; x++) {
                const offsetX = colOffsets[x];
                const srcX = Math.min(w - 1, Math.max(0, x + offsetX));
                const srcIdx = srcRowStart + srcX * 4;
                const dstIdx = dstRowStart + x * 4;
                imageData.data[dstIdx] = srcData[srcIdx];
                imageData.data[dstIdx+1] = srcData[srcIdx+1];
                imageData.data[dstIdx+2] = srcData[srcIdx+2];
                imageData.data[dstIdx+3] = srcData[srcIdx+3];
            }
        }
    }
    
    renderTransformedContent(cx, cy, angle, scale, waveStrength, time) {
        this._updateContentCache();
        
        const { width, height, offCtx, offCanvas, smallCanvas, smallCtx } = this;
        offCtx.clearRect(0, 0, width, height);
        
        offCtx.save();
        offCtx.translate(cx, cy);
        offCtx.rotate(angle);
        offCtx.scale(scale, scale);
        offCtx.translate(-width/2, -height/2);
        offCtx.drawImage(this.cachedContentCanvas, 0, 0);
        offCtx.restore();
        
        if (waveStrength === 0) {
            return offCtx.getImageData(0, 0, width, height).data;
        }
        
        const smallW = smallCanvas.width;
        const smallH = smallCanvas.height;
        
        smallCtx.clearRect(0, 0, smallW, smallH);
        smallCtx.drawImage(offCanvas, 0, 0, smallW, smallH);
        
        let smallImageData = smallCtx.getImageData(0, 0, smallW, smallH);
        const distortionStrength = waveStrength * Math.sin(time);
        this.applyWaveDistortion(smallImageData, distortionStrength, time);
        smallCtx.putImageData(smallImageData, 0, 0);
        
        offCtx.drawImage(smallCanvas, 0, 0, width, height);
        
        return offCtx.getImageData(0, 0, width, height).data;
    }
}