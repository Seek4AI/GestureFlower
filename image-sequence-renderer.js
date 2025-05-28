/**
 * WebGL图片序列渲染器 - 将提取的图片帧直接渲染到WebGL画布
 */
class ImageSequenceRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.gl = null;
        this.program = null;
        this.frameTexture = null;
        this.positionBuffer = null;
        this.texCoordBuffer = null;
        this.animationFrameId = null;
        this.isInitialized = false;
        this.currentFrame = null;
        this.frameIndex = 0;
        
        // Track original frame dimensions for aspect ratio preservation
        this.originalWidth = 0;
        this.originalHeight = 0;
        this.preserveAspectRatio = true; // Set to false to disable aspect ratio preservation
    }

    /**
     * 初始化WebGL渲染器
     * @returns {boolean} 是否初始化成功
     */
    init() {
        // 获取WebGL上下文
        this.gl = this.canvas.getContext('webgl', { 
            antialias: true,
            preserveDrawingBuffer: false
        }) || this.canvas.getContext('experimental-webgl');
        
        if (!this.gl) {
            console.error('无法初始化WebGL，您的浏览器可能不支持它');
            return false;
        }

        // 设置视口大小为画布大小
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // 创建顶点着色器
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0, 1);
                v_texCoord = a_texCoord;
            }
        `;
        
        // 创建片段着色器
        const fragmentShaderSource = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_texture;
            void main() {
                gl_FragColor = texture2D(u_texture, v_texCoord);
            }
        `;
        
        // 编译着色器
        const vertexShader = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER);
        
        // 创建程序并链接着色器
        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);
        
        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            console.error('无法初始化着色器程序:', this.gl.getProgramInfoLog(this.program));
            return false;
        }
        
        // 使用程序
        this.gl.useProgram(this.program);
        
        // 获取属性位置
        const positionAttributeLocation = this.gl.getAttribLocation(this.program, 'a_position');
        const texCoordAttributeLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');
        
        // 创建和绑定位置缓冲区
        this.positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        
        // 定义一个覆盖整个画布的四边形（两个三角形）
        const positions = [
            -1.0, -1.0,  // 左下
             1.0, -1.0,  // 右下
            -1.0,  1.0,  // 左上
             1.0,  1.0,  // 右上
        ];
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
        
        // 创建和绑定纹理坐标缓冲区
        this.texCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        
        // 定义纹理坐标
        const texCoords = [
            0.0, 1.0,  // 左下
            1.0, 1.0,  // 右下
            0.0, 0.0,  // 左上
            1.0, 0.0,  // 右上
        ];
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(texCoords), this.gl.STATIC_DRAW);
        
        // 启用属性
        this.gl.enableVertexAttribArray(positionAttributeLocation);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);
        
        this.gl.enableVertexAttribArray(texCoordAttributeLocation);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        this.gl.vertexAttribPointer(texCoordAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);
        
        // 创建图片纹理
        this.createFrameTexture();
        
        // 设置背景颜色为黑色
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        
        this.isInitialized = true;
        console.log('WebGL图片序列渲染器初始化成功');
        return true;
    }
    
    /**
     * 创建图片纹理
     */
    createFrameTexture() {
        // 如果已存在纹理，先删除
        if (this.frameTexture) {
            this.gl.deleteTexture(this.frameTexture);
        }
        
        // 创建新纹理
        this.frameTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.frameTexture);
        
        // 设置纹理参数
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

        // 设置初始纹理为黑色
        this.gl.texImage2D(
            this.gl.TEXTURE_2D, 
            0, 
            this.gl.RGBA, 
            1, 1, 0, 
            this.gl.RGBA, 
            this.gl.UNSIGNED_BYTE, 
            new Uint8Array([0, 0, 0, 255]) // 黑色像素
        );
        
        console.log('创建了新的图片纹理');
    }
    
    /**
     * 调整画布大小并更新顶点坐标以保持纵横比
     */
    resizeCanvas() {
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;
        
        // 检查画布大小是否需要调整
        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            
            // 如果有原始帧尺寸信息，更新顶点坐标以保持纵横比
            if (this.preserveAspectRatio && this.originalWidth > 0 && this.originalHeight > 0) {
                this.updateVertexCoordinates();
            }
        }
    }
    
    /**
     * 更新顶点坐标以保持原始纵横比
     */
    updateVertexCoordinates() {
        if (!this.gl || !this.positionBuffer || this.originalWidth <= 0 || this.originalHeight <= 0) {
            return;
        }
        
        // 计算画布和原始帧的纵横比
        const canvasAspect = this.canvas.width / this.canvas.height;
        const frameAspect = this.originalWidth / this.originalHeight;
        
        // 根据纵横比差异计算缩放和偏移
        let scaleX = 1.0;
        let scaleY = 1.0;
        
        if (frameAspect > canvasAspect) {
            // 帧比画布更宽，上下留黑边
            scaleY = canvasAspect / frameAspect;
        } else {
            // 帧比画布更高，左右留黑边
            scaleX = frameAspect / canvasAspect;
        }
        
        // 创建保持纵横比的顶点坐标
        const positions = [
            -scaleX, -scaleY,  // 左下
             scaleX, -scaleY,  // 右下
            -scaleX,  scaleY,  // 左上
             scaleX,  scaleY,  // 右上
        ];
        
        // 更新顶点缓冲区
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
        
        console.log(`[Renderer] Updated vertex coordinates to preserve aspect ratio: ${frameAspect.toFixed(2)} (original: ${this.originalWidth}x${this.originalHeight}, canvas: ${this.canvas.width}x${this.canvas.height})`);
    }
    
    /**
     * 编译着色器
     * @param {string} source - 着色器源代码
     * @param {number} type - 着色器类型
     * @returns {WebGLShader} 编译后的着色器
     */
    compileShader(source, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('着色器编译错误:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    /**
     * 设置当前要渲染的帧
     * @param {Image} frame - 要渲染的图片帧
     */
    setFrame(frame) {
        if (!frame || !this.isInitialized) return;
        console.log('[Renderer] setFrame called with frame:', frame ? frame.src || frame : 'null');
        
        // 如果是新帧，记录其原始尺寸用于保持纵横比
        if (frame !== this.currentFrame && frame.width && frame.height) {
            const needsUpdate = (this.originalWidth !== frame.width || this.originalHeight !== frame.height);
            
            this.originalWidth = frame.width;
            this.originalHeight = frame.height;
            
            if (needsUpdate && this.preserveAspectRatio) {
                console.log(`[Renderer] New frame dimensions: ${frame.width}x${frame.height}, updating vertex coordinates`);
                this.updateVertexCoordinates();
            }
        }
        
        this.currentFrame = frame;
        this.updateTexture();
    }
    
    /**
     * 更新纹理
     * @returns {boolean} 是否成功更新纹理
     */
    updateTexture() {
        if (!this.currentFrame || !this.isInitialized) {
            console.log('[Renderer] updateTexture skipped: no currentFrame or not initialized');
            return false;
        }
        console.log('[Renderer] updateTexture called for frame:', this.currentFrame ? this.currentFrame.src || this.currentFrame : 'null');
        
        try {
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.frameTexture);
            
            // 从图片更新纹理
            this.gl.texImage2D(
                this.gl.TEXTURE_2D, 
                0, 
                this.gl.RGBA, 
                this.gl.RGBA, 
                this.gl.UNSIGNED_BYTE, 
                this.currentFrame
            );
            
            // 每次更新纹理时重新设置参数，确保渲染正常
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
            
            this.render();
            return true;
        } catch (e) {
            console.error('更新纹理失败:', e);
            return false;
        }
    }
    
    /**
     * 渲染当前帧
     */
    render() {
        if (!this.isInitialized) return;
        
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
    
    /**
     * 开始渲染循环
     */
    startRenderLoop() {
        if (!this.isInitialized) {
            console.error('渲染器未初始化，无法开始渲染循环');
            return;
        }
        
        // 如果已经在运行，先停止以避免重复启动
        if (this.animationFrameId) {
            this.stopRenderLoop();
        }
        
        const renderFrame = () => {
            // 只在有帧时渲染
            if (this.currentFrame) {
                // console.log('[Renderer] renderFrame rendering frame:', this.currentFrame ? this.currentFrame.src || this.currentFrame : 'null'); // This might be too noisy
                this.render();
            }
            
            // 继续渲染循环
            this.animationFrameId = requestAnimationFrame(renderFrame);
        };
        
        console.log('启动图片序列渲染循环');
        this.animationFrameId = requestAnimationFrame(renderFrame);
    }
    
    /**
     * 停止渲染循环
     */
    stopRenderLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
}
