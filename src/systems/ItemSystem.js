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

  // 生成容器（如宝箱），在打开时会掉落 items 或直接加入玩家背包
  spawnContainer(tileX, tileY, containerId) {
    const cfg = ITEM_CONFIG[containerId];
    if (!cfg) return null;

    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;

    const spr = this.scene.add.sprite(px, py, cfg.sprite);
    spr.setDepth(6);

    const obj = { id: containerId, x: tileX, y: tileY, sprite: spr, isContainer: true };
    this.items.push(obj);
    return obj;
  }

  // 查找附近可放置掉落物的格子（按距离从近到远）
  findDropPositions(centerX, centerY, needed, maxRadius = 3) {
    const positions = [];
    const isValid = (x, y) => {
      // 在地图范围内且可通行
      try {
        if (!this.scene.mapManager || !this.scene.mapManager.isWalkable(x, y)) return false;
      } catch (e) { return false; }
      // 不能是玩家所在格
      try { if (this.scene.player && this.scene.player.tileX === x && this.scene.player.tileY === y) return false; } catch (e) {}
      // 不能有敌人
      try { if (this.scene.enemies && this.scene.enemies.some(e => e.tileX === x && e.tileY === y)) return false; } catch (e) {}
      // 不能已有地面道具
      try { if (this.items && this.items.some(it => it.x === x && it.y === y)) return false; } catch (e) {}
      return true;
    };

    for (let r = 1; r <= maxRadius && positions.length < needed; r++) {
      for (let dx = -r; dx <= r && positions.length < needed; dx++) {
        for (let dy = -r; dy <= r && positions.length < needed; dy++) {
          const x = centerX + dx;
          const y = centerY + dy;
          // 跳过中心格（要求不要放在箱子所在格）
          if (dx === 0 && dy === 0) continue;
          // 按曼哈顿距离筛选，以优先近格
          const manhattan = Math.abs(dx) + Math.abs(dy);
          if (manhattan !== r) continue;
          if (isValid(x, y)) positions.push({ x, y });
        }
      }
    }

    return positions.slice(0, needed);
  }

  // 在指定格子检查并拾取道具（若存在则触发效果并移除）
  // 将地面上的道具加入玩家背包（拾取但不立即使用）
  tryPickupAt(tileX, tileY, player) {
    const idx = this.items.findIndex(it => it.x === tileX && it.y === tileY);
    if (idx === -1) return false;

    const it = this.items[idx];
    const cfg = ITEM_CONFIG[it.id];
    if (!cfg) return false;
    // 容器（宝箱）类型：打开并发放掉落
    if (cfg.type === 'container' && it.isContainer) {
      // 打开动画
      try {
        this.scene.tweens.add({
          targets: it.sprite,
          scale: { from: 1, to: 1.06 },
          angle: { from: 0, to: 6 },
          duration: 180,
          yoyo: true,
          onComplete: () => { try { it.sprite.destroy(); } catch (e) {} }
        });
      } catch (e) { try { it.sprite.destroy(); } catch (e) {} }

      // 计算掉落数量
      const minD = cfg.minDrop || 1;
      const maxD = cfg.maxDrop || 1;
      const dropCount = Math.floor(Math.random() * (maxD - minD + 1)) + minD;

      // 权重随机选择内容
      const pickWeighted = (list) => {
        const total = list.reduce((s, it) => s + (it.weight || 1), 0);
        let r = Math.random() * total;
        for (const entry of list) {
          r -= (entry.weight || 1);
          if (r <= 0) return entry.item;
        }
        return list[list.length - 1].item;
      };

      // 找到可放置的格子
      const dropPositions = this.findDropPositions(it.x, it.y, dropCount, 4);

      const gained = {};
      for (let i = 0; i < dropCount; i++) {
        const chosen = pickWeighted(cfg.contents || []);
        if (!chosen) continue;

        const pos = dropPositions[i];
        if (pos) {
          // 在地面生成物品
          try { this.spawnItem(pos.x, pos.y, chosen); } catch (e) { 
            // fallback: 加入背包
            try { player.addItem(chosen); } catch (e2) {}
          }
        } else {
          // 无可放置格子时作为备选：直接加入玩家背包
          try { player.addItem(chosen); } catch (e) {}
        }

        gained[chosen] = (gained[chosen] || 0) + 1;
      }

      // 构造文本
      const parts = [];
      for (const k in gained) {
        const count = gained[k];
        const ncfg = ITEM_CONFIG[k] || { name: k };
        parts.push(`${ncfg.name} x${count}`);
      }
      this.scene.events.emit('showMessage', `${player.name} 打开了 ${cfg.name}，掉落：${parts.join('，')}`);

      // 从地面道具列表中移除并销毁箱子
      try { if (it.sprite && it.sprite.destroy) it.sprite.destroy(); } catch (e) {}
      this.items.splice(idx, 1);
      return true;
    }

    // 普通道具的拾取视觉与加入背包
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

    // 金币直接加入升级系统，不进入背包
    if (cfg.type === 'currency' && it.id === 'gold_coin') {
      try {
        const goldValue = 18 + Math.floor(Math.random() * 13); // 18-30 金币，提升基础收益
        if (this.scene.spellUpgradeSystem) {
          this.scene.spellUpgradeSystem.addGold(goldValue);
        } else {
          this.scene.events.emit('showMessage', `${player.name} 拾取了 ${cfg.name}（+${goldValue}）`);
        }
      } catch (e) {}
      this.items.splice(idx, 1);
      return true;
    }

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

    // 处理装备类道具
    if (cfg.type === 'equipment') {
      try {
        if (this.scene.equipmentSystem) {
          const oldEquip = this.scene.equipmentSystem.equip(itemId);
          // 如果替换了旧装备，将其加入背包
          if (oldEquip) {
            player.inventory.push(oldEquip);
          }
          // 从背包移除已装备的道具
          player.inventory.splice(index, 1);
          // 立即更新 UI
          try { if (this.scene.updateUI) this.scene.updateUI(); } catch (e) {}
          return true;
        } else {
          this.scene.events.emit('showMessage', '无法装备该物品');
          return false;
        }
      } catch (e) {
        this.scene.events.emit('showMessage', '装备失败');
        return false;
      }
    }

    // 处理回复效果
    if (cfg.type === 'consumable' && cfg.effect && cfg.effect.heal) {
      try { player.heal(cfg.effect.heal); } catch (e) {}
      this.scene.events.emit('showMessage', `${player.name} 使用了 ${cfg.name}，恢复 ${cfg.effect.heal} 点生命！`);
      this.scene.events.emit('showDamage', { x: player.sprite.x, y: player.sprite.y - 20, damage: cfg.effect.heal, isHeal: true });
      // 立即更新 UI 以显示新的血量
      try { if (this.scene.updateUI) this.scene.updateUI(); } catch (e) {}
    }
    
    // 处理天赋书效果
    if (cfg.type === 'consumable' && cfg.effect && cfg.effect.grantTalent) {
      try {
        if (this.scene.talentSystem) {
          const talent = this.scene.talentSystem.acquireRandom();
          if (!talent) {
            // 已拥有所有天赋，不消耗道具
            this.scene.events.emit('showMessage', '你已习得所有天赋，秘传书失去效果...');
            return false;
          }
        } else {
          this.scene.events.emit('showMessage', `${player.name} 使用了 ${cfg.name}，但没有任何效果...`);
        }
      } catch (e) {
        this.scene.events.emit('showMessage', `${cfg.name} 使用失败`);
      }
    }

    // 从玩家背包移除
    player.inventory.splice(index, 1);
    return true;
  }
}
