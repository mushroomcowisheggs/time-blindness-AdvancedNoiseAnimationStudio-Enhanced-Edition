// assets/js/classes/NoiseStrategyBase.js
export default class NoiseStrategyBase {
    constructor(generator) {
        this.g = generator; // reference to NoiseGenerator instance
    }

    // Produce a full noiseField (Uint8ClampedArray width*height)
    generateNoiseMap() {
        // default fallback: empty field
        return new Uint8ClampedArray(this.g.width * this.g.height);
    }

    // Optional refresh hook used when generator.refresh(...) is called
    async refresh(animationMode, movementDirection) {
        // default: regenerate generic noiseField
        this.g.noiseField = this.generateNoiseMap();
        return { noiseField: this.g.noiseField };
    }
}
