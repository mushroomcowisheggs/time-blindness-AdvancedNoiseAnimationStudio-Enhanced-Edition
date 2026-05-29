// assets/js/classes/NoiseStrategyGradient.js
import NoiseStrategyBase from './NoiseStrategyBase.js';

export default class NoiseStrategyGradient extends NoiseStrategyBase {
    generateNoiseMap() {
        const { width, height } = this.g;
        const map = new Uint8ClampedArray(width * height);
        const { gradientDirection, gradientMin, gradientMax } = this.g;
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
        return map;
    }

    async refresh(animationMode, movementDirection) {
        const size = this.g.width * this.g.height;
        this.g.noiseField = this.generateNoiseMap();
        this.g._makeSeamless(this.g.noiseField, movementDirection);

        this.g.backgroundNoise = new Array(size);
        this.g.foregroundNoise = new Array(size);

        const useRaw = this.g.gradientRawMode;   // User choice from generator

        for (let i = 0; i < size; i++) {
            const gray = this.g.noiseField[i];
            if (useRaw) {
                this.g.backgroundNoise[i] = gray;
                this.g.foregroundNoise[i] = gray;
            } else {
                this.g.backgroundNoise[i] = (gray / 255) >= this.g.backgroundDensity ? 255 : 0;
                this.g.foregroundNoise[i] = (gray / 255) >= this.g.foregroundDensity ? 255 : 0;
            }
        }

        return {
            noiseField: this.g.noiseField,
            backgroundNoise: this.g.backgroundNoise,
            foregroundNoise: this.g.foregroundNoise
        };
    }
}
