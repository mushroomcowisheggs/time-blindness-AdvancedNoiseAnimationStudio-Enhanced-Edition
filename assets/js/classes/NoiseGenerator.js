// assets/js/classes/NoiseGenerator.js
import PerlinNoise from "./PerlinNoise.js";

function hash(x, y, t, seed) {
    let h = seed;
    h = ((h << 5) - h + x) | 0;
    h = ((h << 5) - h + y) | 0;
    h = ((h << 5) - h + t) | 0;
    h = (h ^ (h >>> 3)) * 0x9E3779B9;
    h = (h ^ (h >>> 16));
    return (h >>> 0) / 0xFFFFFFFF; // 0..1
}

export default class NoiseGenerator {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.perlin = new PerlinNoise();
        
        this.noiseType = 'binary';
        this.speckleSize = 2;
        this.backgroundDensity = 0.5;
        this.foregroundDensity = 0.5;
        
        this.gradientDirection = 'horizontal';
        this.gradientMin = 0;
        this.gradientMax = 255;
        this.colourfulDensity = 0.5;
        this.dynamicFrequencyX = 0.02;
        this.dynamicFrequencyY = 0.02;
        this.dynamicSpeed = 1.0;
        this.dynamicAmplitude = 128;
        this.perlinFrequency = 0.05;
        this.perlinAmplitude = 128;
        this.perlinOctaves = 3;
        this.perlinPersistence = 0.5;
        
