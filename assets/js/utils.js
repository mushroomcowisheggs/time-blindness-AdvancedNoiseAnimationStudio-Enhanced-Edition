// assets/js/utils.js
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
}

export function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

export function blendPixel(background, foreground, mode) {
    switch (mode) {
        case 'multiply':
            return {
                r: (background.r * foreground.r) / 255,
                g: (background.g * foreground.g) / 255,
                b: (background.b * foreground.b) / 255,
            };
        case 'screen':
            return {
                r: 255 - ((255 - background.r) * (255 - foreground.r)) / 255,
                g: 255 - ((255 - background.g) * (255 - foreground.g)) / 255,
                b: 255 - ((255 - background.b) * (255 - foreground.b)) / 255,
            };
        case 'overlay':
            const overlay = (c1, c2) =>
                c1 < 128 ? (2 * c1 * c2) / 255 : 255 - (2 * (255 - c1) * (255 - c2)) / 255;
            return {
                r: overlay(background.r, foreground.r),
                g: overlay(background.g, foreground.g),
                b: overlay(background.b, foreground.b),
            };
        default:
            return { r: foreground.r, g: foreground.g, b: foreground.b };
    }
}

export function getCoordinateColor(x, y, timestamp) {
    const timeFactor = Math.floor(timestamp / 1000 * 5);
    const seed = (x * 31 + y * 17 + timeFactor) * 7;
    const hue = seed % 360;
    const sat = 60 + (seed % 40);
    const light = 35 + (seed % 40);
    return hslToRgb(hue, sat, light);
}

export function applyColorToPixel(gray, mode, params) {
    if (mode === 'grayscale') return { r: gray, g: gray, b: gray };
    if (mode === 'hsl') {
        const dynamicLight = (gray / 255) * 100;
        const dynamicHue = (params.foregroundHue + gray * 0.5) % 360;
        return hslToRgb(dynamicHue, params.foregroundSat, dynamicLight);
    }
    if (mode === 'gradient') {
        const t = gray / 255;
        const start = hexToRgb(params.gradStart);
        const end = hexToRgb(params.gradEnd);
        return {
            r: Math.round(start.r * (1 - t) + end.r * t),
            g: Math.round(start.g * (1 - t) + end.g * t),
            b: Math.round(start.b * (1 - t) + end.b * t)
        };
    }
    return { r: gray, g: gray, b: gray };
}