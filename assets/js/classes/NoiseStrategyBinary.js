// assets/js/classes/NoiseStrategyBinary.js
import NoiseStrategyBase from './NoiseStrategyBase.js';

export default class NoiseStrategyBinary extends NoiseStrategyBase {
    generateNoiseMap() {
        const { width, height, speckleSize } = this.g;
        const map = new Uint8ClampedArray(width * height);
        const threshold = this.g.backgroundDensity;
        for (let y = 0; y < height; y += speckleSize) {
            for (let x = 0; x < width; x += speckleSize) {
                const val = Math.random() > threshold ? 255 : 0;
                for (let dy = 0; dy < speckleSize && (y + dy) < height; dy++) {
                    for (let dx = 0; dx < speckleSize && (x + dx) < width; dx++) {
                        map[(y + dy) * width + (x + dx)] = val;
                    }
                }
            }
        }
        return map;
    }

    async refresh(animationMode, movementDirection) {
        const size = this.g.width * this.g.height;
        if (animationMode === 'content') {
            if (this.g.backgroundNoise.length !== size) this.g.backgroundNoise = new Array(size);
            if (this.g.foregroundNoise.length !== size) this.g.foregroundNoise = new Array(size);
            this.g._generateBinaryNoise(this.g.backgroundNoise, this.g.backgroundDensity);
            this.g._makeSeamless(this.g.backgroundNoise, movementDirection);
            this.g._generateBinaryNoise(this.g.foregroundNoise, this.g.foregroundDensity);
            this.g._makeSeamless(this.g.foregroundNoise, movementDirection);
            this.g.noiseField = new Uint8ClampedArray(this.g.backgroundNoise);
        } else {
            this.g.noiseField = this.generateNoiseMap();
            this.g._makeSeamless(this.g.noiseField, movementDirection);
            this.g.backgroundNoise = new Array(size);
            this.g.foregroundNoise = new Array(size);
            for (let i = 0; i < size; i++) {
                const gray = this.g.noiseField[i];
                this.g.backgroundNoise[i] = (gray / 255) >= this.g.backgroundDensity ? 255 : 0;
                this.g.foregroundNoise[i] = (gray / 255) >= this.g.foregroundDensity ? 255 : 0;
            }
        }
        return { noiseField: this.g.noiseField, backgroundNoise: this.g.backgroundNoise, foregroundNoise: this.g.foregroundNoise };
    }
}
