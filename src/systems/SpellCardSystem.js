/**
 * 符卡系统
 * 管理灵梦的符卡技能
 */
import { SPELLCARD_CONFIG, TILE_SIZE } from '../config/gameConfig.js';

/**
 * 符卡基类
 */
export class SpellCard {
  constructor(scene, config) {
    this.scene = scene;
    this.name = config.name;
    this.type = config.type;
    this.mpCost = config.mpCost;
    this.cooldown = config.cooldown;
    this.damage = config.damage;
    this.currentCooldown = 0;
  }

  canUse(currentMp) {
    return currentMp >= this.mpCost && this.currentCooldown === 0;
  }

  use(caster, target) {
    // 由子类实现
  }

  reduceCooldown() {
    if (this.currentCooldown > 0) {
      this.currentCooldown--;
    }
  }

  startCooldown() {
    this.currentCooldown = this.cooldown;
  }
}

/**
 * 珠符「明珠暗投」- 反弹型：扔出三个会反弹的阴阳玉
 */
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
    
    // 三个阴阳玉的初始方向（扇形发射）
    const directions = this.getSpreadDirections(direction);
    const allHitPositions = [];
    
    // 为每个阴阳玉计算反弹路径
    directions.forEach((dir, index) => {
      const path = this.calculateBouncePath(startX, startY, dir);
      allHitPositions.push(...path);
      this.createYinyangOrb(startX, startY, path, index);
    });

    return {
      damage: this.damage,
      positions: allHitPositions,
      piercing: true
    };
  }

  getSpreadDirections(baseDir) {
    const directions = [];
    
    if (baseDir.x !== 0 && baseDir.y === 0) {
      // 水平方向
      directions.push({ x: baseDir.x, y: -1 });
      directions.push({ x: baseDir.x, y: 0 });
      directions.push({ x: baseDir.x, y: 1 });
    } else if (baseDir.y !== 0 && baseDir.x === 0) {
      // 垂直方向
      directions.push({ x: -1, y: baseDir.y });
      directions.push({ x: 0, y: baseDir.y });
      directions.push({ x: 1, y: baseDir.y });
    } else {
      // 斜向或默认
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
        
        // 反弹逻辑
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
    if (path.length === 0) return;
    
    const orb = this.scene.add.graphics();
    orb.fillStyle(0xffffff, 1);
    orb.fillCircle(0, 0, 10);
    orb.fillStyle(0x000000, 1);
    orb.fillCircle(-3, 0, 5);
    orb.setPosition(
      startX * TILE_SIZE + TILE_SIZE / 2,
      startY * TILE_SIZE + TILE_SIZE / 2
    );
    
    let pathIndex = 0;
    const moveNext = () => {
      if (pathIndex >= path.length) {
        this.scene.tweens.add({
          targets: orb,
          alpha: 0,
          scale: 0.5,
          duration: 80,
          onComplete: () => orb.destroy()
        });
        return;
      }
      
      const target = path[pathIndex];
      this.scene.tweens.add({
        targets: orb,
        x: target.x * TILE_SIZE + TILE_SIZE / 2,
        y: target.y * TILE_SIZE + TILE_SIZE / 2,
        duration: 35,
        ease: 'Linear',
        onComplete: () => {
          this.createHitEffect(target.x, target.y);
          pathIndex++;
          moveNext();
        }
      });
    };
    
    this.scene.time.delayedCall(index * 50, moveNext);
  }

  createHitEffect(tileX, tileY) {
    const effect = this.scene.add.graphics();
    effect.fillStyle(0xffff00, 0.5);
    effect.fillCircle(
      tileX * TILE_SIZE + TILE_SIZE / 2,
      tileY * TILE_SIZE + TILE_SIZE / 2,
      8
    );

    this.scene.tweens.add({
      targets: effect,
      alpha: 0,
      scale: 1.5,
      duration: 80,
      onComplete: () => effect.destroy()
    });
  }
}

/**
 * 梦符「封魔阵」- 结界型：放置结界，敌人进入受伤
 */
export class Fuumajin extends SpellCard {
  constructor(scene) {
    super(scene, SPELLCARD_CONFIG.fuumajin);
    this.duration = SPELLCARD_CONFIG.fuumajin.duration;
    this.radius = SPELLCARD_CONFIG.fuumajin.radius;
  }

  use(caster, direction) {
    // 结界放置在玩家前方
    let barrierX = caster.tileX + direction.x * 2;
    let barrierY = caster.tileY + direction.y * 2;
    
    // 检查位置是否有效
    if (!this.scene.mapManager.isWalkable(barrierX, barrierY)) {
      barrierX = caster.tileX;
      barrierY = caster.tileY;
    }
    
    this.createBarrier(barrierX, barrierY);

    return {
      damage: 0,
      positions: [],
      piercing: false
    };
  }

  createBarrier(centerX, centerY) {
    const barrier = this.scene.add.graphics();
    barrier.lineStyle(3, 0xff6b6b, 0.8);
    barrier.strokeCircle(
      centerX * TILE_SIZE + TILE_SIZE / 2,
      centerY * TILE_SIZE + TILE_SIZE / 2,
      this.radius * TILE_SIZE + TILE_SIZE / 2
    );
    barrier.fillStyle(0xff6b6b, 0.2);
    barrier.fillCircle(
      centerX * TILE_SIZE + TILE_SIZE / 2,
      centerY * TILE_SIZE + TILE_SIZE / 2,
      this.radius * TILE_SIZE + TILE_SIZE / 2
    );

    // 符文装饰
    const runes = this.scene.add.graphics();
    runes.lineStyle(2, 0xffffff, 0.6);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const runeX = centerX * TILE_SIZE + TILE_SIZE / 2 + Math.cos(angle) * (this.radius * TILE_SIZE);
      const runeY = centerY * TILE_SIZE + TILE_SIZE / 2 + Math.sin(angle) * (this.radius * TILE_SIZE);
      runes.strokeCircle(runeX, runeY, 5);
    }

