/**
 * 主菜单场景：游戏启动后的开始界面
 */
import AudioManager from '../systems/AudioManager.js';

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' }); // 保持与现有引用一致（PreloadScene 启动 'MenuScene'）
  }

  create() {
    AudioManager.init(this);
    AudioManager.play('music_title', { volume: 0.6, loop: true, fade: 800 });

    var width = this.cameras.main.width;
    var height = this.cameras.main.height;

    this.add.text(width / 2, height / 3, '幻想迷宫', { fontSize: '48px', color: '#e94560' }).setOrigin(0.5);
    this.add.text(width / 2, height / 3 + 48, 'Gensokyo Labyrinth', { fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);

    var startButton = this.add.text(width / 2, height / 2, '【 开始探索 】', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5).setInteractive();
    var self = this;
    startButton.on('pointerover', function() { startButton.setColor('#e94560'); startButton.setScale(1.06); });
    startButton.on('pointerout', function() { startButton.setColor('#ffffff'); startButton.setScale(1); });
    startButton.on('pointerdown', function() { self.startGame(); });

    this.input.keyboard.on('keydown-ENTER', function() { this.startGame(); }.bind(this));
    this.input.keyboard.on('keydown-SPACE', function() { this.startGame(); }.bind(this));
  }

  startGame() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene');
    });
  }
}
