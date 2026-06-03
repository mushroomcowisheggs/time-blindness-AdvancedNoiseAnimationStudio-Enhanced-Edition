import eventBus from './EventBus.js';

class AnimationState {
    constructor() {
        this._state = {
            animationMode: 'content',
            backgroundMode: 'dynamic',
            movementDirection: 'vertical',
            animationSpeed: 1,
            enableOpposingMotion: false,
            unifiedGradient: false,
            gradientRawMode: false,
            noiseType: 'grayscale'
        };
    }

    get(key) {
        return this._state[key];
    }

    set(key, value) {
        this._state[key] = value;
        eventBus.emit('state:change', { key, val: value });
        eventBus.emit(`state:${key}`, value);
    }

    toJSON() {
        return Object.assign({}, this._state);
    }
}

const animationState = new AnimationState();
export default animationState;
