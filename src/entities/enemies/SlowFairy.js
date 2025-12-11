/**
 * 慢速妖精
 * 速度为灵梦的一半
 */
import Enemy from '../Enemy.js';
import { ENEMY_CONFIG, TILE_SIZE } from '../../config/gameConfig.js';
import { TileType } from '../../systems/MapGenerator.js';

export default class SlowFairy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'slowFairy', {
      name: ENEMY_CONFIG.slowFairy.name,
      hp: ENEMY_CONFIG.slowFairy.hp,
      attack: ENEMY_CONFIG.slowFairy.attack,
      defense: ENEMY_CONFIG.slowFairy.defense,
      speed: ENEMY_CONFIG.slowFairy.speed,
      expReward: ENEMY_CONFIG.slowFairy.expReward,
      detectionRange: 6,
      attackRange: 1
    });

    // 专用激光属性
    this.laserRange = 5; // 检测/开始瞄准的范围（格数）
    this.laserLength = 6; // 激光固定长度（格数）
    this.laserDamage = 14;
    this.isAiming = false;
    this.aimDirX = 0; // 瞄准时记录方向单位向量（-1/0/1）
    this.aimDirY = 0;
    this.aimGraphics = null;
  }

  // Bresenham 直线格子生成器
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

  // 在本回合瞄准（显示红色半透明线），下一回合将触发激光
  async act(player) {
    if (!this.isAlive || !player.isAlive) return;

    const distance = this.getDistanceTo(player);

    // 若上一回合已瞄准，则本回合发射激光（固定长度，按记录方向）
    if (this.isAiming) {
      await this.fireLaserInDirection(this.aimDirX, this.aimDirY, player);
      this.isAiming = false;
      this.clearAimGraphics();
      return;
    }

    // 如果玩家进入激光射程，停下并瞄准（消耗本回合），显示红色半透明瞄准线
    if (distance <= this.laserRange) {
      // 记录朝向单位向量，作为固定激光方向
      const dir = this.getDirectionTo(player);
      this.aimDirX = dir.x;
      this.aimDirY = dir.y;
      // 若方向为 (0,0)，则朝向玩家的相对位置进行选择（默认向上）
      if (this.aimDirX === 0 && this.aimDirY === 0) {
        this.aimDirY = -1;
      }

      this.isAiming = true;
      this.showAimGraphicsDirection(this.aimDirX, this.aimDirY);

      // 给瞄准一个短暂的视觉停顿（消耗这一回合）
      await new Promise(resolve => {
        this.scene.time.delayedCall(200, resolve);
      });
      return;
    }

    // 否则使用默认行为（追逐/攻击/闲置）
    await super.act(player);
  }

  showAimGraphicsDirection(dirX, dirY) {
    this.clearAimGraphics();
    try {
      const g = this.scene.add.graphics();
      const startX = this.sprite.x;
      const startY = this.sprite.y;
      const endTileX = this.tileX + dirX * this.laserLength;
      const endTileY = this.tileY + dirY * this.laserLength;
      const endX = endTileX * TILE_SIZE + TILE_SIZE / 2;
      const endY = endTileY * TILE_SIZE + TILE_SIZE / 2;
      // 半透明红线表示瞄准
      g.lineStyle(4, 0xff4444, 0.35);
      g.beginPath();
      g.moveTo(startX, startY);
      g.lineTo(endX, endY);
      g.strokePath();
      g.setDepth(20);
      this.aimGraphics = g;
    } catch (e) {
      this.aimGraphics = null;
    }
  }

  clearAimGraphics() {
    if (this.aimGraphics) {
      try { this.aimGraphics.destroy(); } catch (e) {}
      this.aimGraphics = null;
    }
  }

  async fireLaserInDirection(dirX, dirY, player) {
    // 计算固定长度终点（以格为单位）并取到路径点，遇到墙停止
    const startTileX = this.tileX;
    const startTileY = this.tileY;
    const endTileX = startTileX + dirX * this.laserLength;
    const endTileY = startTileY + dirY * this.laserLength;

    const path = [];
    for (const [x, y] of this.bresenham(startTileX, startTileY, endTileX, endTileY)) {
      path.push([x, y]);
      // 如果遇到墙则包括该墙格并停止
      try {
        const tile = this.scene.mapManager.getTileAt(x, y);
        if (tile === TileType.WALL) break;
      } catch (e) { /* ignore */ }
    }

    // 视觉：绘制外层宽线和内层亮线增强感
    const sX = this.sprite.x;
    const sY = this.sprite.y;
    const last = path[path.length - 1] || [startTileX, startTileY];
    const eX = last[0] * TILE_SIZE + TILE_SIZE / 2;
    const eY = last[1] * TILE_SIZE + TILE_SIZE / 2;

    const outer = this.scene.add.graphics();
    outer.lineStyle(8, 0xff6600, 0.45);
    outer.beginPath(); outer.moveTo(sX, sY); outer.lineTo(eX, eY); outer.strokePath(); outer.setDepth(22);
    const inner = this.scene.add.graphics();
    inner.lineStyle(4, 0xffff88, 0.95);
    inner.beginPath(); inner.moveTo(sX, sY); inner.lineTo(eX, eY); inner.strokePath(); inner.setDepth(23);

    // 在激光路径上添加顺序光效（沿路径依次闪烁），增强流动感
    try {
      for (let i = 0; i < path.length; i++) {
        const [px, py] = path[i];
        const cx = px * TILE_SIZE + TILE_SIZE / 2;
        const cy = py * TILE_SIZE + TILE_SIZE / 2;
        // 延迟执行以形成沿线移动的视觉
        this.scene.time.delayedCall(i * 40, () => {
          try {
            // 使用长方形光柱并根据方向旋转，使光效沿激光方向对齐
            const dirX = this.aimDirX || 0;
            const dirY = this.aimDirY || 0;
            // 基本长度和厚度（按 TILE_SIZE 计算），长度会在动画中略微拉伸
            const baseLength = Math.max(Math.floor(TILE_SIZE * 0.9), 18);
            const baseThickness = Math.max(Math.floor(TILE_SIZE * 0.45), 10);

            // 创建矩形，初始为沿本地 X 轴的长条，随后旋转到目标角度
            const rect = this.scene.add.rectangle(cx, cy, baseLength, baseThickness, 0xffdd88, 0.95);
            const angle = Math.atan2(dirY, dirX);
            rect.setRotation(angle);
            rect.setBlendMode(Phaser.BlendModes.ADD);
            rect.setDepth(21);

            // 更显眼的拉伸+淡出动画：沿本地 X 轴（光柱方向）放大
            this.scene.tweens.add({
              targets: rect,
              scaleX: { from: 1, to: 1.6 },
              scaleY: { from: 1, to: 1.25 },
              alpha: { from: 0.95, to: 0 },
              duration: 360,
              ease: 'Cubic.easeOut',
              onComplete: () => { try { rect.destroy(); } catch (e) {} }
            });
          } catch (e) {}
        });
      }
    } catch (e) {}

    // 激光命中粒子/冲击效果记录
    const impacts = [];

    // 造成伤害：对路径上所有实体生效，遇到墙触发冲击并停止进一步伤害
    for (const [x, y] of path) {
      // 跳过自身所在格子，避免自伤
      if (x === this.tileX && y === this.tileY) continue;
      // 检查敌人
      const enemy = (this.scene && this.scene.getEnemyAt) ? this.scene.getEnemyAt(x, y) : null;
      if (enemy && enemy.isAlive) {
        const dmg = enemy.takeDamage(this.laserDamage);
        impacts.push({ x, y });
        this.scene.events.emit('showDamage', { x: enemy.sprite.x, y: enemy.sprite.y - 20, damage: dmg, isHeal: false });
      }

      // 检查玩家
      if (player && player.tileX === x && player.tileY === y && player.isAlive) {
        const dmg = player.takeDamage(this.laserDamage);
        impacts.push({ x, y });
        this.scene.events.emit('showDamage', { x: player.sprite.x, y: player.sprite.y - 20, damage: dmg, isHeal: false });
      }

      // 检查墙体并触发冲击效果
      try {
        const tile = this.scene.mapManager.getTileAt(x, y);
        if (tile === TileType.WALL) {
          impacts.push({ x, y, wall: true });
          break;
        }
      } catch (e) {}
    }

    // 展示冲击效果并在短时间后清理线条
    for (const imp of impacts) {
      try {
        const cx = imp.x * TILE_SIZE + TILE_SIZE / 2;
        const cy = imp.y * TILE_SIZE + TILE_SIZE / 2;
        const pg = this.scene.add.graphics();
        pg.fillStyle(0xffcc44, 1);
        pg.fillCircle(cx, cy, 6);
        pg.setDepth(24);
        this.scene.tweens.add({ targets: pg, alpha: 0, duration: 420, onComplete: () => { try { pg.destroy(); } catch (e) {} } });
        // 光效：用发光圈和中心白光替代粒子，使用 ADD 混合并淡出
        try {
          const glowRadius = 18;
          const glow = this.scene.add.circle(cx, cy, glowRadius, 0xffcc66, 0.55);
          glow.setBlendMode(Phaser.BlendModes.ADD);
          glow.setDepth(25);

          const flash = this.scene.add.circle(cx, cy, 6, 0xffffff, 0.95);
          flash.setBlendMode(Phaser.BlendModes.ADD);
          flash.setDepth(26);

          // 放大并淡出
          this.scene.tweens.add({
            targets: glow,
            scale: { from: 1, to: 1.8 },
            alpha: { from: 0.55, to: 0 },
            duration: 480,
            ease: 'Cubic.easeOut',
            onComplete: () => { try { glow.destroy(); } catch (e) {} }
          });

          this.scene.tweens.add({
            targets: flash,
            scale: { from: 1, to: 2.4 },
            alpha: { from: 0.95, to: 0 },
            duration: 360,
            ease: 'Cubic.easeOut',
            onComplete: () => { try { flash.destroy(); } catch (e) {} }
          });
        } catch (e) {}
      } catch (e) {}
    }

    await new Promise(resolve => {
      this.scene.time.delayedCall(260, () => {
        try { outer.destroy(); } catch (e) {}
        try { inner.destroy(); } catch (e) {}
        resolve();
      });
    });
  }
}
