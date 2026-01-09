import Enemy from '../Enemy.js';
import SmallCrystal from './SmallCrystal.js';
import { TILE_SIZE } from '../../config/gameConfig.js';

export default class DemoBoss extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'demoCrystal', {
      name: '水晶核心',
      hp: 300,
      attack: 0,
      defense: 3,
      speed: 80,
      detectionRange: 99,
      attackRange: 0
    });

    // 标记为Boss
    this.isBoss = true;

    // 技能冷却
    this.burstCd = 0;      // 弹幕射击
    this.summonCd = 5;     // 召唤小晶体
    this.laserCd = 0;      // 激光扫射（阶段2解锁）
    this.bombardCd = 0;    // 地面轰炸（阶段3解锁）
    
    // 技能参数
    this.maxSmall = 6;
    this.burstDamage = 12;
    this.burstRange = 8;
    this.laserDamage = 18;
    this.bombardDamage = 25;
    
    // 阶段系统
    this.phase = 1;
    this.phaseTransitioning = false;
    
    // 护盾系统（阶段2）
    this.shieldActive = false;
    this.shieldDuration = 0;
    this.shieldCooldown = 0;
    
    // 地面标记（阶段3轰炸用）
    this.pendingBombs = []; // { x, y, turnsLeft }
  }

  wait(ms) {
    return new Promise(resolve => this.scene.time.delayedCall(ms, resolve));
  }

  getAxisDirectionTo(player) {
    const dx = player.tileX - this.tileX;
    const dy = player.tileY - this.tileY;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { x: dx >= 0 ? 1 : -1, y: 0 };
    }
    return { x: 0, y: dy >= 0 ? 1 : -1 };
  }

  traceLaserPath(dirX, dirY, maxSteps = 14) {
    const path = [];
    let x = this.tileX;
    let y = this.tileY;
    for (let i = 0; i < maxSteps; i++) {
      x += dirX;
      y += dirY;
      if (!this.scene.mapManager.isWalkable(x, y)) break;
      const door = this.scene.getDoorAt ? this.scene.getDoorAt(x, y) : null;
      path.push({ x, y });
      if (door && !door.isOpen) break;
    }
    return path;
  }

  /**
   * 获取当前阶段（根据血量）
   */
  getCurrentPhase() {
    const hpPercent = this.hp / this.maxHp;
    if (hpPercent > 0.6) return 1;
    if (hpPercent > 0.3) return 2;
    return 3;
  }

  /**
   * 检查并处理阶段转换
   */
  async checkPhaseTransition() {
    const newPhase = this.getCurrentPhase();
    if (newPhase > this.phase) {
      this.phaseTransitioning = true;
      this.phase = newPhase;
      
      // 阶段转换特效
      await this.phaseTransitionEffect();
      
      // 通知 UI 更新阶段显示
      this.scene.events.emit('bossPhaseChange', { phase: newPhase, shieldActive: this.shieldActive });
      
      // 阶段2：开启护盾机制
      if (newPhase === 2) {
        this.scene.events.emit('showMessage', '水晶核心进入第二阶段！能量护盾启动！');
        this.activateShield();
      }
      // 阶段3：狂暴模式
      else if (newPhase === 3) {
        this.scene.events.emit('showMessage', '水晶核心进入狂暴模式！开始地面轰炸！');
        // 减少所有技能冷却
        this.burstCd = 0;
        this.summonCd = 0;
      }
      
      this.phaseTransitioning = false;
    }
  }

  /**
   * 阶段转换特效：释放冲击波
   */
  async phaseTransitionEffect() {
    const cx = this.tileX * TILE_SIZE + TILE_SIZE / 2;
    const cy = this.tileY * TILE_SIZE + TILE_SIZE / 2;
    
    // 闪烁效果
    for (let i = 0; i < 3; i++) {
      this.sprite.setTint(0xffffff);
      await new Promise(r => this.scene.time.delayedCall(100, r));
      this.sprite.clearTint();
      await new Promise(r => this.scene.time.delayedCall(100, r));
    }
    
    // 冲击波
    const wave = this.scene.add.circle(cx, cy, 20, 0x66ccff, 0.6);
    wave.setDepth(50);
    this.scene.tweens.add({
      targets: wave,
      radius: 150,
      alpha: 0,
      duration: 500,
      onComplete: () => wave.destroy()
    });
    
    // 对范围内玩家造成伤害
    const dist = Math.abs(this.scene.player.tileX - this.tileX) + Math.abs(this.scene.player.tileY - this.tileY);
    if (dist <= 4) {
      const dmg = this.scene.player.takeDamage(10);
      this.scene.events.emit('showDamage', {
        x: this.scene.player.sprite.x,
        y: this.scene.player.sprite.y - 20,
        damage: dmg,
        isHeal: false
      });
      this.scene.events.emit('showMessage', '被冲击波击中！');
    }
    
    await new Promise(r => this.scene.time.delayedCall(300, r));
  }

  /**
   * 激活护盾
   */
  activateShield() {
    this.shieldActive = true;
    this.shieldDuration = 3;
    this.shieldCooldown = 6;
    
    // 通知 UI 更新
    this.scene.events.emit('bossPhaseChange', { phase: this.phase, shieldActive: true });
    
    // 护盾视觉
    this.shieldGraphic = this.scene.add.circle(
      this.sprite.x, this.sprite.y, 24, 0x66ffff, 0.3
    );
    this.shieldGraphic.setStrokeStyle(2, 0x00ffff);
    this.shieldGraphic.setDepth(this.sprite.depth + 1);
    
    // 护盾脉冲动画
    this.scene.tweens.add({
      targets: this.shieldGraphic,
      scale: { from: 1, to: 1.2 },
      alpha: { from: 0.3, to: 0.5 },
      duration: 500,
      yoyo: true,
      repeat: -1
    });
  }

  /**
   * 移除护盾
   */
  deactivateShield() {
    this.shieldActive = false;
    if (this.shieldGraphic) {
      this.scene.tweens.killTweensOf(this.shieldGraphic);
      this.shieldGraphic.destroy();
      this.shieldGraphic = null;
    }
    
    // 通知 UI 更新
    this.scene.events.emit('bossPhaseChange', { phase: this.phase, shieldActive: false });
  }

  /**
   * 覆盖受伤方法：护盾减伤
   */
  takeDamage(damage) {
    let actualDamage = damage;
    
    // 护盾减伤50%
    if (this.shieldActive) {
      actualDamage = Math.floor(damage * 0.5);
      this.scene.events.emit('showMessage', '护盾吸收了部分伤害！');
    }
    
    const result = super.takeDamage(actualDamage);
    
    // 检查阶段转换
    if (this.isAlive) {
      this.checkPhaseTransition();
    }
    
    return result;
  }

  async act(player) {
    if (!this.isAlive || !player.isAlive) return;

    // 玩家未进入 Boss 房前不行动
    if (!this.scene.bossRoomLocked) return;
    
    // 阶段转换中不行动
    if (this.phaseTransitioning) return;

    // 处理地面轰炸倒计时
    await this.processPendingBombs();

    // 更新护盾
    this.updateShield();

    // 根据阶段选择行动
    const action = this.selectAction();
    
    switch (action) {
      case 'summon':
        await this.summonSmallCrystals();
        this.summonCd = this.phase === 3 ? 4 : 6;
        break;
      case 'burst':
        await this.fireBurstAtPlayer(player);
        this.burstCd = this.phase === 3 ? 2 : 3;
        break;
      case 'laser':
        await this.fireLaser(player);
        this.laserCd = 4;
        break;
      case 'bombard':
        await this.startBombardment(player);
        this.bombardCd = 3;
        break;
      default:
        // 冷却中，空闲
        await new Promise(r => this.scene.time.delayedCall(80, r));
    }

    // 减少所有冷却
    this.reduceCooldowns();
  }

  /**
   * 选择本回合行动
   */
  selectAction() {
    const existing = this.scene.enemies.filter(e => e && e.isSmallCrystal);
    
    // 阶段3优先：地面轰炸
    if (this.phase >= 3 && this.bombardCd <= 0) {
      return 'bombard';
    }
    
    // 阶段2+：激光扫射
    if (this.phase >= 2 && this.laserCd <= 0 && Math.random() < 0.4) {
      return 'laser';
    }
    
    // 召唤小晶体
    if (this.summonCd <= 0 && existing.length < this.maxSmall) {
      return 'summon';
    }
    
    // 弹幕射击
    if (this.burstCd <= 0) {
      return 'burst';
    }
    
    return 'idle';
  }

  /**
   * 减少冷却
   */
  reduceCooldowns() {
    this.burstCd = Math.max(0, this.burstCd - 1);
    this.summonCd = Math.max(0, this.summonCd - 1);
    this.laserCd = Math.max(0, this.laserCd - 1);
    this.bombardCd = Math.max(0, this.bombardCd - 1);
    if (this.shieldCooldown > 0) this.shieldCooldown--;
  }

  /**
   * 更新护盾状态
   */
  updateShield() {
    if (this.shieldActive) {
      this.shieldDuration--;
      // 更新护盾位置
      if (this.shieldGraphic) {
        this.shieldGraphic.setPosition(this.sprite.x, this.sprite.y);
      }
      if (this.shieldDuration <= 0) {
        this.deactivateShield();
      }
    } else if (this.phase >= 2 && this.shieldCooldown <= 0) {
      // 护盾冷却结束，重新激活
      this.activateShield();
    }
  }

  /**
   * 新技能：激光扫射（阶段2）
   */
  async fireLaser(player) {
    this.scene.events.emit('showMessage', '水晶核心蓄力中...');

    const dir = this.getAxisDirectionTo(player);
    const path = this.traceLaserPath(dir.x, dir.y, 15);
    const end = path[path.length - 1] || { x: this.tileX + dir.x, y: this.tileY + dir.y };
    const startPx = this.pixelX;
    const startPy = this.pixelY;
    const endPx = end.x * TILE_SIZE + TILE_SIZE / 2;
    const endPy = end.y * TILE_SIZE + TILE_SIZE / 2;

    if (this.scene.createLineWarning) {
      this.scene.createLineWarning(startPx, startPy, endPx, endPy, 260, 0x00ffff);
    }

    await this.wait(240);

    const bm = this.scene.bulletManager;
    if (!bm || path.length === 0) return;

    const angle = Math.atan2(dir.y, dir.x);
    const speed = this.phase >= 3 ? 320 : 240;

    // 沿路径布置多段激光弹幕，形成一道可以擦弹的高速光束
    for (let i = 0; i < path.length; i++) {
      const t = path[i];
      const px = t.x * TILE_SIZE + TILE_SIZE / 2;
      const py = t.y * TILE_SIZE + TILE_SIZE / 2;
      bm.fire(px, py, angle, speed, { damage: this.laserDamage, owner: this, texture: 'enemyBullet' });
    }

    // 视觉残留
    try {
      const beam = this.scene.add.graphics();
      beam.lineStyle(6, 0x66f0ff, 0.65);
      beam.beginPath();
      beam.moveTo(startPx, startPy);
      beam.lineTo(endPx, endPy);
      beam.strokePath();
      beam.setDepth(46);
      this.scene.tweens.add({ targets: beam, alpha: 0, duration: 200, onComplete: () => { try { beam.destroy(); } catch (e) {} } });
    } catch (e) {}

    await this.wait(120);
  }

  /**
   * 新技能：地面轰炸（阶段3）
   */
  async startBombardment(player) {
    this.scene.events.emit('showMessage', '危险！地面即将爆炸！');
    
    // 在玩家周围标记3-4个位置
    const bombCount = 3 + Math.floor(Math.random() * 2);
    const positions = [];
    
    for (let i = 0; i < bombCount; i++) {
      // 在玩家周围2格范围内随机选择
      for (let attempt = 0; attempt < 10; attempt++) {
        const bx = player.tileX + Math.floor(Math.random() * 5) - 2;
        const by = player.tileY + Math.floor(Math.random() * 5) - 2;
        
        if (!this.scene.mapManager.isWalkable(bx, by)) continue;
        if (positions.some(p => p.x === bx && p.y === by)) continue;
        
        positions.push({ x: bx, y: by });
        break;
      }
    }
    
    // 创建预警标记
    for (const pos of positions) {
      const px = pos.x * TILE_SIZE + TILE_SIZE / 2;
      const py = pos.y * TILE_SIZE + TILE_SIZE / 2;
      if (this.scene.createCircleWarning) {
        this.scene.createCircleWarning(px, py, 18, 420, 0xff5533);
      } else {
        const warning = this.scene.add.circle(px, py, 14, 0xff0000, 0.3);
        warning.setStrokeStyle(2, 0xff0000);
        warning.setDepth(40);
        this.scene.tweens.add({ targets: warning, scale: { from: 0.8, to: 1.2 }, alpha: { from: 0.3, to: 0.6 }, duration: 300, yoyo: true, repeat: -1 });
        this.scene.time.delayedCall(450, () => { try { warning.destroy(); } catch (e) {} });
      }

      this.pendingBombs.push({
        x: pos.x,
        y: pos.y,
        turnsLeft: 2
      });
    }
  }

  /**
   * 处理待爆炸的炸弹
   */
  async processPendingBombs() {
    const exploding = [];
    
    for (let i = this.pendingBombs.length - 1; i >= 0; i--) {
      const bomb = this.pendingBombs[i];
      bomb.turnsLeft--;
      
      if (bomb.turnsLeft <= 0) {
        exploding.push(bomb);
        this.pendingBombs.splice(i, 1);
      }
    }
    
    // 处理爆炸
    for (const bomb of exploding) {
      await this.explodeBomb(bomb);
    }
  }

  /**
   * 炸弹爆炸
   */
  async explodeBomb(bomb) {
    // 爆炸特效
    const cx = bomb.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = bomb.y * TILE_SIZE + TILE_SIZE / 2;

    const explosion = this.scene.add.circle(cx, cy, 10, 0xff6600, 0.9);
    explosion.setDepth(50);
    this.scene.tweens.add({ targets: explosion, radius: 24, alpha: 0, duration: 260, onComplete: () => explosion.destroy() });

    // 直接范围伤害
    const player = this.scene.player;
    const dist = Math.abs(player.tileX - bomb.x) + Math.abs(player.tileY - bomb.y);

    if (dist === 0) {
      const dmg = player.takeDamage(this.bombardDamage);
      this.scene.events.emit('showDamage', { x: player.sprite.x, y: player.sprite.y - 20, damage: dmg, isHeal: false });
    } else if (dist === 1) {
      const dmg = player.takeDamage(Math.floor(this.bombardDamage / 2));
      this.scene.events.emit('showDamage', { x: player.sprite.x, y: player.sprite.y - 20, damage: dmg, isHeal: false });
    }

    // 弹幕溅射（便于擦弹/躲避）
    try {
      if (this.scene.bulletManager) {
        this.scene.bulletManager.fireRing(cx, cy, 10, 140, { damage: Math.floor(this.bombardDamage * 0.6), owner: this, texture: 'enemyBullet' });
      }
    } catch (e) {}
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

    // 召唤预警
    for (const p of positions) {
      const px = p.x * TILE_SIZE + TILE_SIZE / 2;
      const py = p.y * TILE_SIZE + TILE_SIZE / 2;
      if (this.scene.createCircleWarning) {
        this.scene.createCircleWarning(px, py, 16, 320, 0x66ddff);
      }
    }
    await this.wait(220);

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
    this.aiState = 'attack';
    const bm = this.scene.bulletManager;
    if (!bm) return;

    const originX = this.pixelX;
    const originY = this.pixelY;
    const baseAngle = this.getAngleToPlayer(player);

    if (this.scene.createCircleWarning) {
      this.scene.createCircleWarning(originX, originY, 22, 200, 0x66ccff);
    }
    await this.wait(180);

    const spreadCount = this.phase >= 2 ? 7 : 5;
    const ringCount = this.phase >= 3 ? 12 : 8;
    const speed = this.phase >= 3 ? 200 : 150;

    bm.fireSpread(originX, originY, baseAngle, spreadCount, Math.PI / 3, speed, { damage: this.burstDamage, owner: this, texture: 'enemyBullet' });
    bm.fireRing(originX, originY, ringCount, speed * 0.8, { damage: Math.max(6, this.burstDamage - 2), owner: this, texture: 'enemyBullet' });
    if (this.phase >= 2) {
      bm.fireAimed(originX, originY, player.pixelX, player.pixelY, speed + 40, { damage: this.burstDamage + 2, owner: this, texture: 'enemyBullet' });
    }

    await this.wait(80);
  }

  // 覆盖死亡：触发 boss 被击败事件，清理残留效果
  die() {
    // 清理护盾
    this.deactivateShield();
    
    // 清理未爆炸的炸弹
    for (const bomb of this.pendingBombs) {
      if (bomb.graphic) {
        try {
          this.scene.tweens.killTweensOf(bomb.graphic);
          bomb.graphic.destroy();
        } catch (e) {}
      }
    }
    this.pendingBombs = [];
    
    try { super.die(); } catch (e) {}
    try {
      if (this.scene && this.scene.onBossDefeated) this.scene.onBossDefeated(this);
    } catch (e) {}
  }
}
