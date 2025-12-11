/**
 * 启动场景 - 初始化游戏资源
 */
export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // 显示加载文字
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    
    const loadingText = this.add.text(width / 2, height / 2 - 50, '幻想迷宫', {
      fontSize: '32px',
      fontFamily: 'Arial',
      color: '#e94560'
    }).setOrigin(0.5);
    
    const progressText = this.add.text(width / 2, height / 2, '加载中...', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);

    // 进度条背景
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 + 30, 320, 30);

    // 监听加载进度
    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0xe94560, 1);
      progressBar.fillRect(width / 2 - 155, height / 2 + 35, 310 * value, 20);
      progressText.setText(`加载中... ${Math.floor(value * 100)}%`);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      progressText.destroy();
    });

    // 这里暂时不加载外部资源，使用程序生成的图形
  }

  create() {
    // 生成临时精灵图
    this.createTempSprites();
    
    // 进入预加载场景
    this.scene.start('PreloadScene');
  }

  /**
   * 创建临时精灵图（用于开发阶段）
   */
  createTempSprites() {
    // 创建玩家精灵（灵梦 - 红白配色）
    const playerGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    playerGraphics.fillStyle(0xff6b6b);
    playerGraphics.fillRect(4, 4, 24, 24);
    playerGraphics.fillStyle(0xffffff);
    playerGraphics.fillRect(8, 8, 8, 8);  // 白色装饰
    playerGraphics.fillStyle(0xff0000);
    playerGraphics.fillRect(18, 6, 6, 4); // 红色蝴蝶结
    playerGraphics.generateTexture('player', 32, 32);
    playerGraphics.destroy();

    // 创建慢速妖精（蓝色）
    const slowFairyGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    slowFairyGraphics.fillStyle(0x6b9fff);
    slowFairyGraphics.fillCircle(16, 16, 12);
    slowFairyGraphics.fillStyle(0xffffff);
    slowFairyGraphics.fillCircle(12, 12, 3);
    slowFairyGraphics.fillCircle(20, 12, 3);
    slowFairyGraphics.generateTexture('slowFairy', 32, 32);
    slowFairyGraphics.destroy();

    // 创建普通妖精（绿色）
    const normalFairyGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    normalFairyGraphics.fillStyle(0x6bff9f);
    normalFairyGraphics.fillCircle(16, 16, 12);
    normalFairyGraphics.fillStyle(0xffffff);
    normalFairyGraphics.fillCircle(12, 12, 3);
    normalFairyGraphics.fillCircle(20, 12, 3);
    normalFairyGraphics.generateTexture('normalFairy', 32, 32);
    normalFairyGraphics.destroy();

    // 创建快速妖精（黄色）
    const fastFairyGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    fastFairyGraphics.fillStyle(0xffdb6b);
    fastFairyGraphics.fillCircle(16, 16, 10);
    fastFairyGraphics.fillStyle(0xffffff);
    fastFairyGraphics.fillCircle(12, 12, 2);
    fastFairyGraphics.fillCircle(20, 12, 2);
    fastFairyGraphics.generateTexture('fastFairy', 32, 32);
    fastFairyGraphics.destroy();

    // 创建弹幕妖精（紫色）
    const danmakuFairyGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    danmakuFairyGraphics.fillStyle(0xb56bff);
    danmakuFairyGraphics.fillCircle(16, 16, 12);
    danmakuFairyGraphics.fillStyle(0xffffff);
    danmakuFairyGraphics.fillCircle(12, 12, 3);
    danmakuFairyGraphics.fillCircle(20, 12, 3);
    danmakuFairyGraphics.fillStyle(0xff6bff);
    danmakuFairyGraphics.fillTriangle(16, 0, 8, 8, 24, 8);
    danmakuFairyGraphics.generateTexture('danmakuFairy', 32, 32);
    danmakuFairyGraphics.destroy();

    // 创建墙壁瓦片
    const wallGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    wallGraphics.fillStyle(0x4a4a6a);
    wallGraphics.fillRect(0, 0, 32, 32);
    wallGraphics.fillStyle(0x3a3a5a);
    wallGraphics.fillRect(2, 2, 28, 28);
    wallGraphics.generateTexture('wall', 32, 32);
    wallGraphics.destroy();

    // 创建地板瓦片
    const floorGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    floorGraphics.fillStyle(0x2a2a4a);
    floorGraphics.fillRect(0, 0, 32, 32);
    floorGraphics.fillStyle(0x252545);
    floorGraphics.fillRect(0, 0, 16, 16);
    floorGraphics.fillRect(16, 16, 16, 16);
    floorGraphics.generateTexture('floor', 32, 32);
    floorGraphics.destroy();

    // 创建出口瓦片（幻想之门）
    const exitGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    exitGraphics.fillStyle(0x00ff88);
    exitGraphics.fillRect(4, 4, 24, 24);
    exitGraphics.fillStyle(0x00cc66);
    exitGraphics.fillRect(8, 8, 16, 16);
    exitGraphics.fillStyle(0xffffff);
    exitGraphics.fillRect(12, 12, 8, 8);
    exitGraphics.generateTexture('exit', 32, 32);
    exitGraphics.destroy();

    // 创建弹幕精灵
    const bulletGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    bulletGraphics.fillStyle(0xff6b6b);
    bulletGraphics.fillCircle(8, 8, 6);
    bulletGraphics.fillStyle(0xffffff);
    bulletGraphics.fillCircle(8, 8, 3);
    bulletGraphics.generateTexture('bullet', 16, 16);
    bulletGraphics.destroy();

    // 创建敌人弹幕
    const enemyBulletGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    enemyBulletGraphics.fillStyle(0xb56bff);
    enemyBulletGraphics.fillCircle(8, 8, 6);
    enemyBulletGraphics.fillStyle(0xffffff);
    enemyBulletGraphics.fillCircle(8, 8, 3);
    enemyBulletGraphics.generateTexture('enemyBullet', 16, 16);
    enemyBulletGraphics.destroy();

    // 创建粒子贴图 spark（用于激光冲击特效）
    const sparkGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    sparkGraphics.fillStyle(0xffdd66);
    sparkGraphics.fillCircle(4, 4, 4);
    sparkGraphics.generateTexture('spark', 8, 8);
    sparkGraphics.destroy();
  }
}
