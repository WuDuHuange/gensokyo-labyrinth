/**
 * 主菜单场景
 */
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 标题
    this.add.text(width / 2, height / 3, '幻想迷宫', {
      fontSize: '48px',
      fontFamily: 'Arial',
      color: '#e94560',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    // 副标题
    this.add.text(width / 2, height / 3 + 50, 'Gensokyo Labyrinth', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);

    // 开始游戏按钮
    const startButton = this.add.text(width / 2, height / 2 + 50, '【 开始探索 】', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startButton.on('pointerover', () => {
      startButton.setColor('#e94560');
      startButton.setScale(1.1);
    });

    startButton.on('pointerout', () => {
      startButton.setColor('#ffffff');
      startButton.setScale(1);
    });

    startButton.on('pointerdown', () => {
      this.startGame();
    });

    // 操作说明
    this.add.text(width / 2, height - 130, '操作说明', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#e94560'
    }).setOrigin(0.5);

    this.add.text(width / 2, height - 105, '方向键/WASD: 八向移动 | 空格: 等待 | Z/X/C: 符卡', {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#aaaaaa'
    }).setOrigin(0.5);
    
    this.add.text(width / 2, height - 85, 'Q+方向: 原地转向（不消耗行动） | TAB: 自由视角 | R: 返回', {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#aaaaaa'
    }).setOrigin(0.5);

    // 版本信息
    this.add.text(width - 10, height - 10, 'Demo v0.1.0', {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#666666'
    }).setOrigin(1, 1);

    // 键盘快捷键
    this.input.keyboard.on('keydown-ENTER', () => {
      this.startGame();
    });

    this.input.keyboard.on('keydown-SPACE', () => {
      this.startGame();
    });
  }

  startGame() {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene');
    });
  }
}
