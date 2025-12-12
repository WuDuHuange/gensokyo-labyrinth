import { TILE_SIZE, ITEM_CONFIG } from '../config/gameConfig.js';

export default class ItemSystem {
  constructor(scene) {
    this.scene = scene;
    this.items = []; // { id, x, y, sprite }
  }

  spawnItem(tileX, tileY, itemId) {
    const cfg = ITEM_CONFIG[itemId];
    if (!cfg) return null;

    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;

    const spr = this.scene.add.sprite(px, py, cfg.sprite);
    spr.setDepth(6);

    const obj = { id: itemId, x: tileX, y: tileY, sprite: spr };
    this.items.push(obj);
    return obj;
  }

  // 在指定格子检查并拾取道具（若存在则触发效果并移除）
  async tryPickupAt(tileX, tileY, player) {
    const idx = this.items.findIndex(it => it.x === tileX && it.y === tileY);
    if (idx === -1) return false;

    const it = this.items[idx];
    const cfg = ITEM_CONFIG[it.id];
    if (!cfg) return false;

    // 简单的拾取视觉：缩放并淡出
    try {
      this.scene.tweens.add({
        targets: it.sprite,
        scale: { from: 1, to: 1.4 },
        alpha: { from: 1, to: 0 },
        duration: 260,
        ease: 'Cubic.easeOut',
        onComplete: () => { try { it.sprite.destroy(); } catch (e) {} }
      });
    } catch (e) { try { it.sprite.destroy(); } catch (e) {} }

    // 应用效果：目前仅实现回复类消耗品
    if (cfg.type === 'consumable' && cfg.effect && cfg.effect.heal) {
      try { player.heal(cfg.effect.heal); } catch (e) {}
      this.scene.events.emit('showMessage', `${player.name} 拾取了 ${cfg.name}，恢复 ${cfg.effect.heal} 点生命！`);
      this.scene.events.emit('showDamage', { x: player.sprite.x, y: player.sprite.y - 20, damage: cfg.effect.heal, isHeal: true });
    }

    // 从列表中移除
    this.items.splice(idx, 1);

    return true;
  }
}
