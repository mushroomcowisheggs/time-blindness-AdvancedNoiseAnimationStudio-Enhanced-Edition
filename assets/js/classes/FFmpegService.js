// assets/js/classes/FFmpegService.js
import { FFmpeg } from '@ffmpeg/ffmpeg';

export default class FFmpegService {
    constructor(coreURL, wasmURL) {
        this.coreURL = coreURL;
        this.wasmURL = wasmURL;
        this.ffmpeg = null;
        this.loading = false;
        this.loaded = false;
    }

    async load() {
        if (this.loaded) return;
        if (this.loading) {
            return new Promise(resolve => {
                const check = setInterval(() => {
                    if (this.loaded) { clearInterval(check); resolve(); }
                }, 200);
            });
        }
        this.loading = true;
        try {
            this.ffmpeg = new FFmpeg();
            this.ffmpeg.on('log', ({ message }) => console.log('[ffmpeg]', message));
            await this.ffmpeg.load({ coreURL: this.coreURL, wasmURL: this.wasmURL });
            this.loaded = true;
            await this.ensureDirectoryEmpty('/output');
            await this.ensureDirectoryEmpty('/input');
        } catch (e) {
            console.error('FFmpegService.load failed', e);
            throw e;
        } finally {
            this.loading = false;
        }
    }

    async unload() {
        if (!this.ffmpeg) return;
        try {
            await this.removeDirContents('/output');
            await this.removeDirContents('/input');
        } catch (e) {}
        try {
            if (typeof this.ffmpeg.exit === 'function') await this.ffmpeg.exit();
            else if (typeof this.ffmpeg.close === 'function') await this.ffmpeg.close();
        } catch (e) {
            console.warn('FFmpegService.unload failed', e);
        }
        this.ffmpeg = null;
        this.loaded = false;
        await new Promise(r => setTimeout(r, 50));
    }

    async removeDirContents(path) {
        if (!this.ffmpeg) return;
        try {
            const entries = await this.ffmpeg.listDir(path);
            for (const entry of entries) {
                if (entry.name === '.' || entry.name === '..') continue;
                const fullPath = `${path}/${entry.name}`;
                if (entry.isDir) {
                    await this.removeDirContents(fullPath);
                    await this.ffmpeg.deleteDir(fullPath);
                } else {
                    await this.ffmpeg.deleteFile(fullPath);
                }
            }
        } catch (e) {
            // ignore
        }
    }

    async ensureDirectoryEmpty(path) {
        if (!this.ffmpeg) return;
        await this.removeDirContents(path);
        try { await this.ffmpeg.createDir(path); } catch (e) {}
    }

    async exec(args) {
        if (!this.ffmpeg) throw new Error('FFmpeg not loaded');
        return this.ffmpeg.exec(args);
    }

    async writeFrame(dataURL, index) {
        if (!this.ffmpeg) throw new Error('FFmpeg not initialized');
        const name = `/input/frame${String(index).padStart(5, '0')}.png`;
        try {
            const resp = await fetch(dataURL);
            const ab = await resp.arrayBuffer();
            const uint8 = new Uint8Array(ab);
            if (typeof this.ffmpeg.FS === 'function') {
                this.ffmpeg.FS('writeFile', name, uint8);
            } else if (typeof this.ffmpeg.writeFile === 'function') {
                await this.ffmpeg.writeFile(name, uint8);
            } else {
                throw new Error('No FS write API available on ffmpeg instance');
            }
        } catch (e) {
            console.error('FFmpegService.writeFrame failed', e);
            throw e;
        }
    }

    async readOutput(path) {
        if (!this.ffmpeg) throw new Error('FFmpeg not initialized');
        try {
            let data;
            if (typeof this.ffmpeg.FS === 'function') {
                data = this.ffmpeg.FS('readFile', `/output/${path}`);
            } else if (typeof this.ffmpeg.readFile === 'function') {
                data = await this.ffmpeg.readFile(`/output/${path}`);
            } else {
                throw new Error('No FS read API available on ffmpeg instance');
            }
            return new Blob([data], { type: path.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream' });
        } catch (e) {
            console.error('FFmpegService.readOutput failed', e);
            throw e;
        }
    }

    async deleteFile(path) {
        if (!this.ffmpeg) return;
        try {
            if (typeof this.ffmpeg.deleteFile === 'function') {
                await this.ffmpeg.deleteFile(path);
            } else if (typeof this.ffmpeg.FS === 'function') {
                try { this.ffmpeg.FS('unlink', path); } catch (e) {}
            }
        } catch (e) {
            // ignore
        }
    }

    async deleteDir(path) {
        if (!this.ffmpeg) return;
        try {
            if (typeof this.ffmpeg.deleteDir === 'function') {
                await this.ffmpeg.deleteDir(path);
            } else if (typeof this.ffmpeg.FS === 'function') {
                // no direct deleteDir; leave for removeDirContents
            }
        } catch (e) {
            // ignore
        }
    }
}
