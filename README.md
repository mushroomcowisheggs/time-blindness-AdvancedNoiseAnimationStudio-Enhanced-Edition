# AdvancedNoiseAnimationStudio-Enhanced-Edition

An enhanced extension of the original [Advanced Noise Animation Studio](https://github.com/TimeBlindness/time-blindness) (research project *Time Blindness*, CVPR 2026). This version adds **batch processing pipeline**, **local FFmpeg MP4 encoding**, **keyframe animation**, **depth‑driven speed scaling**, and a **reorganized modular architecture** for reproducible dataset generation.

> **Note**  
> This is a **community‑made enhancement**, not an official tool of the *Time Blindness* research team.

---

## Overview

The original studio (Time Blindness, CVPR 2026) generates videos using only binary noise (black/white random blocks) to encode temporal patterns. That benchmark revealed that all current Video‑VLMs achieve 0% accuracy – they are completely “time‑blind”.

This enhanced edition adds five additional noise types (Perlin, Gradient, Colourful, Dynamic) and a batch processing pipeline. The goal is not to make patterns easier for AI, but to increase the diversity of visual confusion and to prepare for future, purpose‑built models that might succeed on specific temporal patterns while failing on others. In other words, this tool helps researchers ask: “If a model is trained to recognise our new noise‑based patterns, will it generalise poorly to other noise types?”

---

## Installation & Requirements

- A modern browser with **WebAssembly** support (Chrome, Firefox, Edge).
- **Local web server** recommended (e.g., `npx serve .` or VS Code Live Server) because FFmpeg workers may require proper MIME types.
- Node.js only for installing FFmpeg packages – after that, everything runs in the browser.

```bash
git clone https://github.com/mushroomcowisheggs/time-blindness-AdvancedNoiseAnimationStudio-Enhanced-Edition.git
cd time-blindness-AdvancedNoiseAnimationStudio-Enhanced-Edition
npm install @ffmpeg/ffmpeg @ffmpeg/core
# then open index.html via a local server
```

---

## Core Concepts

The application is built around three conceptual layers:

### 1. Noise Field Generation (`NoiseGenerator`)
The original generator only supports binary noise (random black/white blocks), which produces a 2D array of intensity values (0–255) that serve as the texture for both background and foreground. . This limited texture space may have contributed to the 0% performance of current models, but it does not exhaust enough possible temporal patterns.

This enhanced edition adds four smooth / coloured / time‑varying noise algorithms, which can produce visually very different motion cues. The expanded noise space allows testing whether a future “time‑aware” model truly understands temporal structure or merely overfits to binary flicker.

Supported algorithms:
- **Binary** – random black/white blocks with controllable speckle size.
- **Perlin** – smooth gradient noise with frequency, amplitude, octaves & persistence.
- **Gradient** – linear ramp plus random jitter.
- **Colourful** – random colour pixels at given density.
- **Dynamic** – time‑varying block‑based hash noise (fully seamless).

Each noise type exposes its own set of sliders, and the generator maintains **separate** foreground/background noise fields for content mode.

#### FAQ

**Q: Why do I need multiple noise types? The original binary noise already gives 0% accuracy.**
**A:** The 0% result is a **necessary** starting point, but not sufficient for building robust temporal understanding. A model that overfits to binary flicker might still be “time‑blind” when faced with Perlin noise. This extension allows you to **probe the boundaries** of future models – a critical step before claiming true temporal intelligence.

### 2. Content Rendering (`ContentRenderer`)
Manages the **foreground mask** – a white shape (text, image, or geometric shape) on a black background. It supports:
- **Transformation stack**: rotation, scaling, wave distortion, and user‑defined path motion (circle, figure‑8).
- **Caching**: the static content is rendered to an offscreen canvas and reused unless parameters change.
- **Wave distortion**: applies a time‑varying sine/cosine warp to the content area, with strength control.

### 3. Animation Controller (`AnimationController`)
The orchestrator. It:
- Maintains animation loop and time‑based offsets (for scrolling noise).
- Switches between **Depth mode** and **Content mode**.
- Applies **keyframe interpolation** (linear over time) to `speed`, `rotation`, `scale`.
- Blends background noise, foreground noise, and content mask according to blend mode and colour mapping (HSL, gradient, or grayscale).

---

## Depth Mode vs. Content Mode

| Mode | Behaviour | Typical Use |
|------|-----------|--------------|
| **Depth** | Reads a depth map (static image or video). For each pixel within a depth range, the foreground noise scrolls faster (speed multiplied by depth scale). Edge detection can exclude thin boundaries. | Simulating motion parallax based on depth, e.g., “time blindness” experiments. |
| **Content** | A single foreground object (text, shape, or user image) moves over a scrolling noise background. Background noise can be static, dynamic, or mixed with a solid colour. Depth data (if loaded) optionally influences the movement speed of the object. | Controlled stimulus presentation with independent background texture. |

Both modes share the same noise generators, colour mapping, and blending options.

---

## Why Enhanced Noise Types? – Academic Motivation

The original SpookyBench uses **binary noise** exclusively. All tested models (GPT‑4o, Gemini, Qwen, etc.) scored **0%** – a striking result. However, a crucial question remains:  

> *If we train a model specifically on binary‑noise temporal patterns, will it generalise to other noise textures (Perlin, gradient, colourful, dynamic)? Or will it become a “specialist” that fails on slightly different temporal statistics?*

This enhanced edition provides **five noise families** under the same animation framework, enabling researchers to:

- Generate **controlled datasets** where only the noise texture changes (binary → Perlin → colourful → etc.), while motion parameters (speed, direction, depth) stay identical.
- Test **cross‑noise generalisation** of future video models – a critical step beyond the current “all‑or‑nothing” blind spot.
- Simulate **more realistic / naturalistic temporal patterns** (e.g., smooth Perlin motion) that might be easier for humans but still confuse AI.

**Current models fail on all noise types** – that is expected. The value of this extension lies in **future experiments**: when someone builds a model that *can* decode binary‑noise words, we can immediately ask whether it also understands Perlin‑coded shapes. If not, the model is still “time‑blind” in a broader sense.

---

## Batch Processing Pipeline

The batch processor allows you to **automate video creation** for a set of images. It works as follows:

1. **State saving** – current animation parameters (noise settings, motion, colour, etc.) are preserved.
2. **Per‑image loop** – for each selected image:
   - If **Content mode**: replace `ContentRenderer.currentImage` with the loaded image.
   - If **Depth mode**: replace `DepthProcessor.depthImageData` with the loaded image (converted to grayscale).
   - Force a noise refresh and reset animation time.
   - Capture an off‑screen frame sequence (30 fps) and feed it to FFmpeg.
   - Encode and download `{original_name}_{mode}_{duration}s.mp4`.
3. **Restore** – original image/depth data and animation state are restored; the main canvas resumes.

**Why this matters for research**  
You can generate a **controlled set of videos** where only the independent variable (depth map or foreground image) changes, while all motion dynamics, noise statistics, and colour parameters are held constant. This eliminates unintentional confounds and makes replication easy.

---

## FFmpeg Integration (Local, No Server)

The extension uses **`@ffmpeg/ffmpeg`** and **`@ffmpeg/core`** to encode PNG frame sequences into MP4. All processing happens inside your browser (WebAssembly). To enable this feature:

```bash
npm install @ffmpeg/ffmpeg @ffmpeg/core
```

Then open the HTML file. The first time you click **Export HQ** or start a batch job, FFmpeg will load (may take a few seconds). Progress is shown.

The export routine:
- Temporarily swaps the main canvas with an offscreen canvas.
- Calls `controller._animate()` at fixed timestamps (independent of real‑time clock).
- Writes each frame as a PNG to FFmpeg’s virtual filesystem.
- Runs `ffmpeg -framerate 30 -i /input/frame%05d.png -c:v libx264 -crf 18 -pix_fmt yuv420p output.mp4`.
- Downloads the result.

---

## Code Architecture (Modular)

All classes reside in `assets/js/classes/`:

```
classes/
├── AnimationController.js   # main loop, mode switching, blending
├── ContentRenderer.js       # foreground mask & transformations
├── DepthProcessor.js        # depth map loading & frame extraction
├── NoiseGenerator.js        # all noise algorithms + background/foreground fields
└── PerlinNoise.js           # independent Perlin implementation
```

**Dependency flow** (no circular imports):
- `main.js` instantiates the four top‑level components and wires UI events.
- `AnimationController` holds references to the other three and calls their methods.
- `utils.js` provides pure colour conversion/blending functions.

To add a new noise type, extend `NoiseGenerator.generateNoiseMap()` and add UI sliders in the HTML. To change blending, modify `AnimationController._renderContentMode()`.

---

## Example: Generating a Dataset for Depth‑From‑Motion

Assume you have 10 synthetic depth maps (e.g., random Perlin height fields). You want to create 10 videos that demonstrate motion parallax with the same noise texture.

1. Load any depth map (or none) to set initial parameters.
2. Adjust Depth Mode settings:
   - Foreground speed = 80 px/sec
   - Depth range = 64–192
   - Edge threshold = 20
3. In **Batch Export**:
   - Select your 10 depth images.
   - Mode = Depth, Duration = 8 seconds.
   - Click **Start batch export**.
4. The system generates 10 MP4 files, each with identical motion parameters but different depth structures.

You can repeat the similiar batch process with different noise types (select “Perlin” or “Dynamic” from the Noise Type dropdown). This creates a multi‑texture dataset – ideal for measuring how a model’s temporal decoding ability transfers across noise statistics.

This provides a perfectly controlled stimulus set for experiments or training a neural network.
