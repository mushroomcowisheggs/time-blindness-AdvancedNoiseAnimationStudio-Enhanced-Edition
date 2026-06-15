// assets/js/ffmpeg-worker.js
import { FFmpeg } from '/node_modules/@ffmpeg/ffmpeg/dist/esm/index.js';

let ffmpeg = null;
let ready = false;
let pendingResolve = null;

const waitForLoad = () => {
    if (ready) return Promise.resolve();
    return new Promise(resolve => { pendingResolve = resolve; });
};

async function init({ coreURL, wasmURL }) {
    if (ffmpeg) return;
    ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => console.log('[ffmpeg worker]', message));
    await ffmpeg.load({ coreURL, wasmURL });
    ready = true;
    if (pendingResolve) pendingResolve();
}

async function clearDir(path) {
    if (!ffmpeg) return;
    try {
        const entries = await ffmpeg.listDir(path);
        for (const entry of entries) {
            if (entry.name === '.' || entry.name === '..') continue;
            const full = `${path}/${entry.name}`;
            if (entry.isDir) {
                await clearDir(full);
                await ffmpeg.deleteDir(full);
            } else {
                await ffmpeg.deleteFile(full);
            }
        }
    } catch (e) {
        // directory may not exist
    }
}

async function resetFilesystem() {
    await clearDir('/input');
    await clearDir('/output');
    await ffmpeg.createDir('/input').catch(() => {});
    await ffmpeg.createDir('/output').catch(() => {});
}

async function writeFrame(dataURL, index) {
    await waitForLoad();
    const name = `/input/frame${String(index).padStart(5, '0')}.png`;
    const resp = await fetch(dataURL);
    const ab = await resp.arrayBuffer();
    const uint8 = new Uint8Array(ab);
    await ffmpeg.writeFile(name, uint8);
}

async function exec(args) {
    await waitForLoad();
    await ffmpeg.exec(args);
}

async function readOutput(path) {
    await waitForLoad();
    const data = await ffmpeg.readFile(`/output/${path}`);
    return new Blob([data], { type: path.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream' });
}

self.onmessage = async (e) => {
    const { type, id, ...payload } = e.data;
    try {
        if (type === 'init') {
            await init(payload);
            self.postMessage({ id, type: 'init:done' });
        } else if (type === 'reset') {
            await resetFilesystem();
            self.postMessage({ id, type: 'reset:done' });
        } else if (type === 'writeFrame') {
            await writeFrame(payload.dataURL, payload.index);
            self.postMessage({ id, type: 'writeFrame:done' });
        } else if (type === 'exec') {
            await exec(payload.args);
            self.postMessage({ id, type: 'exec:done' });
        } else if (type === 'readOutput') {
            const blob = await readOutput(payload.path);
            self.postMessage({ id, type: 'readOutput:done', blob });
        } else if (type === 'terminate') {
            self.close();
        }
    } catch (error) {
        self.postMessage({ id, type: 'error', error: error.message });
    }
};