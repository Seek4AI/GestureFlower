document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素
    const loadingElement = document.getElementById('loading');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const videoElement = document.getElementById('flower-video'); // 隐藏的视频元素，仅用于提取帧
    const webglCanvas = document.getElementById('webgl-canvas'); // WebGL 画布
    const cameraInput = document.getElementById('camera-input'); // 摄像头输入 <video>
    const videoSelect = document.getElementById('video-select');
    const handOpennessElement = document.getElementById('hand-openness');
    const opennessProgress = document.getElementById('openness-progress');
    // fullscreenBtn and toggleCameraBtn have been removed from HTML

    function showLoading(message) {
        if (loadingElement && progressText && progressBar) {
            loadingElement.style.display = 'flex';
            progressText.textContent = message;
            progressBar.style.width = '0%';
            loadingElement.classList.add('loading-active'); // Ensure it's active
            console.log(`[UI] showLoading: ${message}`);
        } else {
            console.error('[UI] showLoading: DOM elements not found (loadingElement, progressText, or progressBar).');
        }
    }

    // 状态变量
    let handOpenness = 0;
    let isHandDetected = false;
    let isVideoReady = false;
    let lastHandUpdateTime = 0;
    let lastOpenness = 0; // 用于平滑手部开合度
    let currentVideoIndex = 0; // 当前选中的视频索引
    
    // 初始化帧提取器和渲染器
    const frameExtractor = new FrameExtractor();
    const imageRenderer = new ImageSequenceRenderer('webgl-canvas');

    const camera = new Camera(cameraInput, {
        onFrame: async () => {
            // Make sure cameraInput (the <video> element) has valid dimensions before sending to Hands
            if (cameraInput.videoWidth > 0 && cameraInput.videoHeight > 0) {
                await hands.send({ image: cameraInput });
            }
        },
        width: 640, // Desired width
        height: 480 // Desired height
    });
    
    // 创建手部可视化容器（对所有模式都使用）
    const handVizContainer = document.createElement('div');
    handVizContainer.id = 'hand-viz-container';
    handVizContainer.classList.add('hand-viz-container');
    document.body.appendChild(handVizContainer);
    
    // 初始化手部关键点可视化
    const handCanvas = document.createElement('canvas');
    handCanvas.id = 'hand-visualization';
    handCanvas.width = 200;
    handCanvas.height = 200;
    handCanvas.classList.add('hand-canvas');
    handVizContainer.appendChild(handCanvas);
    
    // 创建手部可视化实例
    const handViz = new HandVisualization('hand-visualization');
    handViz.updateHandByOpenness(0.5);
    handViz.draw();
    
    // 默认帧数设置
    const FRAMES_PER_VIDEO = 90; // 每个视频提取60帧

    const videoFiles = [
        { name: '花朵1', file: 'videos/f1.mp4' }, { name: '花朵2', file: 'videos/f2.mp4' },
        { name: '花朵3', file: 'videos/f3.mp4' }, { name: '花朵4', file: 'videos/f4.mp4' },
        { name: '花朵5', file: 'videos/f5.mp4' }, { name: '花朵6', file: 'videos/f6.mp4' },
        { name: '花朵7', file: 'videos/f7.mp4' }, { name: '花朵8', file: 'videos/f8.mp4' },
        { name: '花朵9', file: 'videos/f9.mp4' }, { name: '花朵10', file: 'videos/f10.mp4' },
        { name: '花朵11', file: 'videos/f11.mp4' }, { name: '花朵12', file: 'videos/f12.mp4' },
        { name: '花朵13', file: 'videos/f13.mp4' }, { name: '花朵14', file: 'videos/f14.mp4' }
    ];

    videoFiles.forEach((video, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = video.name;
        videoSelect.appendChild(option);
    });

    function loadVideo(videoSrc) {
        console.log(`[Script] loadVideo called for: ${videoSrc}. Performing full reset.`);
        return new Promise((resolve, reject) => {
            // 1. Aggressively stop ongoing processes & clear states
            if (imageRenderer && imageRenderer.animationFrameId) {
                console.log('[Script] Stopping current imageRenderer render loop.');
                imageRenderer.stopRenderLoop();
            }
            if (imageRenderer) { // Also clear current frame even if loop wasn't running
                console.log('[Script] Clearing imageRenderer currentFrame.');
                imageRenderer.currentFrame = null;
            }
            if (camera) {
                console.log('[Script] Aggressively stopping MediaPipe camera at start of loadVideo.');
                camera.stop(); // Stop it early and definitively
            }
            if (frameExtractor) {
                console.log('[Script] Clearing frameExtractor frames.');
                frameExtractor.clearFrames();
            }

            // 2. Reset script.js state variables
            isVideoReady = false;
            handOpenness = 0;
            lastOpenness = 0;
            // currentVideoSrc = videoSrc; // Update this if you track it globally

            // 3. Reset videoElement thoroughly
            console.log('[Script] Resetting videoElement source before loading new video.');
            videoElement.src = '';    // Clear existing source
            videoElement.load();      // Force browser to discard old video state
            // It's important that setting the new src happens AFTER the old one is cleared and loaded (empty)

            // 4. Show loading UI
            showLoading(`加载视频: ${videoSrc.split('/').pop()}`);
            loadingElement.style.display = 'flex';
            progressBar.style.width = '0%';
            progressText.textContent = '0%';
            loadingElement.classList.add('loading-active');

            // 5. Set new video source and attach event listeners
            console.log(`[Script] Setting new video source: ${videoSrc}`);
            videoElement.src = videoSrc;
            videoElement.muted = true; // 视频静音，仅用于提取帧
            
            // 视频元数据加载完成
            videoElement.onloadedmetadata = () => {
                console.log(`视频元数据已加载，总时长: ${videoElement.duration} 秒`);
                
                // 初始化图像渲染器（如果尚未初始化）
                if (!imageRenderer.isInitialized) {
                    if (imageRenderer.init()) {
                        console.log('WebGL 图像渲染器初始化成功');
                    } else {
                        console.error('WebGL 图像渲染器初始化失败');
                        reject(new Error('WebGL 初始化失败'));
                        return;
                    }
                }
            };
            
            // 视频数据加载完成 - 开始提取帧
            videoElement.onloadeddata = async () => {
                console.log('视频数据已加载完成，开始提取帧');
                
                if (videoElement.duration && videoElement.duration !== Infinity) {
                    try {
                        // 提取帧，显示进度
                        if (camera) {
                            console.log('[Script] Stopping MediaPipe camera for frame extraction...');
                            camera.stop();
                        }
                        await frameExtractor.extractFrames(videoElement, FRAMES_PER_VIDEO, (progress) => {
                            // 更新加载进度
                            const percent = Math.round(progress * 100);
                            progressBar.style.width = `${percent}%`;
                            progressText.textContent = `提取帧: ${percent}%`;
                        }).then(frames => {
                            if (camera) {
                                console.log('[Script] Restarting MediaPipe camera after frame extraction...');
                                camera.start();
                            }
                            if (frames && frames.length > 0) {
                                // 设置第一帧
                                imageRenderer.setFrame(frameExtractor.frames[0]);
                                
                                // 启动渲染循环
                                if (!imageRenderer.animationFrameId) {
                                    imageRenderer.startRenderLoop();
                                }
                                
                                isVideoReady = true;
                                resolve();
                            } else {
                                reject(new Error('未能提取到有效帧'));
                            }
                        }).catch(error => {
                            if (camera) {
                                console.log('[Script] Restarting MediaPipe camera after frame extraction error...');
                                camera.start(); // Ensure camera restarts even on error
                            }
                            console.error('视频加载或帧提取失败:', error);
                            alert(`加载视频失败: ${error.message}`);
                        });
                        
                        console.log(`成功提取 ${frameExtractor.frames.length} 帧`);
                    } catch (err) {
                        console.error('提取帧失败:', err);
                        reject(err);
                    }
                } else {
                    console.warn('视频数据已加载，但时长无效:', videoElement.duration);
                    reject(new Error('视频时长无效'));
                }
            };
            
            // 跟踪跳转状态
            videoElement.onseeking = () => {
                isVideoSeeking = true;
            };
            
            videoElement.onseeked = () => {
                isVideoSeeking = false;
            };
            
            videoElement.onerror = (e) => {
                console.error('视频加载错误:', e);
                reject(new Error('视频加载失败'));
            };
            
            videoElement.load(); // 开始加载视频
        });
    }

    async function loadSelectedVideo() {
        // 清除先前的帧数据
        frameExtractor.clearFrames();
        
        // 获取选中的视频
        const selectedIndex = videoSelect.value;
        currentVideoIndex = parseInt(selectedIndex);
        const selectedVideo = videoFiles[selectedIndex];

        // 显示加载提示
        loadingElement.style.display = 'flex';
        progressBar.style.width = '0%';
        progressText.textContent = '准备加载视频...';
        loadingElement.classList.add('loading-active');
        
        // 如果渲染器已在运行，先停止渲染循环
        if (imageRenderer.isInitialized && imageRenderer.animationFrameId) {
            console.log('停止当前渲染循环');
            imageRenderer.stopRenderLoop();
        }

        try {
            // 加载新视频并提取帧
            await loadVideo(selectedVideo.file);
            console.log(`成功加载视频并提取帧: ${selectedVideo.name}, 帧数: ${frameExtractor.frames.length}`);
            
            // 隐藏加载提示
            loadingElement.style.display = 'none';
            loadingElement.classList.remove('loading-active');
            
            // 如果手部已检测到，立即更新基于手部开合度的帧
            if (isHandDetected) {
                // 确保渲染器完全准备好
                setTimeout(() => {
                    console.log('基于手部状态更新帧');
                    updateVideoBasedOnHand();
                }, 100);
            } else {
                // 手部未检测到时，显示第一帧
                if (frameExtractor.frames.length > 0) {
                    imageRenderer.setFrame(frameExtractor.frames[0]);
                }
            }
            
            // 确保渲染循环在运行
            if (imageRenderer.isInitialized && !imageRenderer.animationFrameId) {
                imageRenderer.startRenderLoop();
            }
            
        } catch (err) {
            console.error('视频加载或帧提取错误:', err);
            loadingElement.textContent = `加载失败: ${err.message}`;
            loadingElement.classList.remove('loading-active');
        }
    }

    loadSelectedVideo();
    videoSelect.addEventListener('change', loadSelectedVideo);

