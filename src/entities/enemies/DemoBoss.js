import Enemy from '../Enemy.js';
import SmallCrystal from './SmallCrystal.js';
import { TILE_SIZE } from '../../config/gameConfig.js';
import { TileType } from '../../systems/MapGenerator.js';

export default class DemoBoss extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'demoCrystal', {
      name: '水晶核心',
      hp: 240,
      attack: 0,
      defense: 2,
      speed: 80,
      detectionRange: 99,
      attackRange: 0
    });

    this.burstCd = 0; // 反弹弹幕
    this.summonCd = 6; // 召唤小晶体，较长冷却
    this.maxSmall = 8;
    this.burstDamage = 12;
    this.fanDamage = 10;
    this.burstRange = 8;
  }

  async act(player) {
    if (!this.isAlive || !player.isAlive) return;

    // 玩家未进入 Boss 房前不行动（等待激活）
    if (!this.scene.bossRoomLocked) {
      return;
    }

    // 优先召唤（若小晶体不足且 summonCd 到）
    const existing = this.scene.enemies.filter(e => e && e.isSmallCrystal);
    if (this.summonCd <= 0 && existing.length < this.maxSmall) {
      await this.summonSmallCrystals();
      this.summonCd = 6 + Math.floor(Math.random() * 3);
      this.burstCd = Math.max(0, this.burstCd - 1);
      return;
    }

    // 否则使用弹幕攻击
    if (this.burstCd <= 0) {
      await this.fireBurstAtPlayer(player);
      this.burstCd = 3; // 短 CD
      this.summonCd = Math.max(0, this.summonCd - 1);
      return;
    }

    // 所有技能都在冷却中：递减冷却，空闲一回合（不移动）
    this.burstCd = Math.max(0, this.burstCd - 1);
    this.summonCd = Math.max(0, this.summonCd - 1);
    // 短暂停顿以表示回合已消耗
    await new Promise(resolve => this.scene.time.delayedCall(80, resolve));
  }

  async summonSmallCrystals() {
    // 在 boss 房内随机位置召唤两个小晶体（若空间足够）
    const positions = [];
    const room = this.room;
    if (!room) return;
    for (let i = 0; i < 6 && positions.length < 2; i++) {
      const rx = this.scene.mapManager.randomRange(room.x + 1, room.x + room.width - 2);
      const ry = this.scene.mapManager.randomRange(room.y + 1, room.y + room.height - 2);
      if (!this.scene.mapManager.isWalkable(rx, ry)) continue;
      if (this.scene.getEnemyAt(rx, ry)) continue;
      if (this.scene.player && this.scene.player.tileX === rx && this.scene.player.tileY === ry) continue;
      positions.push({ x: rx, y: ry });
    }

    for (const p of positions) {
      const sc = new SmallCrystal(this.scene, p.x, p.y);
      try { sc.room = this.room; } catch (e) {}
      this.scene.enemies.push(sc);
      if (this.scene.actionQueue) this.scene.actionQueue.addEntity(sc);
      sc.sprite.setDepth(10);
    }

    // 召唤视觉
    try {
      const g = this.scene.add.graphics();
      g.fillStyle(0x88ddff, 0.16);
      const cx = this.tileX * TILE_SIZE + TILE_SIZE / 2;
      const cy = this.tileY * TILE_SIZE + TILE_SIZE / 2;
      g.fillCircle(cx, cy, Math.max(40, Math.min(120, Math.max(this.room.width, this.room.height) * TILE_SIZE / 2)));
      g.setDepth(40);
      this.scene.tweens.add({ targets: g, alpha: { from: 0.9, to: 0 }, duration: 800, onComplete: () => { try { g.destroy(); } catch (e) {} } });
    } catch (e) {}
  }

  async fireBurstAtPlayer(player) {
    // 从 boss 中心向八个方向发射投射物，其中随机一颗是反弹弹
    const dirs = [ {x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},{x:1,y:1},{x:-1,y:-1},{x:1,y:-1},{x:-1,y:1} ];
    const bounceIdx = Math.floor(Math.random() * dirs.length);
    const promises = dirs.map((d, i) => this.fireProjectileAlong(d.x, d.y, i === bounceIdx));
    await Promise.all(promises);
  }

  async fireProjectileAlong(dx, dy, isBounce = false) {
    const path = [];
    let x = this.tileX; let y = this.tileY;
    let hitEntity = false;
    for (let i = 0; i < this.burstRange; i++) {
      x += dx; y += dy;
      if (!this.scene.mapManager.isWalkable(x, y)) {
        // 只有反弹弹撞墙时才触发扇形反射
        if (isBounce) this.spawnFanAt(x, y, dx, dy);
        break;
      }
      path.push({ x, y });
      // 反弹弹碰到实体也会触发反射
      if (isBounce) {
        const hasPlayer = this.scene.player && this.scene.player.tileX === x && this.scene.player.tileY === y;
        const hasEnemy = this.scene.getEnemyAt(x, y) && this.scene.getEnemyAt(x, y) !== this;
        const hasDoor = this.scene.getDoorAt && this.scene.getDoorAt(x, y);
        if (hasPlayer || hasEnemy || hasDoor) {
          hitEntity = true;
        }
      }
    }

    // 依次移动视觉弹幕并在经过格子时造成伤害
    let triggeredFan = false;
    for (let i = 0; i < path.length; i++) {
      const t = path[i];
      // 视觉：小圆点（反弹弹用粉色，普通弹用蓝色）
      try {
        const color = isBounce ? 0xff66cc : 0x66ccff;
        const dot = this.scene.add.circle(t.x * TILE_SIZE + TILE_SIZE / 2, t.y * TILE_SIZE + TILE_SIZE / 2, isBounce ? 8 : 6, color);
        dot.setDepth(35);
        if (isBounce) {
          // 反弹弹有发光效果
          const glow = this.scene.add.circle(t.x * TILE_SIZE + TILE_SIZE / 2, t.y * TILE_SIZE + TILE_SIZE / 2, 14, 0xff88dd, 0.3);
          glow.setDepth(34);
          this.scene.tweens.add({ targets: glow, alpha: 0, scale: 1.5, duration: 200, delay: i * 40, onComplete: () => { try { glow.destroy(); } catch (e) {} } });
        }
        this.scene.tweens.add({ targets: dot, alpha: { from: 1, to: 0 }, duration: 280, delay: i * 40, onComplete: () => { try { dot.destroy(); } catch (e) {} } });
      } catch (e) {}

      // 造成伤害：玩家或敌人或门
      let hitSomething = false;
      try {
        if (this.scene.player && this.scene.player.tileX === t.x && this.scene.player.tileY === t.y) {
          const dmg = this.scene.player.takeDamage(this.burstDamage);
          this.scene.events.emit('showDamage', { x: this.scene.player.sprite.x, y: this.scene.player.sprite.y - 20, damage: dmg, isHeal: false });
          hitSomething = true;
        }
        const enemy = this.scene.getEnemyAt(t.x, t.y);
        if (enemy && enemy !== this) { const d = enemy.takeDamage(this.burstDamage); this.scene.events.emit('showDamage', { x: enemy.sprite.x, y: enemy.sprite.y - 20, damage: d, isHeal: false }); if (!enemy.isAlive) this.scene.removeEnemy(enemy); hitSomething = true; }
        if (this.scene.getDoorAt) {
          const door = this.scene.getDoorAt(t.x, t.y);
          if (door) { const dd = door.takeDamage(this.burstDamage); this.scene.events.emit('showDamage', { x: door.sprite ? door.sprite.x : t.x * TILE_SIZE, y: door.sprite ? door.sprite.y - 8 : t.y * TILE_SIZE, damage: dd, isHeal: false }); hitSomething = true; }
        }
      } catch (e) {}

      // 反弹弹碰到实体后触发扇形反射并停止
      if (isBounce && hitSomething && !triggeredFan) {
        triggeredFan = true;
        this.spawnFanAt(t.x, t.y, dx, dy);
        break;
      }

      // 延迟以模拟弹幕推进
      await new Promise(resolve => this.scene.time.delayedCall(40, resolve));
    }
  }

  spawnFanAt(x, y, inDx, inDy) {
    // 反弹：从撞击点向**反方向**发射三条扇形子弹
    // 反方向 = -inDx, -inDy
    const spread = [];
    const outDx = -inDx;
    const outDy = -inDy;

    if (outDx === 0 || outDy === 0) {
      // 正交方向反弹 -> 主方向 + 左右偏移
      if (outDx !== 0) {
        spread.push({ x: outDx, y: 0 });
        spread.push({ x: outDx, y: -1 });
        spread.push({ x: outDx, y: 1 });
      } else {
        spread.push({ x: 0, y: outDy });
        spread.push({ x: -1, y: outDy });
        spread.push({ x: 1, y: outDy });
      }
    } else {
      // 斜向反弹 -> 三个方向组合
      spread.push({ x: outDx, y: outDy });
      spread.push({ x: outDx, y: 0 });
      spread.push({ x: 0, y: outDy });
    }

    // 从撞击点的前一格（可通行格）开始发射
    const startX = x - inDx;
    const startY = y - inDy;

    for (const s of spread) {
      this.fireSmallStraight(s.x, s.y, startX, startY);
    }
  }

  async fireSmallStraight(dx, dy, sx, sy) {
    let x = sx, y = sy;
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      x += dx; y += dy;
      if (!this.scene.mapManager.isWalkable(x, y)) break;
      try {
        const dot = this.scene.add.circle(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 6, 0xffcc88);
        dot.setDepth(36);
        this.scene.tweens.add({ targets: dot, alpha: { from: 1, to: 0 }, duration: 260, delay: i * 60, onComplete: () => { try { dot.destroy(); } catch (e) {} } });
      } catch (e) {}

      try {
        if (this.scene.player && this.scene.player.tileX === x && this.scene.player.tileY === y) {
          const dmg = this.scene.player.takeDamage(this.fanDamage);
          this.scene.events.emit('showDamage', { x: this.scene.player.sprite.x, y: this.scene.player.sprite.y - 20, damage: dmg, isHeal: false });
        }
        const enemy = this.scene.getEnemyAt(x, y);
        if (enemy && enemy !== this) { const d = enemy.takeDamage(this.fanDamage); this.scene.events.emit('showDamage', { x: enemy.sprite.x, y: enemy.sprite.y - 20, damage: d, isHeal: false }); if (!enemy.isAlive) this.scene.removeEnemy(enemy); }
        if (this.scene.getDoorAt) {
          const door = this.scene.getDoorAt(x, y);
          if (door) { const dd = door.takeDamage(this.fanDamage); this.scene.events.emit('showDamage', { x: door.sprite ? door.sprite.x : x * TILE_SIZE, y: door.sprite ? door.sprite.y - 8 : y * TILE_SIZE, damage: dd, isHeal: false }); }
        }
      } catch (e) {}

      await new Promise(resolve => this.scene.time.delayedCall(60, resolve));
    }
  }

  // 覆盖死亡：触发 boss 被击败事件
  die() {
    try { super.die(); } catch (e) {}
    try {
      if (this.scene && this.scene.onBossDefeated) this.scene.onBossDefeated(this);
    } catch (e) {}
  }
}
