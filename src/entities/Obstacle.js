/**
 * 可破坏障碍物（石块）
 * 阻挡移动和视线，可被攻击破坏
 */
import { TILE_SIZE } from '../config/gameConfig.js';

export default class Obstacle {
  constructor(scene, tileX, tileY, config = {}) {
    this.scene = scene;
    this.tileX = tileX;
    this.tileY = tileY;
    
    // 属性
    this.maxHp = config.hp || 30;
    this.hp = this.maxHp;
    this.defense = config.defense || 5;
    this.isAlive = true;
    this.blocksVision = config.blocksVision !== false;  // 默认阻挡视线
    this.blocksMovement = true;
    
    // 创建精灵
    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;
    
    this.sprite = scene.add.sprite(px, py, 'rock');
    this.sprite.setDepth(7);
    
    // 如果没有预加载 rock 纹理，创建一个
    if (!scene.textures.exists('rock')) {
      this.createRockTexture();
    }
    
    // 血条（仅在被攻击时显示）
    this.hpBar = null;
    this.hpBarBg = null;
    this.showHpBar = false;
  }
  
  createRockTexture() {
    // 由于纹理需要在 preload 阶段创建，这里用 graphics 直接绘制
    try {
      const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x666677);
      g.fillRoundedRect(4, 8, 24, 20, 4);
      g.fillStyle(0x555566);
      g.fillRect(8, 10, 8, 6);
      g.fillRect(18, 14, 6, 8);
      g.generateTexture('rock', 32, 32);
      g.destroy();
      // 更新精灵纹理
      this.sprite.setTexture('rock');
    } catch (e) {
      // fallback: 使用颜色矩形
      this.sprite.destroy();
      this.sprite = this.scene.add.rectangle(
        this.tileX * TILE_SIZE + TILE_SIZE / 2,
        this.tileY * TILE_SIZE + TILE_SIZE / 2,
        28, 24, 0x666677
      );
      this.sprite.setDepth(7);
    }
  }
  
  /**
   * 受到伤害
   */
  takeDamage(rawDamage) {
    if (!this.isAlive) return 0;
    
    const damage = Math.max(1, rawDamage - this.defense);
    this.hp -= damage;
    
    // 显示血条
    this.displayHpBar();
    
    // 受击闪烁
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.5,
      duration: 50,
      yoyo: true
    });
    
    // 显示伤害数字
    this.scene.events.emit('showDamage', {
      x: this.sprite.x,
      y: this.sprite.y - 20,
      damage: damage,
      isHeal: false
    });
    
    if (this.hp <= 0) {
      this.destroy();
    }
    
    return damage;
  }
  
  /**
   * 显示血条
   */
  displayHpBar() {
    const barWidth = 28;
    const barHeight = 4;
    const offsetY = -18;
    
    if (!this.hpBarBg) {
      this.hpBarBg = this.scene.add.rectangle(
        this.sprite.x, this.sprite.y + offsetY,
        barWidth, barHeight, 0x333333
      );
      this.hpBarBg.setDepth(15);
    }
    
    if (!this.hpBar) {
      this.hpBar = this.scene.add.rectangle(
        this.sprite.x, this.sprite.y + offsetY,
        barWidth, barHeight, 0x888888
      );
      this.hpBar.setDepth(16);
    }
    
    // 更新血条宽度
    const ratio = Math.max(0, this.hp / this.maxHp);
    this.hpBar.width = barWidth * ratio;
    this.hpBar.x = this.sprite.x - (barWidth - this.hpBar.width) / 2;
    
    this.showHpBar = true;
  }
  
  /**
   * 破坏障碍物
   */
  destroy() {
    this.isAlive = false;
    this.blocksMovement = false;
    this.blocksVision = false;
    
    // 破坏动画
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      scaleX: 0.5,
      scaleY: 0.5,
      duration: 200,
      onComplete: () => {
        try { this.sprite.destroy(); } catch (e) {}
      }
    });
    
    // 清理血条
    try { if (this.hpBar) this.hpBar.destroy(); } catch (e) {}
    try { if (this.hpBarBg) this.hpBarBg.destroy(); } catch (e) {}
    
    // 粒子效果
    try {
      for (let i = 0; i < 5; i++) {
        const particle = this.scene.add.circle(
          this.sprite.x + (Math.random() - 0.5) * 20,
          this.sprite.y + (Math.random() - 0.5) * 20,
          3, 0x666677
        );
        particle.setDepth(15);
        this.scene.tweens.add({
          targets: particle,
          x: particle.x + (Math.random() - 0.5) * 40,
          y: particle.y + Math.random() * 30,
          alpha: 0,
          duration: 400,
          onComplete: () => particle.destroy()
        });
      }
    } catch (e) {}
    
    // 从场景障碍物列表中移除
    try {
      const idx = this.scene.obstacles.indexOf(this);
      if (idx !== -1) this.scene.obstacles.splice(idx, 1);
    } catch (e) {}
    
    // 可能掉落物品
    if (Math.random() < 0.3) {
      try {
        const items = ['herb', 'gold_coin'];
        const item = items[Math.floor(Math.random() * items.length)];
        this.scene.itemSystem.spawnItem(this.tileX, this.tileY, item);
      } catch (e) {}
    }
    
    this.scene.events.emit('showMessage', '石块被破坏了！');
  }
  
  /**
   * 设置可见性（配合迷雾系统）
   */
  setVisible(visible) {
    try {
      this.sprite.setVisible(visible);
      if (this.hpBar) this.hpBar.setVisible(visible && this.showHpBar);
      if (this.hpBarBg) this.hpBarBg.setVisible(visible && this.showHpBar);
    } catch (e) {}
  }
}
