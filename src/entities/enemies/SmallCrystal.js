import Enemy from '../Enemy.js';
import { ENEMY_CONFIG, TILE_SIZE } from '../../config/gameConfig.js';
import { TileType } from '../../systems/MapGenerator.js';

export default class SmallCrystal extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'smallCrystal', {
      name: (ENEMY_CONFIG.smallCrystal && ENEMY_CONFIG.smallCrystal.name) || '小晶体',
      hp: (ENEMY_CONFIG.smallCrystal && ENEMY_CONFIG.smallCrystal.hp) || 18,
      attack: (ENEMY_CONFIG.smallCrystal && ENEMY_CONFIG.smallCrystal.attack) || 10,
      defense: (ENEMY_CONFIG.smallCrystal && ENEMY_CONFIG.smallCrystal.defense) || 0,
      speed: (ENEMY_CONFIG.smallCrystal && ENEMY_CONFIG.smallCrystal.speed) || 60,
      detectionRange: 6,
      attackRange: 1
    });

    this.isSmallCrystal = true; // 用于 DemoBoss 召唤计数
    this.laserRange = 6;
    this.laserLength = 6;
    this.laserDamage = (ENEMY_CONFIG.smallCrystal && ENEMY_CONFIG.smallCrystal.laserDamage) || 10;
    this.isAiming = false;
    this.aimDirs = []; // [{x,y}, ...] 可以保存两个方向
    this.aimGraphics = [];
  }

  // 复用 SlowFairy 的 Bresenham 生成器（简单实现）
  *bresenham(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = (x0 < x1) ? 1 : -1;
    let sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;
    let x = x0, y = y0;
    while (true) {
      yield [x, y];
      if (x === x1 && y === y1) break;
      let e2 = err * 2;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  async act(player) {
    if (!this.isAlive || !player.isAlive) return;

    const distance = this.getDistanceTo(player);

    if (this.isAiming) {
      // 发射两条激光
      for (const d of this.aimDirs) {
        await this.fireLaserInDirection(d.x, d.y, player);
      }
      this.isAiming = false;
      for (const g of this.aimGraphics) try { g.destroy(); } catch (e) {}
      this.aimGraphics = [];
      return;
    }

    // 如果玩家进入瞄准范围，则同时瞄准两个不同方向（主向量 + 随机不同方向）
    if (distance <= this.laserRange) {
      // 主方向指向玩家
      const dir = this.getDirectionTo(player);
      let dir2 = { x: 0, y: -1 };
      // 选择一个不同的方向作为第二目标（优先选择与主方向不重合）
      const options = [ {x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},{x:1,y:1},{x:-1,y:-1},{x:1,y:-1},{x:-1,y:1} ];
      for (let i = 0; i < options.length; i++) {
        const cand = options[Math.floor(Math.random() * options.length)];
        if (cand.x !== dir.x || cand.y !== dir.y) { dir2 = cand; break; }
      }

      this.aimDirs = [dir, dir2];
      this.isAiming = true;
      // 显示瞄准线
      for (const d of this.aimDirs) this.showAimGraphicsDirection(d.x, d.y);

      // 消耗一回合作为瞄准
      await new Promise(resolve => this.scene.time.delayedCall(160, resolve));
      return;
    }

    await super.act(player);
  }

  showAimGraphicsDirection(dirX, dirY) {
    try {
      const g = this.scene.add.graphics();
      const startX = this.sprite.x;
      const startY = this.sprite.y;
      const endTileX = this.tileX + dirX * this.laserLength;
      const endTileY = this.tileY + dirY * this.laserLength;
      const endX = endTileX * TILE_SIZE + TILE_SIZE / 2;
      const endY = endTileY * TILE_SIZE + TILE_SIZE / 2;
      g.lineStyle(3, 0xff6666, 0.32);
      g.beginPath();
      g.moveTo(startX, startY);
      g.lineTo(endX, endY);
      g.strokePath();
      g.setDepth(20);
      this.aimGraphics.push(g);
    } catch (e) { }
  }

  async fireLaserInDirection(dirX, dirY, player) {
    // 基本复用 SlowFairy 的激光逻辑，但简化版
    const startTileX = this.tileX;
    const startTileY = this.tileY;
    const endTileX = startTileX + dirX * this.laserLength;
    const endTileY = startTileY + dirY * this.laserLength;

    const path = [];
    for (const [x, y] of this.bresenham(startTileX, startTileY, endTileX, endTileY)) {
      path.push([x, y]);
      try { if (this.scene.mapManager.getTileAt(x, y) === TileType.WALL) break; } catch (e) {}
    }

    const sX = this.sprite.x; const sY = this.sprite.y;
    const last = path[path.length - 1] || [startTileX, startTileY];
    const eX = last[0] * TILE_SIZE + TILE_SIZE / 2; const eY = last[1] * TILE_SIZE + TILE_SIZE / 2;

    // 外层发光（大且半透明）
    const glow = this.scene.add.graphics(); glow.lineStyle(12, 0xff6600, 0.25); glow.beginPath(); glow.moveTo(sX, sY); glow.lineTo(eX, eY); glow.strokePath(); glow.setDepth(21);
    const outer = this.scene.add.graphics(); outer.lineStyle(6, 0xffaa55, 0.6); outer.beginPath(); outer.moveTo(sX, sY); outer.lineTo(eX, eY); outer.strokePath(); outer.setDepth(22);
    const inner = this.scene.add.graphics(); inner.lineStyle(3, 0xffffcc, 0.95); inner.beginPath(); inner.moveTo(sX, sY); inner.lineTo(eX, eY); inner.strokePath(); inner.setDepth(23);

    // 沿路径添加闪烁光点
    for (let i = 1; i < path.length; i++) {
      const [px, py] = path[i];
      const cx = px * TILE_SIZE + TILE_SIZE / 2;
      const cy = py * TILE_SIZE + TILE_SIZE / 2;
      this.scene.time.delayedCall(i * 30, () => {
        try {
          const spark = this.scene.add.circle(cx, cy, 5, 0xffff88, 0.9);
          spark.setBlendMode(Phaser.BlendModes.ADD);
          spark.setDepth(24);
          this.scene.tweens.add({ targets: spark, scale: { from: 1, to: 2 }, alpha: { from: 0.9, to: 0 }, duration: 200, onComplete: () => { try { spark.destroy(); } catch (e) {} } });
        } catch (e) {}
      });
    }

    // 造成伤害
    for (const [x, y] of path) {
      if (x === this.tileX && y === this.tileY) continue;
      try {
        const playerHit = (player && player.tileX === x && player.tileY === y && player.isAlive);
        if (playerHit) { const dmg = player.takeDamage(this.laserDamage); this.scene.events.emit('showDamage', { x: player.sprite.x, y: player.sprite.y - 20, damage: dmg, isHeal: false }); }
        const enemy = this.scene.getEnemyAt(x, y);
        if (enemy && enemy !== this) { const d = enemy.takeDamage(this.laserDamage); this.scene.events.emit('showDamage', { x: enemy.sprite.x, y: enemy.sprite.y - 20, damage: d, isHeal: false }); if (!enemy.isAlive) this.scene.removeEnemy(enemy); }
        if (this.scene.getDoorAt) {
          const door = this.scene.getDoorAt(x, y);
          if (door) { const dd = door.takeDamage(this.laserDamage); this.scene.events.emit('showDamage', { x: door.sprite ? door.sprite.x : x * TILE_SIZE, y: door.sprite ? door.sprite.y - 8 : y * TILE_SIZE, damage: dd, isHeal: false }); break; }
        }
      } catch (e) {}
    }

    this.scene.time.delayedCall(260, () => { try { glow.destroy(); } catch (e) {} try { outer.destroy(); } catch (e) {} try { inner.destroy(); } catch (e) {} });
  }

  die() {
    // 确保标记为死亡
    this.isAlive = false;
    this.isAiming = false;
    
    // 清理瞄准图形
    for (const g of this.aimGraphics) {
      try { g.destroy(); } catch (e) {}
    }
    this.aimGraphics = [];
    
    // 确保精灵被销毁
    try {
      if (this.sprite) {
        this.sprite.setVisible(false);
        this.sprite.setActive(false);
      }
    } catch (e) {}
    
    // 从敌人列表中移除自己
    try {
      if (this.scene && this.scene.removeEnemy) {
        this.scene.removeEnemy(this);
      }
    } catch (e) {}
    
    try { super.die(); } catch (e) {}
  }
}