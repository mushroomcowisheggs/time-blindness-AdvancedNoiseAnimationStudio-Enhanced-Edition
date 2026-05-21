// assets/js/classes/DepthProcessor.js
export default class DepthProcessor {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.depthSource = 'image';
        this.depthImageData = null;
        this.depthVideo = null;
        this.depthCanvas = null;
        this.depthCtx = null;
        this.foregroundSpeed = 60;
        this.depthScale = 2;
        this.lowerThreshold = 128;
        this.upperThreshold = 255;
        this.edgeThreshold = 30;
    }
    
    setSize(width, height) {
        this.width = width;
        this.height = height;
        if (this.depthCanvas) {
            this.depthCanvas.width = width;
            this.depthCanvas.height = height;
        }
    }
    
    loadDepthImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const img = new Image();
                img.onload = () => {
                    const tmpC = document.createElement('canvas');
                    tmpC.width = this.width;
                    tmpC.height = this.height;
                    const tmpCtx = tmpC.getContext('2d');
                    tmpCtx.fillStyle = 'black';
                    tmpCtx.fillRect(0, 0, tmpC.width, tmpC.height);
                    
                    const imgRatio = img.width / img.height;
                    const canvasRatio = tmpC.width / tmpC.height;
                    let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
                    if (imgRatio > canvasRatio) {
                        drawWidth = tmpC.width;
                        drawHeight = tmpC.width / imgRatio;
                        offsetY = (tmpC.height - drawHeight) / 2;
                    } else {
                        drawHeight = tmpC.height;
                        drawWidth = tmpC.height * imgRatio;
                        offsetX = (tmpC.width - drawWidth) / 2;
                    }
                    tmpCtx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
                    
                    const imageData = tmpCtx.getImageData(0, 0, tmpC.width, tmpC.height);
                    const data = imageData.data;
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i] !== data[i + 1] || data[i] !== data[i + 2]) {
                            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                            data[i] = data[i + 1] = data[i + 2] = Math.round(gray);
                        }
                    }
                    tmpCtx.putImageData(imageData, 0, 0);
                    this.depthImageData = tmpCtx.getImageData(0, 0, tmpC.width, tmpC.height).data;
                    resolve(this.depthImageData);
                };
                img.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
    
    loadDepthVideo(file) {
        if (this.depthVideo) {
            URL.revokeObjectURL(this.depthVideo.src);
            this.depthVideo.pause();
            this.depthVideo.removeAttribute('src');
            this.depthVideo.load();
        }
        this.depthVideo = document.getElementById('depthVideo') || document.createElement('video');
        this.depthVideo.muted = true;
        this.depthVideo.loop = true;
        this.depthVideo.preload = 'auto';
        this.depthVideo.src = URL.createObjectURL(file);
        this.depthVideo.play().catch(e => console.warn);
        
        if (!this.depthCanvas) {
            this.depthCanvas = document.createElement('canvas');
            this.depthCanvas.width = this.width;
            this.depthCanvas.height = this.height;
            this.depthCtx = this.depthCanvas.getContext('2d', { willReadFrequently: true });
        }
    }
    
    getCurrentDepthData() {
        if (this.depthSource === 'video' && this.depthVideo && this.depthVideo.readyState >= 2) {
            this.depthCtx.drawImage(this.depthVideo, 0, 0, this.width, this.height);
            return this.depthCtx.getImageData(0, 0, this.width, this.height).data;
        } else if (this.depthImageData) {
            return this.depthImageData;
        }
        return null;
    }
}