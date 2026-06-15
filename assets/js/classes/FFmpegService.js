export default class FFmpegService {
    constructor(coreURL, wasmURL) {
        this.coreURL = coreURL;
        this.wasmURL = wasmURL;
        this.worker = null;
        this.nextId = 0;
        this.pending = new Map();
    }

    async load() {
        if (this.worker) await this.unload();
        this.worker = new Worker(new URL('../ffmpeg-worker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => {
            const { id, type, blob, error } = e.data;
            const p = this.pending.get(id);
            if (!p) return;
            if (type === 'error') p.reject(new Error(error));
            else p.resolve({ type, blob });
            this.pending.delete(id);
        };
        this.worker.onerror = (err) => {
            console.error('[FFmpegService] Worker error', err);
            for (const [id, p] of this.pending.entries()) {
                p.reject(new Error('Worker error: ' + (err.message || err)));
                this.pending.delete(id);
            }
        };
        await this._post('init', { coreURL: this.coreURL, wasmURL: this.wasmURL });
    }

    async unload() {
        if (this.worker) {
            this._postNoReply('terminate');
            this.worker.terminate();
            this.worker = null;
        }
        for (const [id, p] of this.pending.entries()) {
            p.reject(new Error('FFmpegService unloaded'));
            this.pending.delete(id);
        }
    }

    async reset() {
        await this._post('reset', {});
    }

    async writeFrame(dataURL, index) {
        await this._post('writeFrame', { dataURL, index });
    }

    async exec(args) {
        await this._post('exec', { args });
    }

    async readOutput(path) {
        const res = await this._post('readOutput', { path });
        return res.blob;
    }

    _post(type, payload) {
        return new Promise((resolve, reject) => {
            const id = this.nextId++;
            this.pending.set(id, { resolve, reject });
            this.worker.postMessage({ id, type, ...payload });
        });
    }

    _postNoReply(type, payload) {
        const id = this.nextId++;
        this.worker.postMessage({ id, type, ...payload });
    }
}