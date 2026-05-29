class EventBus {
    constructor() {
        this.listeners = Object.create(null);
    }

    on(event, handler) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(handler);
        return () => this.off(event, handler);
    }

    off(event, handler) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(h => h !== handler);
    }

    emit(event, ...args) {
        const handlers = this.listeners[event];
        if (!handlers || !handlers.length) return;
        // copy to avoid mutation during iteration
        handlers.slice().forEach(h => {
            try { h(...args); } catch (e) { console.error('EventBus handler error', e); }
        });
    }
}

const eventBus = new EventBus();
export default eventBus;
