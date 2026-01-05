/**
 * SpellCardSystem.js
 * 干净的、单一实现：使用 Circle/Container 作为投射物，动画到达格子时触发伤害。
 */

import { SPELLCARD_CONFIG, TILE_SIZE } from '../config/gameConfig.js';

export class SpellCard {
  constructor(scene, config) {
    this.scene = scene;
    this.name = config.name;
    this.type = config.type;
    this.baseMpCost = config.mpCost; // 保存基础值
    this.mpCost = config.mpCost;
    this.baseCooldown = config.cooldown; // 保存基础值（回合数，转换为毫秒）
    this.cooldownMs = config.cooldown * 1000; // 转换为毫秒（1回合=1秒）
    this.baseDamage = config.damage; // 保存基础值
    this.damage = config.damage;
    this.currentCooldown = 0; // 当前剩余冷却（毫秒）
    
    // 升级加成（由 SpellUpgradeSystem 设置）
    this._upgradeBonus = null;
  }
  
  /**
   * 获取升级后的实际伤害
   */
  getEffectiveDamage() {
    if (this._upgradeBonus && this._upgradeBonus.damageMult) {
      return Math.floor(this.baseDamage * this._upgradeBonus.damageMult);
    }
    return this.baseDamage;
  }
  
  /**
   * 获取升级后的实际消耗
   */
  getEffectiveMpCost() {
    if (this._upgradeBonus && this._upgradeBonus.mpCostMult) {
      return Math.ceil(this.baseMpCost * this._upgradeBonus.mpCostMult);
    }
    return this.baseMpCost;
  }
  
  /**
   * 获取升级后的实际冷却
   */
  getEffectiveCooldown() {
    let cd = this.baseCooldown;
    if (this._upgradeBonus && this._upgradeBonus.cooldownReduction) {
      cd = Math.max(1, cd - this._upgradeBonus.cooldownReduction);
    }
    return cd * 1000; // 返回毫秒
  }

  canUse(currentMp) {
    return currentMp >= this.getEffectiveMpCost() && this.currentCooldown === 0;
  }

  use(caster, target) {
    // 子类实现
  }

  /**
   * 减少冷却时间（基于时间流逝）
   * @param {number} deltaMs - 经过的毫秒数（已经过时间缩放）
   */
  reduceCooldown(deltaMs = 1000) {
    if (this.currentCooldown > 0) {
      this.currentCooldown = Math.max(0, this.currentCooldown - deltaMs);
    }
  }

  startCooldown() {
    this.currentCooldown = this.getEffectiveCooldown();
  }

  /**
   * 获取冷却进度（0-1，用于UI显示）
   */
  getCooldownProgress() {
    const max = this.getEffectiveCooldown();
    if (max <= 0) return 0;
    return this.currentCooldown / max;
  }
}

export class MeigyokuAnki extends SpellCard {
  constructor(scene) {
    super(scene, SPELLCARD_CONFIG.meigyokuAnki);
    this.projectileCount = SPELLCARD_CONFIG.meigyokuAnki.projectileCount;
    this.bounceCount = SPELLCARD_CONFIG.meigyokuAnki.bounceCount;
    this.range = SPELLCARD_CONFIG.meigyokuAnki.range;
  }

  use(caster, direction) {
    const startX = caster.tileX;
    const startY = caster.tileY;
    const baseDir = { x: direction.x, y: direction.y };
    const allHitPositions = [];

    // 顺序投掷 5 个投射物，每个有轻微的垂直偏移（相对于射向）
    const offsets = [-2, -1, 0, 1, 2];
    const perpX = -baseDir.y;
    const perpY = baseDir.x;

    offsets.forEach((off, idx) => {
      // 将偏移压缩为 -1, 0, 1 以保持“轻微”偏移
      const perpSign = off === 0 ? 0 : (off > 0 ? 1 : -1);
      let dx = baseDir.x + perpX * perpSign;
      let dy = baseDir.y + perpY * perpSign;

      // 限制为 -1/0/1
      dx = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
      dy = dy > 0 ? 1 : (dy < 0 ? -1 : 0);

      // 如果偏移后变成 (0,0)（极少数情况），回退为基础方向
      if (dx === 0 && dy === 0) {
        dx = baseDir.x;
        dy = baseDir.y;
      }

      const path = this.calculateBouncePath(startX, startY, { x: dx, y: dy });
      if (path && path.length > 0) {
        allHitPositions.push(...path);
        this.createYinyangOrb(startX, startY, path, idx);
      }
    });

    return { damage: this.getEffectiveDamage(), positions: allHitPositions, piercing: true, projectileCount: offsets.length };
  }