        this.noiseField = new Uint8ClampedArray(width * height);
        this.backgroundNoise = [];
        this.foregroundNoise = [];
    }
    
    setSize(width, height) {
        this.width = width;
        this.height = height;
        this.noiseField = new Uint8ClampedArray(width * height);
    }
    
    generateNoiseMap() {
        const { width, height, speckleSize, noiseType } = this;
        const map = new Uint8ClampedArray(width * height);
        
        if (noiseType === 'binary') {
            const threshold = this.backgroundDensity;
            for (let y = 0; y < height; y += speckleSize) {
                for (let x = 0; x < width; x += speckleSize) {
                    const val = Math.random() > threshold ? 255 : 0;
                    for (let dy = 0; dy < speckleSize && (y + dy) < height; dy += 1) {
                        for (let dx = 0; dx < speckleSize && (x + dx) < width; dx += 1) {
                            map[(y + dy) * width + (x + dx)] = val;
                        }
                    }
                }
            }
        } else if (noiseType === 'perlin') {
            const { perlinFrequency, perlinAmplitude, perlinOctaves, perlinPersistence } = this;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let val = 0;
                    let amp = perlinAmplitude;
                    let freq = perlinFrequency;
                    for (let o = 0; o < perlinOctaves; o++) {
                        val += this.perlin.noise2D(x * freq, y * freq) * amp;
                        amp *= perlinPersistence;
                        freq *= 2;
                    }
                    val = (val + 1) * 0.5 * 255;
                    map[y * width + x] = Math.min(255, Math.max(0, Math.floor(val)));
                }
            }
        } else if (noiseType === 'gradient') {
            const { gradientDirection, gradientMin, gradientMax } = this;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let t;
                    if (gradientDirection === 'horizontal') t = x / width;
                    else if (gradientDirection === 'vertical') t = y / height;
                    else t = (x / width + y / height) / 2;
                    
                    let baseVal = gradientMin + t * (gradientMax - gradientMin);
                    const noise = (Math.random() - 0.5) * 80;
                    baseVal = Math.min(255, Math.max(0, baseVal + noise));
                    map[y * width + x] = Math.floor(baseVal);
                }
            }
        } else if (noiseType === 'colourful') {
            for (let i = 0; i < map.length; i++) {
                if (Math.random() < this.colourfulDensity) {
                    map[i] = Math.floor(Math.random() * 256);
                } else {
                    map[i] = 0;
                }
            }
        } else if (noiseType === 'dynamic') {
            const t = Math.floor(performance.now() / 1000 * this.dynamicSpeed);
            // block size from speckleSize
            const blockSize = Math.max(1, Math.round(this.speckleSize));
            // scale coordinates to blocks (will be stretched by freqX/Y if needed)
            const scaleX = Math.max(0.001, this.dynamicFrequencyX * blockSize);
            const scaleY = Math.max(0.001, this.dynamicFrequencyY * blockSize);

            for (let y = 0; y < height; y++) {
                const blockY = Math.floor(y / blockSize) * blockSize;
                for (let x = 0; x < width; x++) {
                    const blockX = Math.floor(x / blockSize) * blockSize;
                    // pseudo‑random hash using integer coordinates + time
                    let h = ((blockX * scaleX + y * scaleY) * 31 + t) * 7;
                    h = (h ^ (h >>> 3)) * 0x9E3779B9;
                    h = (h ^ (h >>> 16));
                    const val = (h >>> 0) / 0xFFFFFFFF; // 0..1

                    // threshold according to global density (if used for single‑field map)
                    // but for content mode we use separate arrays, so just fill map for completeness
                    map[y * width + x] = Math.floor(val * 255);
                }
            }
        }
        return map;
    }
    
    _makeSeamless(field, movementDirection) {
        const { width, height, speckleSize } = this;
        if (movementDirection === 'vertical') {
            for (let y = 0; y < speckleSize; y++) {
                const srcRow = y * width;
                const dstRow = (height - speckleSize + y) * width;
                for (let x = 0; x < width; x++) {
                    field[dstRow + x] = field[srcRow + x];
                }
            }
        } else {
            for (let y = 0; y < height; y++) {
                const rowBase = y * width;
                for (let x = 0; x < speckleSize; x++) {
                    field[rowBase + (width - speckleSize + x)] = field[rowBase + x];
                }
            }
        }
    }
    
    _generateBinaryNoise(array, density) {
        const { width, height, speckleSize } = this;
        for (let y = 0; y < height; y += speckleSize) {
            for (let x = 0; x < width; x += speckleSize) {
                const val = Math.random() > density ? 255 : 0;
                for (let dy = 0; dy < speckleSize && (y + dy) < height; dy++) {
                    for (let dx = 0; dx < speckleSize && (x + dx) < width; dx++) {
                        array[(y + dy) * width + (x + dx)] = val;
                    }
                }
            }
        }
    }
    
    refresh(animationMode, movementDirection) {
        const size = this.width * this.height;
        if (this.noiseType === 'dynamic') {
            const size = this.width * this.height;
            const t = Math.floor(performance.now() / 1000 * this.dynamicSpeed);
            
            // Base block size from speckleSlider
            const baseBlock = Math.max(1, Math.round(this.speckleSize));
            
            // Map frequency sliders (0.005–0.2) to block‑size multipliers
            // Higher frequency -> smaller effective block -> more detail
            const freqScaleX = Math.max(0.1, this.dynamicFrequencyX * 100);   // 0.5 to 20
            const freqScaleY = Math.max(0.1, this.dynamicFrequencyY * 100);
            
            // Effective block dimensions (clamped between 1 and canvas size)
            const blockW = Math.max(1, Math.min(this.width,  Math.round(baseBlock / freqScaleX)));
            const blockH = Math.max(1, Math.min(this.height, Math.round(baseBlock / freqScaleY)));
            
            // Independent noise fields
            this.backgroundNoise = new Uint8ClampedArray(size);
            this.foregroundNoise = new Uint8ClampedArray(size);
            
            for (let y = 0; y < this.height; y += blockH) {
                const by = Math.floor(y / blockH) * blockH;
                for (let x = 0; x < this.width; x += blockW) {
                    const bx = Math.floor(x / blockW) * blockW;
                    
                    // Two independent hashes for foreground and background
                    const hashBg = hash(bx, by, t, 0);
                    const hashFg = hash(bx, by, t, 1);
                    
                    const amp = this.dynamicAmplitude * 2;
                    const bgVal = hashBg > this.backgroundDensity ? Math.floor(hashBg * amp) : 0;
                    const fgVal = hashFg > this.foregroundDensity ? Math.floor(hashFg * amp) : 0;
                    
                    // Fill the whole rectangular block
                    for (let dy = 0; dy < blockH && (y + dy) < this.height; dy++) {
                        for (let dx = 0; dx < blockW && (x + dx) < this.width; dx++) {
                            const idx = (y + dy) * this.width + (x + dx);
                            this.backgroundNoise[idx] = bgVal;
                            this.foregroundNoise[idx] = fgVal;
                        }
                    }
                }
            }
            
            this._makeSeamless(this.backgroundNoise, movementDirection);
            this._makeSeamless(this.foregroundNoise, movementDirection);
            this.noiseField = new Uint8ClampedArray(this.backgroundNoise);
            return;
        }
        if (animationMode === 'content' && this.noiseType === 'binary') {
            if (this.backgroundNoise.length !== size) this.backgroundNoise = new Array(size);
            if (this.foregroundNoise.length !== size) this.foregroundNoise = new Array(size);
            this._generateBinaryNoise(this.backgroundNoise, this.backgroundDensity);
            this._makeSeamless(this.backgroundNoise, movementDirection);
            this._generateBinaryNoise(this.foregroundNoise, this.foregroundDensity);
            this._makeSeamless(this.foregroundNoise, movementDirection);
        } else {
            this.noiseField = this.generateNoiseMap();
            this._makeSeamless(this.noiseField, movementDirection);
            this.backgroundNoise = new Array(size);
            this.foregroundNoise = new Array(size);
            for (let i = 0; i < size; i++) {
                const gray = this.noiseField[i];
                if (this.noiseType === 'colourful') {
                    this.backgroundNoise[i] = gray;
                    this.foregroundNoise[i] = gray;
                } else {
                    this.backgroundNoise[i] = (gray / 255) >= this.backgroundDensity ? 255 : 0;
                    this.foregroundNoise[i] = (gray / 255) >= this.foregroundDensity ? 255 : 0;
                }
            }
        }
        return { noiseField: this.noiseField, backgroundNoise: this.backgroundNoise, foregroundNoise: this.foregroundNoise };
    }
}