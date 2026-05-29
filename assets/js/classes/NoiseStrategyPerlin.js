// assets/js/classes/NoiseStrategyPerlin.js
import NoiseStrategyBase from './NoiseStrategyBase.js';
import PerlinNoise from './PerlinNoise.js';

export default class NoiseStrategyPerlin extends NoiseStrategyBase {
    constructor(generator) {
        super(generator);
        this.perlin = new PerlinNoise();
    }

    generateNoiseMap() {
        const { width, height } = this.g;
        const map = new Uint8ClampedArray(width * height);
        const { perlinFrequency, perlinAmplitude, perlinOctaves, perlinPersistence } = this.g;
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
        return map;
    }

    async refresh(animationMode, movementDirection) {
        const size = this.g.width * this.g.height;
        // generate full field
        this.g.noiseField = this.generateNoiseMap();
        this.g._makeSeamless(this.g.noiseField, movementDirection);

        // prepare background/foreground masks for content mode
        this.g.backgroundNoise = new Array(size);
        this.g.foregroundNoise = new Array(size);
        for (let i = 0; i < size; i++) {
            const gray = this.g.noiseField[i];
            this.g.backgroundNoise[i] = (gray / 255) >= this.g.backgroundDensity ? 255 : 0;
            this.g.foregroundNoise[i] = (gray / 255) >= this.g.foregroundDensity ? 255 : 0;
        }
        return { noiseField: this.g.noiseField, backgroundNoise: this.g.backgroundNoise, foregroundNoise: this.g.foregroundNoise };
    }
}
