# 花朵绽放交互项目

这是一个创意交互项目，通过手部动作控制花朵绽放的视频播放。用户可以通过手掌的开合程度来控制花朵绽放的进度，实现一种自然而有趣的人机交互体验。

## 功能特点

- 使用MediaPipe进行手部追踪和识别
- 通过手掌开合程度控制花朵绽放视频的播放进度
- 支持多个花朵视频切换
- 支持全屏模式
- 可隐藏/显示摄像头画面
- 纯前端实现，可部署到GitHub Pages

## 使用方法

1. 打开网页后，请允许浏览器访问摄像头
2. 将手掌对准摄像头，系统会自动识别手部
3. 手掌完全张开时，花朵将完全绽放
4. 手掌半握拳时，花朵将处于半开状态
5. 可以通过下拉菜单选择不同的花朵视频
6. 点击"全屏观看"按钮可进入全屏模式
7. 点击"隐藏/显示摄像头"按钮可控制摄像头画面的显示

## 技术实现

- HTML5 + CSS3 + JavaScript
- MediaPipe Hands API用于手部追踪
- WebGL用于高性能视频渲染
- 使用帧提取技术优化交互流畅度

## 本地运行

由于浏览器安全策略，直接打开HTML文件可能无法正常访问摄像头和视频文件。建议使用本地服务器运行项目：

```bash
# 如果安装了Python，可以使用以下命令启动简单的HTTP服务器
# Python 3.x
python -m http.server
```

然后在浏览器中访问 `http://localhost:8000`

## 素材来源

花朵视频素材来源于Bilibili视频：[《"啊，花开了" | 拍摄历时4个月，15万次快门【4K】》](https://www.bilibili.com/video/BV1wg411g7xL/)
感谢原作者的精彩作品！
