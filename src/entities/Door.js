import Entity from './Entity.js';
import { TILE_SIZE } from '../config/gameConfig.js';

export default class Door extends Entity {
  constructor(scene, x, y, hp = 20) {
    super(scene, x, y, 'door', { name: '门', hp: hp, attack: 0, defense: 0, speed: 0 });
    this.isOpen = false;
    this.locked = false; // 若为 true 则在结界或特殊事件中无法被打开
    // 门默认深度稍低于角色
    try { this.sprite.setDepth(5); } catch (e) {}
  }

  // 触碰开启（玩家接触时调用）
  openByTouch() {
    if (this.isOpen) return false;
    if (this.locked) {
      try { if (this.scene && this.scene.events) this.scene.events.emit('showMessage', '门被结界封印，无法打开！'); } catch (e) {}
      return false;
    }
    this.open();
    return true;
  }

  open() {
    if (this.isOpen) return;
    if (this.locked) return; // 安全检查
    this.isOpen = true;
    this.isAlive = false;
    try {
      this.scene.events.emit('showMessage', `${this.name} 被打开了！`);
    } catch (e) {}
    try { this.sprite.destroy(); } catch (e) {}
    // 触发场景更新视野（门不再阻挡）
    try {
      if (this.scene && this.scene.fog && this.scene.getVisionBlockers) {
        this.scene.fog.setBlockers(this.scene.getVisionBlockers());
        this.scene.fog.compute(this.scene.mapData.tiles, this.scene.player.tileX, this.scene.player.tileY);
        if (this.scene.updateFogVisuals) this.scene.updateFogVisuals();
      }
    } catch (e) {}
  }

  // 关闭门（在结界激活时或召唤门出现时调用）
  close() {
    if (!this.scene) return;
    if (!this.isOpen && this.sprite) return; // already closed
    // 重新创建门的精灵以阻挡通行
    try {
      this.isOpen = false;
      this.isAlive = true;
      // 创建 sprite（覆盖或替换现有）
      try { if (this.sprite) this.sprite.destroy(); } catch (e) {}
      this.sprite = this.scene.add.sprite(this.tileX * TILE_SIZE + TILE_SIZE / 2, this.tileY * TILE_SIZE + TILE_SIZE / 2, 'door');
      try { this.sprite.setDepth(5); } catch (e) {}
      // 触发视野重算
      if (this.scene && this.scene.fog && this.scene.getVisionBlockers) {
        this.scene.fog.setBlockers(this.scene.getVisionBlockers());
        this.scene.fog.compute(this.scene.mapData.tiles, this.scene.player.tileX, this.scene.player.tileY);
        if (this.scene.updateFogVisuals) this.scene.updateFogVisuals();
      }
    } catch (e) {}
  }

  // 覆盖受击，添加血条显示
  takeDamage(damage) {
    const actual = Math.max(1, damage - this.defense);
    this.hp -= actual;

    // 受击视觉
    try {
      this.scene.tweens.add({ targets: this.sprite, tint: 0xff0000, duration: 80, yoyo: true, onComplete: () => { try { this.sprite.clearTint(); } catch(e) {} } });
    } catch (e) {}

    // 显示临时血条
    try {
      // 清理已有血条
      if (this._hpBar) { try { this._hpBar.destroy(); } catch (e) {} this._hpBar = null; }
      const g = this.scene.add.graphics();
      const px = this.tileX * TILE_SIZE + TILE_SIZE / 2;
      const py = this.tileY * TILE_SIZE + TILE_SIZE / 2 - 20;
      // 背景
      g.fillStyle(0x000000, 0.7);
      g.fillRect(px - 18, py - 6, 36, 8);
      // 前景按比例绘制
      const hpRatio = Math.max(0, this.hp / this.maxHp);
      const color = hpRatio > 0.6 ? 0x66ff66 : (hpRatio > 0.3 ? 0xffff66 : 0xff6666);
      g.fillStyle(color, 1);
      g.fillRect(px - 16, py - 4, Math.max(2, Math.floor(32 * hpRatio)), 6);
      g.setDepth(60);
      this._hpBar = g;
      // 渐隐并销毁
      this.scene.tweens.add({ targets: g, alpha: { from: 1, to: 0 }, duration: 900, delay: 300, onComplete: () => { try { g.destroy(); } catch (e) {} } });
    } catch (e) {}

    if (this.hp <= 0) {
      this.open();
    }

    return actual;
  }
}
