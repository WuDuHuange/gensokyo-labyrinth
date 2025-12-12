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
  // 将地面上的道具加入玩家背包（拾取但不立即使用）
  tryPickupAt(tileX, tileY, player) {
    const idx = this.items.findIndex(it => it.x === tileX && it.y === tileY);
    if (idx === -1) return false;

    const it = this.items[idx];
    const cfg = ITEM_CONFIG[it.id];
    if (!cfg) return false;

    // 拾取视觉
    try {
      this.scene.tweens.add({
        targets: it.sprite,
        scale: { from: 1, to: 1.2 },
        alpha: { from: 1, to: 0 },
        duration: 240,
        ease: 'Cubic.easeOut',
        onComplete: () => { try { it.sprite.destroy(); } catch (e) {} }
      });
    } catch (e) { try { it.sprite.destroy(); } catch (e) {} }

    // 加入玩家背包（不立即触发效果）
    try {
      player.addItem(it.id);
      this.scene.events.emit('showMessage', `${player.name} 拾取了 ${cfg.name}（已加入背包）`);
    } catch (e) {}

    // 从地面道具列表中移除
    this.items.splice(idx, 1);
    return true;
  }

  // 使用玩家背包内的道具（index 是玩家.inventory 的下标）
  useItem(player, index) {
    if (!player || !player.inventory || index < 0 || index >= player.inventory.length) return false;
    const itemId = player.inventory[index];
    const cfg = ITEM_CONFIG[itemId];
    if (!cfg) return false;

    // 目前仅实现 heal 效果
    if (cfg.type === 'consumable' && cfg.effect && cfg.effect.heal) {
      try { player.heal(cfg.effect.heal); } catch (e) {}
      this.scene.events.emit('showMessage', `${player.name} 使用了 ${cfg.name}，恢复 ${cfg.effect.heal} 点生命！`);
      this.scene.events.emit('showDamage', { x: player.sprite.x, y: player.sprite.y - 20, damage: cfg.effect.heal, isHeal: true });
    }

    // 从玩家背包移除
    player.inventory.splice(index, 1);
    return true;
  }
}