  getSpreadDirections(baseDir) {
    const directions = [];
    if (baseDir.x !== 0 && baseDir.y === 0) {
      directions.push({ x: baseDir.x, y: -1 });
      directions.push({ x: baseDir.x, y: 0 });
      directions.push({ x: baseDir.x, y: 1 });
    } else if (baseDir.y !== 0 && baseDir.x === 0) {
      directions.push({ x: -1, y: baseDir.y });
      directions.push({ x: 0, y: baseDir.y });
      directions.push({ x: 1, y: baseDir.y });
    } else {
      directions.push({ x: baseDir.x, y: 0 });
      directions.push({ x: baseDir.x, y: baseDir.y });
      directions.push({ x: 0, y: baseDir.y });
    }
    return directions;
  }

  calculateBouncePath(startX, startY, direction) {
    const path = [];
    let x = startX;
    let y = startY;
    let dx = direction.x;
    let dy = direction.y;
    let bounces = 0;

    for (let i = 0; i < this.range * (this.bounceCount + 1); i++) {
      x += dx;
      y += dy;

      if (!this.scene.mapManager.isWalkable(x, y)) {
        if (bounces >= this.bounceCount) break;
        bounces++;

        const canMoveX = this.scene.mapManager.isWalkable(x, y - dy);
        const canMoveY = this.scene.mapManager.isWalkable(x - dx, y);

        if (!canMoveX) {
          dx = -dx;
          x += dx * 2;
        }
        if (!canMoveY) {
          dy = -dy;
          y += dy * 2;
        }

        if (!this.scene.mapManager.isWalkable(x, y)) break;
      }

      path.push({ x, y });
    }

    return path;
  }

  createYinyangOrb(startX, startY, path, index) {
    if (!path || path.length === 0) return;

    const white = this.scene.add.circle(0, 0, 14, 0xffffff);
    const black = this.scene.add.circle(-4, 0, 6, 0x000000);
    const orb = this.scene.add.container(
      startX * TILE_SIZE + TILE_SIZE / 2,
      startY * TILE_SIZE + TILE_SIZE / 2,
      [white, black]
    );

    // 注册以便统一清理
    if (this.scene.spellCardSystem && this.scene.spellCardSystem.activeOrbs) {
      this.scene.spellCardSystem.activeOrbs.push(orb);
    }

    let pathIndex = 0;
    const moveNext = () => {
      if (pathIndex >= path.length) {
        this.scene.tweens.add({
          targets: orb,
          alpha: 0,
          scale: 0.6,
          duration: 200,
          onComplete: () => {
            if (this.scene.spellCardSystem && this.scene.spellCardSystem.activeOrbs) {
              const i = this.scene.spellCardSystem.activeOrbs.indexOf(orb);
              if (i !== -1) this.scene.spellCardSystem.activeOrbs.splice(i, 1);
            }
            try { orb.destroy(true); } catch (e) { try { orb.destroy(); } catch (e) { /* ignore */ } }
          }
        });
        return;
      }

      const target = path[pathIndex];
      this.scene.tweens.add({
        targets: orb,
        x: target.x * TILE_SIZE + TILE_SIZE / 2,
        y: target.y * TILE_SIZE + TILE_SIZE / 2,
        duration: 160,
        ease: 'Linear',
        onComplete: () => {
          this.createHitEffect(target.x, target.y);
          this.applyHitDamage(target.x, target.y);
          pathIndex++;
          moveNext();
        }
      });
    };

    this.scene.time.delayedCall(index * 120, moveNext);
  }

  applyHitDamage(tileX, tileY) {
    if (!this.scene) return;

    // 先尝试伤害敌人（若存在）
    try {
      if (this.scene.getEnemyAt) {
        const enemy = this.scene.getEnemyAt(tileX, tileY);
        if (enemy) {
          const damage = enemy.takeDamage(this.damage);
          this.scene.events.emit('showDamage', {
            x: enemy.sprite.x,
            y: enemy.sprite.y - 20,
            damage: damage,
            isHeal: false
          });

          if (!enemy.isAlive) {
            this.scene.events.emit('showMessage', `${enemy.name} 被符卡击败！`);
            if (this.scene.removeEnemy) this.scene.removeEnemy(enemy);
          }
        }
      }
    } catch (e) {}

    // 无论是否有敌人，都检查此格是否有门并对其造成伤害
    try {
      if (this.scene.getDoorAt) {
        const door = this.scene.getDoorAt(tileX, tileY);
        if (door) {
          const dmd = door.takeDamage(this.damage);
          this.scene.events.emit('showDamage', { x: door.sprite ? door.sprite.x : tileX * TILE_SIZE, y: door.sprite ? door.sprite.y - 8 : tileY * TILE_SIZE, damage: dmd, isHeal: false });
        }
      }
    } catch (e) {}
  }