function updateVideoBasedOnHand() {
    // 仅在检测到手部并且帧提取完成时更新
    if (!isHandDetected || !isVideoReady || frameExtractor.frames.length === 0) {
        return;
    }

    // 使用手部开合度选择对应帧
    // 平滑处理手部开合度
    const smoothingFactor = 0.2; // 平滑因子，可以调整
    handOpenness = lastOpenness * (1 - smoothingFactor) + handOpenness * smoothingFactor;
    lastOpenness = handOpenness;

    const frameIndex = Math.floor(handOpenness * (frameExtractor.frames.length - 1));
    const targetFrame = frameExtractor.frames[frameIndex];

    console.log(`updateVideoBasedOnHand - handOpenness: ${handOpenness.toFixed(2)}, frameIndex: ${frameIndex}, totalFrames: ${frameExtractor.frames.length}`);

    if (targetFrame && imageRenderer) {
        imageRenderer.setFrame(targetFrame);
    }

    // 更新手部状态显示
    if (isHandDetected) {
        handOpennessElement.textContent = `开合度: ${(handOpenness * 100).toFixed(0)}%`;
        opennessProgress.style.width = `${handOpenness * 100}%`;
    } else {
        handOpennessElement.textContent = '未检测到手部';
        opennessProgress.style.width = `0%`;
    }
}

    // 创建一个函数来绘制检测到的手部关键点
    function drawDetectedHandLandmarks(landmarks) {
        // 获取画布尺寸
        const width = handCanvas.width;
        const height = handCanvas.height;
        
        // 清除画布
        const ctx = handCanvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        
        // 绘制网格背景
        handViz.drawGrid(width, height);
        
        // 设置样式
        ctx.fillStyle = 'rgba(255,50,50,0.9)';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        
        // 绘制所有关键点
        landmarks.forEach((point, index) => {
            // 翻转x坐标以匹配镜像效果
            const x = (1 - point.x) * width;
            const y = point.y * height;
            
            // 绘制点
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
            
            // 绘制点的索引
            ctx.fillStyle = 'white';
            ctx.font = '10px Arial';
            ctx.fillText(index.toString(), x + 8, y + 3);
            ctx.fillStyle = 'rgba(255,50,50,0.9)';
        });
        
        // 连接手指关键点
        const fingers = [
            [0, 1, 2, 3, 4],       // 拇指
            [0, 5, 6, 7, 8],       // 食指
            [0, 9, 10, 11, 12],    // 中指
            [0, 13, 14, 15, 16],   // 无名指
            [0, 17, 18, 19, 20]    // 小指
        ];
        
        // 为每个手指绘制连接线
        fingers.forEach(finger => {
            ctx.beginPath();
            
            // 从手腕到指尖依次连接
            for (let i = 0; i < finger.length; i++) {
                const point = landmarks[finger[i]];
                const x = (1 - point.x) * width;
                const y = point.y * height;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            
            ctx.stroke();
        });
        
        // 连接手掌外围
        const palmOutline = [1, 5, 9, 13, 17, 0];
        ctx.beginPath();
        
        palmOutline.forEach((index, i) => {
            const point = landmarks[index];
            const x = (1 - point.x) * width;
            const y = point.y * height;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // 显示当前手部开合度
        ctx.font = '16px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText(`手部开合度: ${Math.round(handOpenness * 100)}%`, 10, 30);
    }

    const hands = new Hands({
        locateFile(file) {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0, // 0 for fastest, 1 for more accuracy
        minDetectionConfidence: 0.4,
        minTrackingConfidence: 0.4
    });

    hands.onResults(results => {
        const now = performance.now();

        // 显示手部可视化容器
        handVizContainer.style.display = 'block';

        // 检查是否检测到手部
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            if (!isHandDetected) {
                console.log('检测到手部');
            }
            
            isHandDetected = true;
            lastHandUpdateTime = now;
            
            // 使用我们的关键点可视化工具来绘制手部关键点
            // results.image is the camera frame, results.multiHandLandmarks contains the hand data
            drawDetectedHandLandmarks(results.multiHandLandmarks[0]);
            
            // 计算手部开合度
            handOpenness = calculateHandOpenness(results.multiHandLandmarks[0]);
            
            // 更新视频基于手部开合度
            updateVideoBasedOnHand();
        } else {
            // 如果没有检测到手部
            if (now - lastHandUpdateTime > 500) { // 500ms超时
                isHandDetected = false;
                handOpennessElement.textContent = '未检测到手部';
                opennessProgress.style.width = `0%`;
                
                // 隐藏手部可视化或显示默认动画
                if (handViz) {
                    handViz.updateHandByOpenness(0.5); // Reset to a default pose or hide
                    handViz.draw();
                }
            }
        }
    });
    
    // 定义计算手部开合度的函数
    function calculateHandOpenness(landmarks) {
        // 提取关键点
        const wrist = landmarks[0];           // 手腕
        const middleMCP = landmarks[9];      // 中指掌指关节
        const middlePIP = landmarks[10];     // 中指指间关节
        const middleTip = landmarks[12];     // 中指尖
        
        // 按照用户要求的动态标准计算手部开合度
        // 计算手腕到中指掌指关节的距离（手掌长度）
        const palmLength = distance(wrist, middleMCP);
        
        // 计算手腕和中指掌指关节连线的中点
        const midPointX = (wrist.x + middleMCP.x) / 2;
        const midPointY = (wrist.y + middleMCP.y) / 2;
        const midPointZ = (wrist.z + middleMCP.z) / 2;
        const midPoint = { x: midPointX, y: midPointY, z: midPointZ };
        
        // 计算中指尖到中指掌指关节的距离
        const middleExtension = distance(middleTip, middleMCP);
        
        // 计算手掌中点到中指掌指关节的距离
        const midPointToMCP = distance(midPoint, middleMCP);
        
        // 当中指尖落在中指掌指关节和手腕的直线的一半处为0%
        // 当中指尖与中指掌指关节的距离为中指掌指关节到手腕的距离相等时为100%
        
        // 计算开合度
        // 0% 点对应中指尖在中点位置，即 middleExtension = midPointToMCP
        // 100% 点对应中指尖的伸展等于手掌长度，即 middleExtension = palmLength
        
        // 防止除数为零
        if (palmLength - midPointToMCP < 0.001) {
            return lastOpenness || 0;
        }
        
        // 归一化计算
        let openness = (middleExtension - midPointToMCP) / (palmLength - midPointToMCP);
        
        // 限制在0-1范围内
        openness = Math.max(0, Math.min(1, openness));
        
        // 平滑化处理 - 可调整smoothFactor控制平滑度
        if (typeof lastOpenness === 'undefined') {
            lastOpenness = openness;
        } else {
            // 适度的平滑因子，平衡响应速度和平滑度
            const smoothFactor = 0.25;  // 调整这个值可以改变平滑程度（0-1）
            openness = lastOpenness * (1 - smoothFactor) + openness * smoothFactor;
            lastOpenness = openness;
        }
        
        return openness;
    }
    
    // 计算两点之间的欧几里得距离
    function distance(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
    }


    // 检查浏览器是否支持 MediaDevices API
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('浏览器不支持 MediaDevices API，将使用模拟手势');
        
        // 创建一个简单的模拟模式，允许用户使用鼠标控制视频
        document.body.classList.add('mouse-control-mode');
        
        // 创建手部可视化容器
        const handVizContainer = document.createElement('div');
        handVizContainer.id = 'hand-viz-container';
        handVizContainer.classList.add('hand-viz-container');
        document.body.appendChild(handVizContainer);
        
        // 初始化手部关键点可视化
        const handCanvas = document.createElement('canvas');
        handCanvas.id = 'hand-visualization';
        handCanvas.width = 200;
        handCanvas.height = 200;
        handCanvas.classList.add('hand-canvas');
        handVizContainer.appendChild(handCanvas);
        
        // 创建手部可视化实例
        const handViz = new HandVisualization('hand-visualization');
        
        // 初始化并开始动画
        handViz.updateHandByOpenness(0.5);
        handViz.draw();
        
        // 添加模拟手势控制
        webglCanvas.addEventListener('mousemove', (e) => {
            const rect = webglCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // 使用鼠标垂直位置作为手部开合度
            handOpenness = 1 - (y / rect.height);
            handOpenness = Math.max(0, Math.min(1, handOpenness));
            isHandDetected = true;
            lastHandUpdateTime = performance.now();
            
            // 更新手部可视化
            handViz.setOpenness(handOpenness);
            
            // 更新视频/帧
            updateVideoBasedOnHand();
        });
        
        webglCanvas.addEventListener('mouseout', () => {
            isHandDetected = false;
            handOpennessElement.textContent = '未检测到手部';
        });
        
        // 更新UI提示
        handOpennessElement.textContent = '模拟模式: 使用鼠标上下移动控制';
        
        // 直接加载选中的视频
        loadSelectedVideo();
        return;
    }
    
    // 如果支持摄像头访问，则正常启动
    camera.start()
        .then(() => {
            console.log('摄像头启动成功');
            // cameraOutput has been removed, no need to set its dimensions.
            // cameraInput (video element) dimensions are used by MediaPipe directly.
            if (isVideoReady) {
                loadingElement.style.display = 'none';
            }
        })
        .catch(err => {
            console.error('摄像头启动失败:', err);
            loadingElement.textContent = '摄像头启动失败，将使用鼠标模拟手势。';
            
            // 当摄像头启动失败时，也启用鼠标控制模式
            document.body.classList.add('mouse-control-mode');
            
            // 创建手部可视化容器
            const handVizContainer = document.createElement('div');
            handVizContainer.id = 'hand-viz-container';
            handVizContainer.classList.add('hand-viz-container');
            document.body.appendChild(handVizContainer);
            
            // 初始化手部关键点可视化
            const handCanvas = document.createElement('canvas');
            handCanvas.id = 'hand-visualization';
            handCanvas.width = 200;
            handCanvas.height = 200;
            handCanvas.classList.add('hand-canvas');
            handVizContainer.appendChild(handCanvas);
            
            // 创建手部可视化实例
            const handViz = new HandVisualization('hand-visualization');
            
            // 初始化并开始动画
            handViz.startAnimation();
            
            // 添加模拟手势控制
            webglCanvas.addEventListener('mousemove', (e) => {
                const rect = webglCanvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // 使用鼠标垂直位置作为手部开合度
                handOpenness = 1 - (y / rect.height);
                handOpenness = Math.max(0, Math.min(1, handOpenness));
                isHandDetected = true;
                lastHandUpdateTime = performance.now();
                
                // 更新手部可视化
                handViz.setOpenness(handOpenness);
                
                // 更新视频/帧
                updateVideoBasedOnHand();
            });
            
            webglCanvas.addEventListener('mouseout', () => {
                isHandDetected = false;
                handOpennessElement.textContent = '未检测到手部';
            });
            
            // 直接加载选中的视频
            setTimeout(() => {
                loadingElement.style.display = 'none';
                loadSelectedVideo();
            }, 2000);
        });

    window.addEventListener('beforeunload', () => {
        // Optional: Clean up resources if necessary
        // hands.close(); // If hands object has a close method
        // if (camera && camera.stop) camera.stop(); // If camera object has a stop method
    });
});