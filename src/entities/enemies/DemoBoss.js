import Enemy from '../Enemy.js';
import SmallCrystal from './SmallCrystal.js';
import { TILE_SIZE } from '../../config/gameConfig.js';
import { TileType } from '../../systems/MapGenerator.js';

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
    this.fanDamage = 10;
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
    this.pendingBombs = []; // { x, y, turnsLeft, graphic }
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
    
    // 确定激光方向（朝向玩家）
    const dx = player.tileX - this.tileX;
    const dy = player.tileY - this.tileY;
    
    // 简化为四个基本方向
    let laserDx = 0, laserDy = 0;
    if (Math.abs(dx) >= Math.abs(dy)) {
      laserDx = dx > 0 ? 1 : -1;
    } else {
      laserDy = dy > 0 ? 1 : -1;
    }
    
    // 预警线（红色虚线）
    const warningLine = this.scene.add.graphics();
    warningLine.lineStyle(4, 0xff0000, 0.5);
    let wx = this.tileX, wy = this.tileY;
    warningLine.moveTo(wx * TILE_SIZE + TILE_SIZE / 2, wy * TILE_SIZE + TILE_SIZE / 2);
    for (let i = 0; i < 15; i++) {
      wx += laserDx;
      wy += laserDy;
      if (!this.scene.mapManager.isWalkable(wx, wy)) break;
    }
    warningLine.lineTo(wx * TILE_SIZE + TILE_SIZE / 2, wy * TILE_SIZE + TILE_SIZE / 2);
    warningLine.setDepth(45);
    
    // 闪烁预警
    this.scene.tweens.add({
      targets: warningLine,
      alpha: { from: 0.3, to: 0.8 },
      duration: 200,
      yoyo: true,
      repeat: 2
    });
    
    await new Promise(r => this.scene.time.delayedCall(600, r));
    warningLine.destroy();
    
    // 发射激光
    const laserGraphic = this.scene.add.graphics();
    laserGraphic.fillStyle(0x00ffff, 0.8);
    
    let lx = this.tileX, ly = this.tileY;
    const hitPositions = [];
    
    for (let i = 0; i < 15; i++) {
      lx += laserDx;
      ly += laserDy;
      if (!this.scene.mapManager.isWalkable(lx, ly)) break;
      hitPositions.push({ x: lx, y: ly });
      
      // 绘制激光
      laserGraphic.fillRect(
        lx * TILE_SIZE + 8, ly * TILE_SIZE + 8,
        TILE_SIZE - 16, TILE_SIZE - 16
      );
    }
    laserGraphic.setDepth(46);
    
    // 激光造成伤害
    for (const pos of hitPositions) {
      if (player.tileX === pos.x && player.tileY === pos.y) {
        const dmg = player.takeDamage(this.laserDamage);
        this.scene.events.emit('showDamage', {
          x: player.sprite.x, y: player.sprite.y - 20,
          damage: dmg, isHeal: false
        });
      }
      // 也可以伤害小晶体
      const enemy = this.scene.getEnemyAt(pos.x, pos.y);
      if (enemy && enemy !== this) {
        enemy.takeDamage(this.laserDamage);
      }
    }
    
    // 激光消散
    this.scene.tweens.add({
      targets: laserGraphic,
      alpha: 0,
      duration: 300,
      onComplete: () => laserGraphic.destroy()
    });
    
    await new Promise(r => this.scene.time.delayedCall(200, r));
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
      const warning = this.scene.add.circle(
        pos.x * TILE_SIZE + TILE_SIZE / 2,
        pos.y * TILE_SIZE + TILE_SIZE / 2,
        14, 0xff0000, 0.3
      );
      warning.setStrokeStyle(2, 0xff0000);
      warning.setDepth(40);
      
      // 脉冲动画
      this.scene.tweens.add({
        targets: warning,
        scale: { from: 0.8, to: 1.2 },
        alpha: { from: 0.3, to: 0.6 },
        duration: 300,
        yoyo: true,
        repeat: -1
      });
      
      this.pendingBombs.push({
        x: pos.x,
        y: pos.y,
        turnsLeft: 2,
        graphic: warning
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
    // 移除预警
    if (bomb.graphic) {
      this.scene.tweens.killTweensOf(bomb.graphic);
      bomb.graphic.destroy();
    }
    
    // 爆炸特效
    const explosion = this.scene.add.circle(
      bomb.x * TILE_SIZE + TILE_SIZE / 2,
      bomb.y * TILE_SIZE + TILE_SIZE / 2,
      8, 0xff6600, 0.9
    );
    explosion.setDepth(50);
    
    this.scene.tweens.add({
      targets: explosion,
      radius: 20,
      alpha: 0,
      duration: 300,
      onComplete: () => explosion.destroy()
    });
    
    // 检查玩家是否在爆炸范围（当前格+相邻格）
    const player = this.scene.player;
    const dist = Math.abs(player.tileX - bomb.x) + Math.abs(player.tileY - bomb.y);
    
    if (dist === 0) {
      // 直接命中
      const dmg = player.takeDamage(this.bombardDamage);
      this.scene.events.emit('showDamage', {
        x: player.sprite.x, y: player.sprite.y - 20,
        damage: dmg, isHeal: false
      });
    } else if (dist === 1) {
      // 溅射伤害（半伤）
      const dmg = player.takeDamage(Math.floor(this.bombardDamage / 2));
      this.scene.events.emit('showDamage', {
        x: player.sprite.x, y: player.sprite.y - 20,
        damage: dmg, isHeal: false
      });
    }
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
