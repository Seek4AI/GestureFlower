/**
 * 手部关键点可视化工具
 * 用于在没有实际手部检测时显示虚拟手部模型
 */
class HandVisualization {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.landmarks = this.getDefaultHandLandmarks();
        this.animating = false;
        this.openness = 0;
    }

    /**
     * 获取默认手部关键点位置
     * @returns {Array} 手部关键点数组
     */
    getDefaultHandLandmarks() {
        // 基本手掌模型 - 21个关键点的相对位置
        const baseHand = [
            // 手腕
            { x: 0.5, y: 0.8 },
            
            // 拇指 (4点)
            { x: 0.4, y: 0.7 },
            { x: 0.35, y: 0.6 },
            { x: 0.3, y: 0.55 },
            { x: 0.25, y: 0.5 },
            
            // 食指 (4点)
            { x: 0.45, y: 0.6 },
            { x: 0.45, y: 0.5 },
            { x: 0.45, y: 0.4 },
            { x: 0.45, y: 0.3 },
            
            // 中指 (4点)
            { x: 0.5, y: 0.6 },
            { x: 0.5, y: 0.5 },
            { x: 0.5, y: 0.4 },
            { x: 0.5, y: 0.3 },
            
            // 无名指 (4点)
            { x: 0.55, y: 0.6 },
            { x: 0.55, y: 0.5 },
            { x: 0.55, y: 0.4 },
            { x: 0.55, y: 0.35 },
            
            // 小指 (4点)
            { x: 0.6, y: 0.65 },
            { x: 0.6, y: 0.55 },
            { x: 0.6, y: 0.45 },
            { x: 0.6, y: 0.4 },
        ];
        
        return baseHand;
    }
    
    /**
     * 根据手部开合度更新关键点位置
     * @param {number} openness - 手部开合度 (0-1)
     */
    updateHandByOpenness(openness) {
        this.openness = openness;
        const landmarks = this.getDefaultHandLandmarks();
        
        // 手指弯曲程度
        const fingerBend = 1 - openness;
        
        // 更新各个手指的关键点
        for (let finger = 0; finger < 5; finger++) {
            const baseIndex = finger * 4 + 1; // 每个手指起始索引
            
            // 对于每个指节
            for (let joint = 1; joint < 4; joint++) {
                const pointIndex = baseIndex + joint;
                
                // 中指的运动范围是最大的，其他手指稍小
                let factor = 0.2;
                if (finger === 2) factor = 0.25; // 中指
                
                // 弯曲手指 - 将指尖向手掌方向移动
                landmarks[pointIndex].y = landmarks[pointIndex].y + fingerBend * factor;
                
                // 拇指的运动轨迹不同，它会向掌心移动
                if (finger === 0) {
                    landmarks[pointIndex].x = landmarks[pointIndex].x + fingerBend * 0.15;
                }
            }
        }
        
        this.landmarks = landmarks;
    }
    
    /**
     * 绘制手部关键点
     */
    draw() {
        const { width, height } = this.canvas;
        this.ctx.clearRect(0, 0, width, height);
        
        // 清除背景为透明色
        this.ctx.clearRect(0, 0, width, height);
        
        // 绘制背景网格达到可视效果
        this.drawGrid(width, height);
        
        // 设置样式 - 使用更高对比度的颜色
        this.ctx.fillStyle = 'rgba(255,50,50,0.9)';
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 3;
        
        // 绘制关键点
        this.landmarks.forEach((point, index) => {
            const x = point.x * width;
            const y = point.y * height;
            
            // 绘制点
            this.ctx.beginPath();
            this.ctx.arc(x, y, 5, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 绘制点的索引
            this.ctx.fillStyle = 'white';
            this.ctx.font = '10px Arial';
            this.ctx.fillText(index.toString(), x + 8, y + 3);
            this.ctx.fillStyle = 'rgba(255,0,0,0.7)';
        });
        
        // 连接手指关键点
        this.connectFingerJoints();
        
        // 绘制手掌连接
        this.connectPalmJoints();
        
        // 显示当前手部开合度
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = 'white';
        this.ctx.fillText(`手部开合度: ${Math.round(this.openness * 100)}%`, 10, 30);
    }
    
    /**
     * 连接手指关节
     */
    connectFingerJoints() {
        const { width, height } = this.canvas;
        
        // 每个手指的关键点索引
        const fingers = [
            [0, 1, 2, 3, 4],       // 拇指
            [0, 5, 6, 7, 8],       // 食指
            [0, 9, 10, 11, 12],    // 中指
            [0, 13, 14, 15, 16],   // 无名指
            [0, 17, 18, 19, 20]    // 小指
        ];
        
        // 为每个手指绘制连接线
        fingers.forEach(finger => {
            this.ctx.beginPath();
            
            // 从手腕到指尖依次连接
            for (let i = 0; i < finger.length; i++) {
                const point = this.landmarks[finger[i]];
                const x = point.x * width;
                const y = point.y * height;
                
                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            
            this.ctx.stroke();
        });
    }
    
    /**
     * 连接手掌关节
     */
    connectPalmJoints() {
        const { width, height } = this.canvas;
        
        // 手掌外围的关键点连接
        const palmOutline = [1, 5, 9, 13, 17, 0];
        
        this.ctx.beginPath();
        
        palmOutline.forEach((index, i) => {
            const point = this.landmarks[index];
            const x = point.x * width;
            const y = point.y * height;
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        });
        
        this.ctx.stroke();
    }
    
    /**
     * 绘制背景网格
     * @param {number} width - 画布宽度
     * @param {number} height - 画布高度
     */
    drawGrid(width, height) {
        // 绘制网格背景
        this.ctx.strokeStyle = 'rgba(150, 150, 150, 0.2)';
        this.ctx.lineWidth = 1;
        
        // 网格大小
        const gridSize = 20;
        
        // 绘制垂直线
        for (let x = 0; x <= width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }
        
        // 绘制水平线
        for (let y = 0; y <= height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
        
        // 绘制坐标轴
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.lineWidth = 2;
        
        // X轴
        this.ctx.beginPath();
        this.ctx.moveTo(0, height/2);
        this.ctx.lineTo(width, height/2);
        this.ctx.stroke();
        
        // Y轴
        this.ctx.beginPath();
        this.ctx.moveTo(width/2, 0);
        this.ctx.lineTo(width/2, height);
        this.ctx.stroke();
    }
    
    /**
     * 开始动画演示
     */
    startAnimation() {
        if (this.animating) return;
        
        this.animating = true;
        let direction = 1;
        let currentOpenness = 0;
        
        const animate = () => {
            if (!this.animating) return;
            
            // 更新开合度
            currentOpenness += 0.01 * direction;
            
            // 边界检查并反转方向
            if (currentOpenness >= 1) {
                currentOpenness = 1;
                direction = -1;
            } else if (currentOpenness <= 0) {
                currentOpenness = 0;
                direction = 1;
            }
            
            // 更新手部模型并绘制
            this.updateHandByOpenness(currentOpenness);
            this.draw();
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    /**
     * 停止动画
     */
    stopAnimation() {
        this.animating = false;
    }
    
    /**
     * 设置手部开合度并绘制
     * @param {number} openness - 开合度 (0-1)
     */
    setOpenness(openness) {
        this.stopAnimation();
        this.updateHandByOpenness(openness);
        this.draw();
    }
}