  createHitEffect(tileX, tileY) {
    const cx = tileX * TILE_SIZE + TILE_SIZE / 2;
    const cy = tileY * TILE_SIZE + TILE_SIZE / 2;
    const effect = this.scene.add.circle(cx, cy, 18, 0xffff66).setAlpha(0.8);

    if (this.scene.spellCardSystem && this.scene.spellCardSystem.activeOrbs) {
      this.scene.spellCardSystem.activeOrbs.push(effect);
    }

    this.scene.tweens.add({
      targets: effect,
      alpha: 0,
      scale: 2.2,
      duration: 180,
      onComplete: () => {
        try { effect.destroy(); } catch (e) { /* ignore */ }
        if (this.scene.spellCardSystem && this.scene.spellCardSystem.activeOrbs) {
          const i = this.scene.spellCardSystem.activeOrbs.indexOf(effect);
          if (i !== -1) this.scene.spellCardSystem.activeOrbs.splice(i, 1);
        }
      }
    });
  }
}

export class Fuumajin extends SpellCard {
  constructor(scene) {
    super(scene, SPELLCARD_CONFIG.fuumajin);
    this.duration = SPELLCARD_CONFIG.fuumajin.duration;
    this.radius = SPELLCARD_CONFIG.fuumajin.radius;
  }

  use(caster, direction) {
    let barrierX = caster.tileX + direction.x * 2;
    let barrierY = caster.tileY + direction.y * 2;
    if (!this.scene.mapManager.isWalkable(barrierX, barrierY)) {
      barrierX = caster.tileX;
      barrierY = caster.tileY;
    }
    this.createBarrier(barrierX, barrierY);
    return { damage: 0, positions: [], piercing: false };
  }

  createBarrier(centerX, centerY) {
    const barrier = this.scene.add.graphics();
    barrier.lineStyle(3, 0xff6b6b, 0.9);
    barrier.strokeCircle(centerX * TILE_SIZE + TILE_SIZE / 2, centerY * TILE_SIZE + TILE_SIZE / 2, this.radius * TILE_SIZE + TILE_SIZE / 2);
    barrier.fillStyle(0xff6b6b, 0.14);
    barrier.fillCircle(centerX * TILE_SIZE + TILE_SIZE / 2, centerY * TILE_SIZE + TILE_SIZE / 2, this.radius * TILE_SIZE + TILE_SIZE / 2);

    const runes = this.scene.add.graphics();
    runes.lineStyle(2, 0xffffff, 0.6);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const runeX = centerX * TILE_SIZE + TILE_SIZE / 2 + Math.cos(angle) * (this.radius * TILE_SIZE);
      const runeY = centerY * TILE_SIZE + TILE_SIZE / 2 + Math.sin(angle) * (this.radius * TILE_SIZE);
      runes.strokeCircle(runeX, runeY, 5);
    }

    // 仅播放初始一次的视觉效果，后续每回合由场景的 processBarriers 触发动画
    this.scene.tweens.add({ targets: runes, angle: 360, duration: 600 });
    this.scene.tweens.add({ targets: barrier, alpha: 0.3, duration: 300, yoyo: true });

    const barrierData = { x: centerX, y: centerY, radius: this.radius, damage: this.damage, duration: this.duration, graphics: barrier, runes };
    // 添加一个循环计时器，用于在非回合操作时也让结界保持视觉脉冲
    try {
      const pulseTimer = this.scene.time.addEvent({
        delay: 600,
        loop: true,
        callback: () => {
          try {
            if (runes) this.scene.tweens.add({ targets: runes, angle: '+=180', duration: 500 });
            if (barrier) this.scene.tweens.add({ targets: barrier, alpha: 0.45, duration: 250, yoyo: true });
          } catch (e) {}
        }
      });
      barrierData.pulseTimer = pulseTimer;
    } catch (e) { /* 如果 time 或 tweens 不可用则忽略 */ }

    if (this.scene.addBarrier) this.scene.addBarrier(barrierData);
  }
}

export class MusouMyouji extends SpellCard {
  constructor(scene) {
    super(scene, SPELLCARD_CONFIG.musouMyouji);
    this.projectileCount = SPELLCARD_CONFIG.musouMyouji.projectileCount;
    this.range = SPELLCARD_CONFIG.musouMyouji.range;
  }

  use(caster) {
    const startX = caster.tileX;
    const startY = caster.tileY;
    const enemies = this.scene.getEnemiesInRange(startX, startY, this.range);
    if (!enemies || enemies.length === 0) {
      this.scene.events.emit('showMessage', '范围内没有敌人！');
      return { damage: 0, positions: [], piercing: false, noTarget: true };
    }

    const hitPositions = [];
    const hitEnemies = [];
    for (let i = 0; i < this.projectileCount; i++) {
      const target = enemies[i % enemies.length];
      hitPositions.push({ x: target.tileX, y: target.tileY });
      if (!hitEnemies.includes(target)) hitEnemies.push(target);
      this.createHomingOrb(startX, startY, target, i);
    }

    return { damage: this.getEffectiveDamage(), positions: hitPositions, piercing: false, isHoming: true, targets: hitEnemies, hitCount: this.projectileCount };
  }