    this.scene.tweens.add({
      targets: runes,
      angle: 360,
      duration: 2000,
      repeat: this.duration - 1,
      onComplete: () => runes.destroy()
    });

    this.scene.tweens.add({
      targets: barrier,
      alpha: 0.3,
      duration: 500,
      yoyo: true,
      repeat: this.duration * 2 - 1,
      onComplete: () => barrier.destroy()
    });

    // 注册结界到场景
    const barrierData = {
      x: centerX,
      y: centerY,
      radius: this.radius,
      damage: this.damage,
      duration: this.duration,
      graphics: barrier,
      runes: runes
    };
    
    if (this.scene.addBarrier) {
      this.scene.addBarrier(barrierData);
    }
  }
}

/**
 * 空符「梦想妙珠」- 追踪型：释放多个追踪光球
 */
export class MusouMyouji extends SpellCard {
  constructor(scene) {
    super(scene, SPELLCARD_CONFIG.musouMyouji);
    this.projectileCount = SPELLCARD_CONFIG.musouMyouji.projectileCount;
    this.range = SPELLCARD_CONFIG.musouMyouji.range;
  }

  use(caster) {
    const startX = caster.tileX;
    const startY = caster.tileY;
    
    // 获取范围内的敌人
    const enemies = this.scene.getEnemiesInRange(startX, startY, this.range);
    
    if (enemies.length === 0) {
      this.scene.events.emit('showMessage', '范围内没有敌人！');
      return { damage: 0, positions: [], piercing: false, noTarget: true };
    }

    const hitPositions = [];
    const hitEnemies = [];
    
    for (let i = 0; i < this.projectileCount; i++) {
      const target = enemies[i % enemies.length];
      hitPositions.push({ x: target.tileX, y: target.tileY });
      if (!hitEnemies.includes(target)) {
        hitEnemies.push(target);
      }
      this.createHomingOrb(startX, startY, target, i);
    }

    return {
      damage: this.damage,
      positions: hitPositions,
      piercing: false,
      isHoming: true,
      targets: hitEnemies,
      hitCount: this.projectileCount
    };
  }

  createHomingOrb(startX, startY, target, index) {
    const orb = this.scene.add.graphics();
    
    const colors = [0xff6b6b, 0xffb86b, 0xfff66b, 0x6bff6b, 0x6bffff];
    const color = colors[index % colors.length];
    
    orb.fillStyle(color, 0.9);
    orb.fillCircle(0, 0, 8);
    orb.fillStyle(0xffffff, 0.8);
    orb.fillCircle(0, 0, 4);
    
    const angle = (index / this.projectileCount) * Math.PI * 2;
    const offsetX = Math.cos(angle) * 20;
    const offsetY = Math.sin(angle) * 20;
    
    orb.setPosition(
      startX * TILE_SIZE + TILE_SIZE / 2 + offsetX,
      startY * TILE_SIZE + TILE_SIZE / 2 + offsetY
    );

    this.scene.time.delayedCall(50 + index * 60, () => {
      this.scene.tweens.add({
        targets: orb,
        y: orb.y - 20,
        duration: 100,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: orb,
            x: target.tileX * TILE_SIZE + TILE_SIZE / 2,
            y: target.tileY * TILE_SIZE + TILE_SIZE / 2,
            duration: 150,
            ease: 'Quad.easeIn',
            onComplete: () => {
              this.createImpactEffect(target.tileX, target.tileY, color);
              orb.destroy();
            }
          });
        }
      });
    });
  }

  createImpactEffect(tileX, tileY, color) {
    const impact = this.scene.add.graphics();
    impact.fillStyle(color, 0.8);
    impact.fillCircle(
      tileX * TILE_SIZE + TILE_SIZE / 2,
      tileY * TILE_SIZE + TILE_SIZE / 2,
      12
    );

    this.scene.tweens.add({
      targets: impact,
      alpha: 0,
      scale: 2,
      duration: 120,
      onComplete: () => impact.destroy()
    });
  }
}

/**
 * 符卡系统管理器
 */
export default class SpellCardSystem {
  constructor(scene) {
    this.scene = scene;
    this.spellCards = [];
  }

  initialize() {
    this.spellCards = [
      new MeigyokuAnki(this.scene),   // Z键 - 反弹型
      new Fuumajin(this.scene),        // X键 - 结界型
      new MusouMyouji(this.scene)      // C键 - 追踪型
    ];
  }

  getSpellCard(index) {
    return this.spellCards[index];
  }

  reduceCooldowns() {
    for (const spell of this.spellCards) {
      spell.reduceCooldown();
    }
  }

  getStatus() {
    return this.spellCards.map(spell => ({
      name: spell.name,
      mpCost: spell.mpCost,
      cooldown: spell.currentCooldown,
      maxCooldown: spell.cooldown
    }));
  }
}
