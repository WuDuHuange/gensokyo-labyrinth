/**
 * 预加载场景 - 加载游戏资源
 */
export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  create() {
    // 直接进入菜单场景
    this.scene.start('MenuScene');
  }
}
