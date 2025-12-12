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

    // 创建治疗药剂贴图（小瓶）
    const potionGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    potionGraphics.fillStyle(0xffccdd);
    potionGraphics.fillRoundedRect(8, 6, 16, 20, 4);
    potionGraphics.fillStyle(0xff6b6b);
    potionGraphics.fillRect(12, 4, 8, 6);
    potionGraphics.generateTexture('potion', 32, 32);
    potionGraphics.destroy();

    // 创建金币贴图
    const coinGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    coinGraphics.fillStyle(0xffd700);
    coinGraphics.fillCircle(12, 12, 10);
    coinGraphics.fillStyle(0xfff8cc);
    coinGraphics.fillCircle(12, 12, 5);
    coinGraphics.generateTexture('coin', 24, 24);
    coinGraphics.destroy();

    // 创建草药贴图
    const herbGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    herbGraphics.fillStyle(0x6bff6b);
    herbGraphics.fillRoundedRect(6, 6, 16, 12, 4);
    herbGraphics.fillStyle(0x2b8b2b);
    herbGraphics.fillRect(12, 2, 4, 6);
    herbGraphics.generateTexture('herb', 28, 28);
    herbGraphics.destroy();

    // 创建木箱贴图
    const chestGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    chestGraphics.fillStyle(0x8b5a2b);
    chestGraphics.fillRoundedRect(2, 8, 28, 18, 3);
    chestGraphics.fillStyle(0x6b3e1b);
    chestGraphics.fillRect(2, 8, 28, 4);
    chestGraphics.generateTexture('chest', 32, 32);
    chestGraphics.destroy();

    // 创建门贴图
    const doorGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    doorGraphics.fillStyle(0x5a3b2a);
    doorGraphics.fillRect(4, 2, 24, 28);
    doorGraphics.fillStyle(0x3a2b1a);
    doorGraphics.fillRect(6, 4, 20, 6);
    doorGraphics.fillStyle(0xffcc66);
    doorGraphics.fillCircle(24, 16, 2);
    doorGraphics.generateTexture('door', 32, 32);
    doorGraphics.destroy();

    // 创建 DemoBoss（水晶核心）贴图
    const demoCrystalGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    demoCrystalGraphics.fillStyle(0x66ccff);
    demoCrystalGraphics.fillTriangle(16, 2, 4, 24, 28, 24);
    demoCrystalGraphics.fillStyle(0xaaeeff);
    demoCrystalGraphics.fillTriangle(16, 8, 8, 20, 24, 20);
    demoCrystalGraphics.fillStyle(0xffffff);
    demoCrystalGraphics.fillCircle(16, 16, 4);
    demoCrystalGraphics.generateTexture('demoCrystal', 32, 32);
    demoCrystalGraphics.destroy();

    // 创建小晶体贴图
    const smallCrystalGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    smallCrystalGraphics.fillStyle(0x88ddff);
    smallCrystalGraphics.fillTriangle(16, 6, 8, 22, 24, 22);
    smallCrystalGraphics.fillStyle(0xccffff);
    smallCrystalGraphics.fillTriangle(16, 10, 11, 19, 21, 19);
    smallCrystalGraphics.generateTexture('smallCrystal', 32, 32);
    smallCrystalGraphics.destroy();
  }
}
