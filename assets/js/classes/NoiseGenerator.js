// assets/js/classes/NoiseGenerator.js
import NoiseStrategyBase from './NoiseStrategyBase.js';
import NoiseStrategyBinary from './NoiseStrategyBinary.js';
import NoiseStrategyPerlin from './NoiseStrategyPerlin.js';
import NoiseStrategyGradient from './NoiseStrategyGradient.js';
import NoiseStrategyColourful from './NoiseStrategyColourful.js';
import NoiseStrategyDynamic from './NoiseStrategyDynamic.js';

export default class NoiseGenerator {
    constructor(width, height) {
        this.width = width;
        this.height = height;

        this.noiseType = 'binary';
        this.speckleSize = 2;
        this.backgroundDensity = 0.5;
        this.foregroundDensity = 0.5;
        
        this.gradientDirection = 'horizontal';
        this.gradientMin = 0;
        this.gradientMax = 255;
        this.gradientRawMode = false;
        this.colourfulDensity = 0.5;
        this.dynamicFrequencyX = 0.02;
        this.dynamicFrequencyY = 0.02;
        this.dynamicSpeed = 1.0;
        this.dynamicAmplitude = 128;
        this.perlinFrequency = 0.1;
        this.perlinAmplitude = 128;
        this.perlinOctaves = 3;
        this.perlinPersistence = 0.5;
        
        this.noiseField = new Uint8ClampedArray(width * height);
        this.backgroundNoise = [];
        this.foregroundNoise = [];

        // Strategy instances
        this._strategies = {
            binary: new NoiseStrategyBinary(this),
            perlin: new NoiseStrategyPerlin(this),
            gradient: new NoiseStrategyGradient(this),
            colourful: new NoiseStrategyColourful(this),
            dynamic: new NoiseStrategyDynamic(this),
        };
        this._strategy = this._strategies[this.noiseType] || new NoiseStrategyBase(this);
    }
    
    setSize(width, height) {
        this.width = width;
        this.height = height;
        this.noiseField = new Uint8ClampedArray(width * height);
    }
    
    generateNoiseMap() {
        // Delegate to strategy
        const strategy = this._strategies[this.noiseType] || this._strategy;
        return strategy.generateNoiseMap();
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
    
    async refresh(animationMode, movementDirection) {
        const size = this.width * this.height;
        // Delegate refresh to active strategy
        // switch strategy if noiseType changed
        if (!this._strategies[this.noiseType]) {
            this._strategy = new NoiseStrategyBase(this);
        } else {
            this._strategy = this._strategies[this.noiseType];
        }
        return await this._strategy.refresh(animationMode, movementDirection);
    }
}