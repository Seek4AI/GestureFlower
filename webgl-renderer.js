// WebGL 渲染器 - 使用视频作为纹理源
class VideoTextureRenderer {
    constructor(canvasId, videoId) {
        this.canvas = document.getElementById(canvasId);
        this.videoElement = document.getElementById(videoId);
        this.gl = null;
        this.program = null;
        this.videoTexture = null;
        this.positionBuffer = null;
        this.texCoordBuffer = null;
        this.animationFrameId = null;
        this.isInitialized = false;
    }

    // 初始化 WebGL
    init() {
        // 获取 WebGL 上下文
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        
        if (!this.gl) {
            console.error('无法初始化 WebGL，您的浏览器可能不支持它');
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
        
        // 创建视频纹理
        this.createVideoTexture();
        
        // 设置背景颜色为黑色
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        
        this.isInitialized = true;
        return true;
    }
    
    // 创建视频纹理
    createVideoTexture() {
        // 如果已存在纹理，先删除
        if (this.videoTexture) {
            this.gl.deleteTexture(this.videoTexture);
        }
        
        // 创建新纹理
        this.videoTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.videoTexture);
        
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
        
        console.log('创建了新的视频纹理');
    }
    
    // 调整画布大小
    resizeCanvas() {
        // 获取显示区域的尺寸
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;
        
        // 检查画布大小是否需要调整
        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    // 编译着色器
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
    
    // 开始渲染循环
    startRenderLoop() {
        if (!this.isInitialized) {
            console.error('渲染器未初始化，无法开始渲染循环');
            return;
        }
        
        // 如果已经在运行，先停止以避免重复启动
        if (this.animationFrameId) {
            this.stopRenderLoop();
        }
        
        let frameCount = 0;
        let lastLogTime = performance.now();
        
        const renderFrame = () => {
            // 只有当视频准备好时才更新纹理
            if (this.videoElement.readyState >= this.videoElement.HAVE_CURRENT_DATA) {
                // 如果成功更新纹理，则渲染新帧
                if (this.updateTexture()) {
                    this.render();
                    frameCount++;
                    
                    // 每秒5秒输出一次渲染性能日志
                    const now = performance.now();
                    if (now - lastLogTime > 5000) {
                        const fps = frameCount / ((now - lastLogTime) / 1000);
                        console.log(`WebGL 渲染性能: ${fps.toFixed(1)} FPS`);
                        frameCount = 0;
                        lastLogTime = now;
                    }
                }
            }
            
            // 继续渲染循环
            this.animationFrameId = requestAnimationFrame(renderFrame);
        };
        
        console.log('启动 WebGL 渲染循环');
        this.animationFrameId = requestAnimationFrame(renderFrame);
    }
    
    // 停止渲染循环
    stopRenderLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    // 更新纹理
    updateTexture() {
        // 确保视频元素有效
        if (!this.videoElement || this.videoElement.readyState < 2) {
            return false;
        }
        
        try {
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.videoTexture);
            
            // 从视频更新纹理
            this.gl.texImage2D(
                this.gl.TEXTURE_2D, 
                0, 
                this.gl.RGBA, 
                this.gl.RGBA, 
                this.gl.UNSIGNED_BYTE, 
                this.videoElement
            );
            
            // 每次更新纹理时重新设置参数，确保在切换视频时也能正常工作
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
            
            return true;
        } catch (e) {
            console.error('更新纹理失败:', e);
            return false;
        }
    }
    
    // 渲染帧
    render() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
}
