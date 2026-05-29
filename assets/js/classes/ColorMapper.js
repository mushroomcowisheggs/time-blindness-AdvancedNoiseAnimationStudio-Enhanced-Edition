import { hexToRgb, hslToRgb, applyColorToPixel as utilApply, blendPixel as utilBlend } from '../utils.js';

export default class ColorMapper {
    constructor() {}

    applyColorToPixel(gray, mode, params) {
        // Delegate to existing util implementation for now
        return utilApply(gray, mode, params);
    }

    blendPixel(background, foreground, mode) {
        return utilBlend(background, foreground, mode);
    }

    hexToRgb(hex) {
        return hexToRgb(hex);
    }

    hslToRgb(h, s, l) {
        return hslToRgb(h, s, l);
    }
}

