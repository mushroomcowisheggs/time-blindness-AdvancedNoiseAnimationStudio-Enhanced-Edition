import NoiseStrategy from './NoiseStrategy.js';
import PerlinNoise from './PerlinNoise.js';

export default class PerlinStrategy extends NoiseStrategy {
    constructor(width, height, options = {}) {
        super(width, height);
        this.options = options;
        this.perlin = new PerlinNoise();
    }

    generate() {
        const size = this.width * this.height;
        const fg = new Uint8ClampedArray(size);
        const bg = new Uint8ClampedArray(size);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const v = Math.floor((this.perlin.noise(x * 0.01, y * 0.01) + 1) * 127.5);
                const idx = y * this.width + x;
                fg[idx] = v;
                bg[idx] = 255 - v;
            }
        }
        return { foregroundNoise: fg, backgroundNoise: bg };
    }
}