  createHomingOrb(startX, startY, target, index) {
    const colors = [0xff6b6b, 0xffb86b, 0xfff66b, 0x6bff6b, 0x6bffff];
    const color = colors[index % colors.length];
    const orbOuter = this.scene.add.circle(0, 0, 8, color);
    const orbInner = this.scene.add.circle(0, 0, 4, 0xffffff);
    const container = this.scene.add.container(startX * TILE_SIZE + TILE_SIZE / 2, startY * TILE_SIZE + TILE_SIZE / 2, [orbOuter, orbInner]);

    if (this.scene.spellCardSystem && this.scene.spellCardSystem.activeOrbs) {
      this.scene.spellCardSystem.activeOrbs.push(container);
    }

    const angle = (index / this.projectileCount) * Math.PI * 2;
    const offsetX = Math.cos(angle) * 20;
    const offsetY = Math.sin(angle) * 20;
    container.x += offsetX;
    container.y += offsetY;

    this.scene.time.delayedCall(50 + index * 60, () => {
      this.scene.tweens.add({
        targets: container,
        y: container.y - 20,
        duration: 120,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: container,
            x: target.tileX * TILE_SIZE + TILE_SIZE / 2,
            y: target.tileY * TILE_SIZE + TILE_SIZE / 2,
            duration: 160,
            ease: 'Quad.easeIn',
            onComplete: () => {
              this.createImpactEffect(target.tileX, target.tileY, color);
              if (this.scene.spellCardSystem && this.scene.spellCardSystem.activeOrbs) {
                const i = this.scene.spellCardSystem.activeOrbs.indexOf(container);
                if (i !== -1) this.scene.spellCardSystem.activeOrbs.splice(i, 1);
              }
              try { container.destroy(true); } catch (e) { try { container.destroy(); } catch (e) { /* ignore */ } }
            }
          });
        }
      });
    });
  }

  createImpactEffect(tileX, tileY, color) {
    const impact = this.scene.add.circle(tileX * TILE_SIZE + TILE_SIZE / 2, tileY * TILE_SIZE + TILE_SIZE / 2, 12, color).setAlpha(0.9);
    if (this.scene.spellCardSystem && this.scene.spellCardSystem.activeOrbs) this.scene.spellCardSystem.activeOrbs.push(impact);
    this.scene.tweens.add({ targets: impact, alpha: 0, scale: 2, duration: 120, onComplete: () => { try { impact.destroy(); } catch (e) { /* ignore */ } if (this.scene.spellCardSystem && this.scene.spellCardSystem.activeOrbs) { const i = this.scene.spellCardSystem.activeOrbs.indexOf(impact); if (i !== -1) this.scene.spellCardSystem.activeOrbs.splice(i, 1); } } });
  }
}

export default class SpellCardSystem {
  constructor(scene) {
    this.scene = scene;
    this.spellCards = [];
    this.activeOrbs = [];
  }

  initialize() {
    this.spellCards = [
      new MeigyokuAnki(this.scene),
      new Fuumajin(this.scene),
      new MusouMyouji(this.scene)
    ];

    if (this.scene) this.scene.spellCardSystem = this;
    if (this.scene && this.scene.events) {
      this.scene.events.on('shutdown', () => this.destroyAllOrbs());
      this.scene.events.on('destroy', () => this.destroyAllOrbs());
    }
  }

  getSpellCard(index) {
    return this.spellCards[index];
  }

  /**
   * 减少所有符卡冷却（基于时间流逝）
   * @param {number} deltaMs - 经过的毫秒数
   */
  reduceCooldowns(deltaMs = 1000) {
    for (const spell of this.spellCards) spell.reduceCooldown(deltaMs);
  }

  getStatus() {
    return this.spellCards.map(spell => ({
      name: spell.name,
      mpCost: spell.mpCost,
      cooldown: Math.ceil(spell.currentCooldown / 1000), // 显示秒数
      maxCooldown: Math.ceil(spell.getEffectiveCooldown() / 1000),
      cooldownProgress: spell.getCooldownProgress()
    }));
  }

  destroyAllOrbs() {
    for (const obj of this.activeOrbs.slice()) {
      try { if (obj && obj.destroy) obj.destroy(true); } catch (e) { try { obj.destroy(); } catch (e) { /* ignore */ } }
    }
    this.activeOrbs.length = 0;
  }
}
