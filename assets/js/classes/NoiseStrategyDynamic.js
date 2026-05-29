// assets/js/classes/NoiseStrategyDynamic.js
import NoiseStrategyBase from './NoiseStrategyBase.js';

// lightweight integer hash used by original generator
function hash(x, y, t, seed) {
    let h = seed;
    h = ((h << 5) - h + x) | 0;
    h = ((h << 5) - h + y) | 0;
    h = ((h << 5) - h + t) | 0;
    h = (h ^ (h >>> 3)) * 0x9E3779B9;
    h = (h ^ (h >>> 16));
    return (h >>> 0) / 0xFFFFFFFF; // 0..1
}

export default class NoiseStrategyDynamic extends NoiseStrategyBase {
    generateNoiseMap() {
        const { width, height } = this.g;
        const map = new Uint8ClampedArray(width * height);
        const t = Math.floor(performance.now() / 1000 * this.g.dynamicSpeed);
        const blockSize = Math.max(1, Math.round(this.g.speckleSize));
        const scaleX = Math.max(0.001, this.g.dynamicFrequencyX * blockSize);
        const scaleY = Math.max(0.001, this.g.dynamicFrequencyY * blockSize);
        for (let y = 0; y < height; y++) {
            const blockY = Math.floor(y / blockSize) * blockSize;
            for (let x = 0; x < width; x++) {
                const blockX = Math.floor(x / blockSize) * blockSize;
                let h = ((blockX * scaleX + y * scaleY) * 31 + t) * 7;
                h = (h ^ (h >>> 3)) * 0x9E3779B9;
                h = (h ^ (h >>> 16));
                const val = (h >>> 0) / 0xFFFFFFFF; // 0..1
                map[y * width + x] = Math.floor(val * 255);
            }
        }
        return map;
    }

    async refresh(animationMode, movementDirection) {
        const size = this.g.width * this.g.height;
        const t = Math.floor(performance.now() / 1000 * this.g.dynamicSpeed);
        const baseBlock = Math.max(1, Math.round(this.g.speckleSize));
        const freqScaleX = Math.max(0.1, this.g.dynamicFrequencyX * 100);
        const freqScaleY = Math.max(0.1, this.g.dynamicFrequencyY * 100);
        const blockW = Math.max(1, Math.min(this.g.width, Math.round(baseBlock / freqScaleX)));
        const blockH = Math.max(1, Math.min(this.g.height, Math.round(baseBlock / freqScaleY)));

        this.g.backgroundNoise = new Uint8ClampedArray(size);
        this.g.foregroundNoise = new Uint8ClampedArray(size);

        for (let y = 0; y < this.g.height; y += blockH) {
            const by = Math.floor(y / blockH) * blockH;
            for (let x = 0; x < this.g.width; x += blockW) {
                const bx = Math.floor(x / blockW) * blockW;
                const hashBg = hash(bx, by, t, 0);
                const hashFg = hash(bx, by, t, 1);
                const amp = this.g.dynamicAmplitude * 2;
                const bgVal = hashBg > this.g.backgroundDensity ? Math.floor(hashBg * amp) : 0;
                const fgVal = hashFg > this.g.foregroundDensity ? Math.floor(hashFg * amp) : 0;
                for (let dy = 0; dy < blockH && (y + dy) < this.g.height; dy++) {
                    for (let dx = 0; dx < blockW && (x + dx) < this.g.width; dx++) {
                        const idx = (y + dy) * this.g.width + (x + dx);
                        this.g.backgroundNoise[idx] = bgVal;
                        this.g.foregroundNoise[idx] = fgVal;
                    }
                }
            }
        }

        this.g._makeSeamless(this.g.backgroundNoise, movementDirection);
        this.g._makeSeamless(this.g.foregroundNoise, movementDirection);
        this.g.noiseField = new Uint8ClampedArray(this.g.backgroundNoise);
        return { noiseField: this.g.noiseField, backgroundNoise: this.g.backgroundNoise, foregroundNoise: this.g.foregroundNoise };
    }
}
