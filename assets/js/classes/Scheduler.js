import eventBus from './EventBus.js';

export default class Scheduler {
    constructor(controller, animationState) {
        this.controller = controller;
        this.state = animationState;
        this._boundOnState = this._onStateChange.bind(this);
        eventBus.on('state:change', this._boundOnState);
    }

    _onStateChange({ key, val }) {
        // react to a few known keys; keep this thin
        if (key === 'animationMode') {
            // controller already handles mode changes when main.js subscribes,
            // but keep controller in sync
            this.controller.setAnimationMode(val);
        } else if (key === 'play') {
            if (val) this.start(); else this.pause();
        } else if (key === 'animationSpeed') {
            this.controller.animationSpeed = val;
        }
    }

    start() { this.controller.start(); }
    pause() { this.controller.pause(); }
    resume() { this.controller.resume(); }
    toggle() { if (this.controller.isPaused) this.resume(); else this.pause(); }

    getFrameAtTime(t) { return this.controller.getFrameAtTime(t); }
}
