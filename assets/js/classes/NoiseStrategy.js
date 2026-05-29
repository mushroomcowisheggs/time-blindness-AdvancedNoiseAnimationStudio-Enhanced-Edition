export default class NoiseStrategy {
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }

    generate() {
        // should return { foregroundNoise: Uint8Array, backgroundNoise: Uint8Array }
        throw new Error('generate() not implemented');
    }
}
