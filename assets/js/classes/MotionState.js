export default class MotionState {
    constructor(width = 640, height = 480) {
        this.width = width;
        this.height = height;

        // Scrolling offsets
        this.backgroundOffset = 0;
        this.foregroundOffset = 0;

        // Content / shape motion
        this.contentX = Math.floor(width / 2);
        this.contentY = Math.floor(height / 2);
        this.shapeVelX = 2;
        this.shapeVelY = 2;
        this.shapeMoveEnabled = false;

        // Path animation
        this.pathType = 'none';
        this.pathAngle = 0;
        this.pathSpeed = 0;

        // Keyframe animations placeholder
        this.keyframeAnimations = {};
        this.keyframeStartTime = null;
    }
}
