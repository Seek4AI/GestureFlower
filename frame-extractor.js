/**
 * 视频帧提取器 - 将视频预处理成内存中的图片序列
 */
const INTER_FRAME_DELAY_MS = 50; // Delay in milliseconds between processing each frame. Tune if needed.

class FrameExtractor {
    async _seekAndDrawFrame(videoElement, targetTime) {
        return new Promise((resolve, reject) => {
            const onSeekedInternal = () => {
                console.log(`[FrameExtractor] _seekAndDrawFrame - onSeekedInternal STARTS. currentTime: ${videoElement.currentTime.toFixed(3)} (Target was ${targetTime.toFixed(3)})`);
                videoElement.removeEventListener('seeked', onSeekedInternal);
                videoElement.removeEventListener('error', onErrorInternal);

                requestAnimationFrame(() => {
                    try {
                        console.log(`[FrameExtractor] _seekAndDrawFrame - rAF STARTS. Video src: ${videoElement.src}, currentTime: ${videoElement.currentTime.toFixed(3)} (Target was: ${targetTime.toFixed(3)})`);
                        this.frameCtx.drawImage(videoElement, 0, 0, this.frameCanvas.width, this.frameCanvas.height);
                        const frameImage = new Image();
                        frameImage.onload = () => resolve(frameImage);
                        frameImage.onerror = (e) => {
                            console.error('[FrameExtractor] _seekAndDrawFrame - Image.onload error', e);
                            reject(new Error('Image load error after drawing frame'));
                        };
                        const dataUrl = this.frameCanvas.toDataURL('image/jpeg', 0.8);
                        console.log(`[FrameExtractor] _seekAndDrawFrame - dataUrl (first 60 chars): ${dataUrl.substring(0, 60)}`);
                        frameImage.src = dataUrl;
                    } catch (drawError) {
                        console.error('[FrameExtractor] _seekAndDrawFrame - Error during drawImage or toDataURL:', drawError);
                        reject(drawError);
                    }
                });
            };

            const onErrorInternal = (e) => {
                videoElement.removeEventListener('seeked', onSeekedInternal);
                videoElement.removeEventListener('error', onErrorInternal);
                console.error('[FrameExtractor] _seekAndDrawFrame - Video error event during seek:', e);
                reject(new Error('Video error event during seek'));
            };

            videoElement.addEventListener('seeked', onSeekedInternal, { once: true });
            videoElement.addEventListener('error', onErrorInternal, { once: true });

            const seekTo = Math.min(targetTime, videoElement.duration > 0.001 ? videoElement.duration - 0.001 : 0);
            console.log(`[FrameExtractor] _seekAndDrawFrame - Requesting seek to: ${seekTo.toFixed(3)} (Target time was: ${targetTime.toFixed(3)}, Duration: ${videoElement.duration.toFixed(3)})`);
            videoElement.currentTime = seekTo;
            console.log(`[FrameExtractor] _seekAndDrawFrame - currentTime IMMEDIATELY AFTER SET: ${videoElement.currentTime.toFixed(3)} (Target was ${seekTo.toFixed(3)})`);
        });
    }

    constructor() {
        this.frameCanvas = document.createElement('canvas');
        this.frameCtx = this.frameCanvas.getContext('2d');
        this.frames = []; // 存储提取的帧
        this.isLoading = false;
        this.progress = 0;
    }

    /**
     * 从视频中提取所有帧
     * @param {HTMLVideoElement} videoElement - 视频元素
     * @param {number} frameCount - 要提取的帧数 (可选，默认为30帧)
     * @param {Function} progressCallback - 进度回调
     * @returns {Promise<Array>} 图片帧数组
     */
    async extractFrames(videoElement, frameCount = 30, progressCallback) {
        this.isLoading = true;
        this.progress = 0;
        this.frames = [];

        if (videoElement.readyState < videoElement.HAVE_METADATA) { // HAVE_METADATA is 1
            this.isLoading = false;
            throw new Error('Video metadata not ready, cannot extract frames. ReadyState: ' + videoElement.readyState);
        }

        this.frameCanvas.width = videoElement.videoWidth;
        this.frameCanvas.height = videoElement.videoHeight;

        const duration = videoElement.duration;
        if (!duration || duration === Infinity || duration <= 0) {
            this.isLoading = false;
            throw new Error('Video duration is invalid (' + duration + '), cannot extract frames');
        }
        
        // Ensure frameCount is at least 1 if duration is valid
        frameCount = Math.max(1, frameCount);
        const timeStep = (frameCount > 1) ? duration / (frameCount - 1) : 0;

        console.log(`[FrameExtractor] Starting frame extraction: Video duration ${duration.toFixed(3)}s, Target ${frameCount} frames, Timestep ${timeStep.toFixed(3)}s`);
        videoElement.pause(); // Ensure video is paused for reliable seeking

        for (let i = 0; i < frameCount; i++) {
            let targetTime = i * timeStep;
            // For a single frame, or the last frame, target near the end but not exactly 'duration' if it causes issues.
            if (frameCount === 1) {
                targetTime = Math.min(0.01, duration); // Get a very early frame if only one
            } else if (i === frameCount - 1) {
                targetTime = duration; // Aim for the actual end for the last frame
            }
            // Clamping is done inside _seekAndDrawFrame's currentTime assignment

            console.log(`[FrameExtractor] Loop ${i + 1}/${frameCount}: Requesting frame at target time: ${targetTime.toFixed(3)}s`);
            try {
                const frameImage = await this._seekAndDrawFrame(videoElement, targetTime);
                this.frames.push(frameImage);
                this.progress = (i + 1) / frameCount;
                if (progressCallback) {
                    progressCallback(this.progress);
                }

                // Add a small delay before processing the next frame to give the browser time
                if (INTER_FRAME_DELAY_MS > 0 && i < frameCount - 1) { // Don't delay after the last frame
                    // console.log(`[FrameExtractor] Delaying ${INTER_FRAME_DELAY_MS}ms before next frame.`);
                    await new Promise(resolve => setTimeout(resolve, INTER_FRAME_DELAY_MS));
                }
            } catch (error) {
                console.error(`[FrameExtractor] Error extracting frame ${i + 1} (target time ${targetTime.toFixed(3)}s):`, error.message);
                this.isLoading = false;
                // Optionally, rethrow or handle (e.g., continue with fewer frames)
                // For now, rethrow to be caught by the caller in script.js
                throw error; 
            }
        }

        this.isLoading = false;
        console.log(`[FrameExtractor] Frame extraction complete. Extracted ${this.frames.length}/${frameCount} frames.`);
        if (this.frames.length === 0 && frameCount > 0) {
            throw new Error('No frames were extracted despite attempting ' + frameCount);
        }
        return this.frames;
    }

    /**
     * 根据进度获取帧
     * @param {number} progress - 进度值 (0-1)
     * @returns {Image|null} 对应的帧
     */
    getFrameAtProgress(progress) {
        if (this.frames.length === 0) {
            return null;
        }

        // 确保进度在0-1范围内
        const normalizedProgress = Math.max(0, Math.min(1, progress));
        
        // 计算帧索引
        const frameIndex = Math.min(
            Math.floor(normalizedProgress * (this.frames.length - 1)), 
            this.frames.length - 1
        );
        
        return this.frames[frameIndex];
    }

    /**
     * 清空已提取的帧
     */
    clearFrames() {
        this.frames = [];
        this.progress = 0;
    }
}
