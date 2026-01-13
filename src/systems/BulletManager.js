/**
 * 向量弹幕管理器 (Vector-based Danmaku System)
 * 
 * 支持 360 度自由角度弹幕，与 TimeScaleManager 联动
 */

import { TILE_SIZE } from '../config/gameConfig.js';

// 弹幕图案类型
export const BulletPattern = {
  AIMED: 'aimed',       // 自机狙（朝玩家发射）
  SPREAD: 'spread',     // 扇形散射
  SPIRAL: 'spiral',     // 螺旋旋转
  RING: 'ring',         // 圆环扩散
  RANDOM: 'random',     // 随机方向
  LINE: 'line'          // 直线
};

// 弹幕配置
export const BULLET_CONFIG = {
  BASE_SPEED: 80,           // 基础速度 (pixels/sec at 1.0 timeScale)
  GRAZE_RADIUS_MULT: 2.0,   // 擦弹半径 = 碰撞半径 × 此值
  GRAZE_MP_GAIN: 5,         // 单次擦弹 MP 获取
  DEFAULT_RADIUS: 6,        // 默认碰撞半径
  DEFAULT_DAMAGE: 10,       // 默认伤害
  MAX_BULLETS: 500,         // 最大弹幕数量（性能限制）
  CLEANUP_MARGIN: 100       // 超出屏幕多少像素后清理
};

/**
 * 单个弹幕对象
 */
export class Bullet {
  constructor(config = {}) {
    // 位置（像素坐标）
    this.x = config.x || 0;
    this.y = config.y || 0;
    
    // 速度向量
    this.vx = config.vx || 0;
    this.vy = config.vy || 0;
    
    // 速度标量（用于计算）
    this.speed = config.speed || BULLET_CONFIG.BASE_SPEED;
    
    // 发射角度（弧度）
    this.angle = config.angle || 0;
    
    // 碰撞半径
    this.radius = config.radius || BULLET_CONFIG.DEFAULT_RADIUS;
    
    // 擦弹判定半径
    this.grazeRadius = this.radius * BULLET_CONFIG.GRAZE_RADIUS_MULT;
    
    // 伤害值
    this.damage = config.damage || BULLET_CONFIG.DEFAULT_DAMAGE;
    
    // 弹幕类型/图案
    this.pattern = config.pattern || BulletPattern.AIMED;
    
    // 精灵纹理
    this.texture = config.texture || 'enemyBullet';
    
    // 所属敌人（用于判定友军伤害）
    this.owner = config.owner || null;
    
    // 是否为玩家子弹（用于区分碰撞检测）
    this.isPlayerBullet = config.isPlayerBullet || false;
    
    // 是否已被擦弹（防止重复计算）
    this.grazed = false;
    
    // 是否激活
    this.active = true;
    
    // Phaser 精灵引用
    this.sprite = null;
    
    // 存活时间（用于某些弹幕的生命周期）
    this.lifetime = config.lifetime || -1; // -1 = 无限
    this.age = 0;
    
    // 特殊行为参数（螺旋等）
    this.angularSpeed = config.angularSpeed || 0; // 角速度（弧度/秒）
    this.acceleration = config.acceleration || 0; // 加速度
  }
  
  /**
   * 更新弹幕位置
   * @param {number} scaledDelta - 经过时间缩放的 delta (ms)
   */
  update(scaledDelta) {
    if (!this.active) return;
    
    const dt = scaledDelta / 1000; // 转换为秒
    
    // 应用角速度（螺旋弹幕）
    if (this.angularSpeed !== 0) {
      this.angle += this.angularSpeed * dt;
      this.vx = Math.cos(this.angle) * this.speed;
      this.vy = Math.sin(this.angle) * this.speed;
    }
    
    // 应用加速度
    if (this.acceleration !== 0) {
      this.speed += this.acceleration * dt;
      this.vx = Math.cos(this.angle) * this.speed;
      this.vy = Math.sin(this.angle) * this.speed;
    }
    
    // 更新位置
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    
    // 更新精灵位置
    if (this.sprite) {
      this.sprite.setPosition(this.x, this.y);
      // 精灵旋转跟随移动方向
      this.sprite.setRotation(this.angle);
    }
    
    // 更新存活时间
    if (this.lifetime > 0) {
      this.age += scaledDelta;
      if (this.age >= this.lifetime) {
        this.deactivate();
      }
    }
  }
  
  /**
   * 设置速度（通过角度和速率）
   */
  setVelocityFromAngle(angle, speed) {
    this.angle = angle;
    this.speed = speed;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }
  
  /**
   * 朝目标点发射
   */
  aimAt(targetX, targetY) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    this.angle = Math.atan2(dy, dx);
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
  }
  
  /**
   * 停用弹幕
   */
  deactivate() {
    this.active = false;
    if (this.sprite) {
      this.sprite.setVisible(false);
    }
  }
  
  /**
   * 重新激活（对象池复用）
   */
  activate(x, y, angle, speed) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = speed;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.grazed = false;
    this.active = true;
    this.age = 0;
    if (this.sprite) {
      this.sprite.setPosition(x, y);
      this.sprite.setVisible(true);
    }
  }
}

/**
 * 弹幕管理器
 */
export default class BulletManager {
  constructor(scene) {
    this.scene = scene;
    
    // 所有活跃弹幕
    this.bullets = [];
    
    // 对象池（复用已销毁的弹幕对象）
    this.pool = [];
    
    // 弹幕容器（用于统一深度管理）
    this.container = null;
    
    // 碰撞组
    this.playerHitbox = null;
    
    // 统计
    this.stats = {
      totalFired: 0,
      totalGrazed: 0,
      totalHit: 0
    };
    
    // 时间管理器引用
    this.timeManager = null;
  }
  
  /**
   * 初始化
   */
  init() {
    // 创建弹幕容器
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(15); // 在玩家之上
  }
  
  /**
   * 设置时间管理器
   */
  setTimeManager(tm) {
    this.timeManager = tm;
  }
  
  /**
   * 每帧更新
   * @param {number} realDelta - 实际 delta (ms)
   */
  update(realDelta) {
    // 获取时间缩放
    const timeScale = this.timeManager ? this.timeManager.getScale() : 1.0;
    const scaledDelta = realDelta * timeScale;
    
    // 获取屏幕边界（用于清理）
    const cam = this.scene.cameras.main;
    const margin = BULLET_CONFIG.CLEANUP_MARGIN;
    const bounds = {
      left: cam.scrollX - margin,
      right: cam.scrollX + cam.width + margin,
      top: cam.scrollY - margin,
      bottom: cam.scrollY + cam.height + margin
    };
    
    // 更新所有弹幕
    for (const bullet of this.bullets) {
      if (!bullet.active) continue;
      
      // 更新位置
      bullet.update(scaledDelta);

      // 碰到墙/门则销毁（不可穿墙）
      const map = this.scene.mapManager;
      const tx = Math.floor(bullet.x / TILE_SIZE);
      const ty = Math.floor(bullet.y / TILE_SIZE);
      if (map && !map.isWalkable(tx, ty)) {
        this.recycleBullet(bullet);
        continue;
      }
      try {
        const door = this.scene.getDoorAt ? this.scene.getDoorAt(tx, ty) : null;
        if (door && !door.isOpen) {
          this.recycleBullet(bullet);
          continue;
        }
      } catch (e) {}
      
      // 检查是否出界
      if (bullet.x < bounds.left || bullet.x > bounds.right ||
          bullet.y < bounds.top || bullet.y > bounds.bottom) {
        this.recycleBullet(bullet);
      }
    }
    
    // 清理不活跃的弹幕
    this.cleanup();
  }
  
  /**
   * 从池中获取或创建新弹幕
   */
  getBullet(config = {}) {
    let bullet;
    
    if (this.pool.length > 0) {
      bullet = this.pool.pop();
      // 重置属性
      Object.assign(bullet, {
        x: config.x || 0,
        y: config.y || 0,
        vx: config.vx || 0,
        vy: config.vy || 0,
        speed: config.speed || BULLET_CONFIG.BASE_SPEED,
        angle: config.angle || 0,
        radius: config.radius || BULLET_CONFIG.DEFAULT_RADIUS,
        damage: config.damage || BULLET_CONFIG.DEFAULT_DAMAGE,
        pattern: config.pattern || BulletPattern.AIMED,
        owner: config.owner || null,
        isPlayerBullet: config.isPlayerBullet || false, // 重要：标记是否为玩家子弹
        texture: config.texture || 'enemyBullet',
        grazed: false,
        active: true,
        age: 0,
        lifetime: config.lifetime || -1,
        angularSpeed: config.angularSpeed || 0,
        acceleration: config.acceleration || 0
      });
      bullet.grazeRadius = bullet.radius * BULLET_CONFIG.GRAZE_RADIUS_MULT;
    } else {
      bullet = new Bullet(config);
    }
    
    const textureKey = config.texture || bullet.texture || 'enemyBullet';

    // 创建精灵
    if (!bullet.sprite) {
      bullet.sprite = this.scene.add.sprite(bullet.x, bullet.y, textureKey);
      this.container.add(bullet.sprite);
    } else {
      bullet.sprite.setTexture(textureKey);
      bullet.sprite.setPosition(bullet.x, bullet.y);
      bullet.sprite.setVisible(true);
    }

    // 统一重置外观，避免复用时残留缩放/透明度
    bullet.sprite.setScale(0.5);
    bullet.sprite.setAlpha(1);
    bullet.sprite.setRotation(bullet.angle);
    
    return bullet;
  }
  
  /**
   * 发射单发弹幕
   */
  fire(x, y, angle, speed, config = {}) {
    if (this.bullets.length >= BULLET_CONFIG.MAX_BULLETS) {
      // 达到上限，移除最老的弹幕
      const oldest = this.bullets.shift();
      this.recycleBullet(oldest);
    }
    
    const bullet = this.getBullet({
      x, y,
      angle,
      speed: speed || BULLET_CONFIG.BASE_SPEED,
      ...config
    });
    
    bullet.setVelocityFromAngle(angle, bullet.speed);
    this.bullets.push(bullet);
    this.stats.totalFired++;
    
    return bullet;
  }
  
  /**
   * 发射自机狙弹幕
   */
  fireAimed(x, y, targetX, targetY, speed, config = {}) {
    const angle = Math.atan2(targetY - y, targetX - x);
    return this.fire(x, y, angle, speed, { ...config, pattern: BulletPattern.AIMED });
  }
  
  /**
   * 发射扇形散射
   * @param {number} count - 弹幕数量
   * @param {number} spreadAngle - 扇形角度（弧度）
   */
  fireSpread(x, y, baseAngle, count, spreadAngle, speed, config = {}) {
    const bullets = [];
    const halfSpread = spreadAngle / 2;
    const angleStep = count > 1 ? spreadAngle / (count - 1) : 0;
    const startAngle = baseAngle - halfSpread;
    
    for (let i = 0; i < count; i++) {
      const angle = count > 1 ? startAngle + angleStep * i : baseAngle;
      bullets.push(this.fire(x, y, angle, speed, { ...config, pattern: BulletPattern.SPREAD }));
    }
    
    return bullets;
  }
  
  /**
   * 发射圆环
   */
  fireRing(x, y, count, speed, config = {}) {
    const bullets = [];
    const angleStep = (Math.PI * 2) / count;
    
    for (let i = 0; i < count; i++) {
      const angle = angleStep * i;
      bullets.push(this.fire(x, y, angle, speed, { ...config, pattern: BulletPattern.RING }));
    }
    
    return bullets;
  }
  
  /**
   * 发射螺旋弹幕
   */
  fireSpiral(x, y, count, speed, angularSpeed, config = {}) {
    const bullets = [];
    const angleStep = (Math.PI * 2) / count;
    
    for (let i = 0; i < count; i++) {
      const angle = angleStep * i;
      bullets.push(this.fire(x, y, angle, speed, { 
        ...config, 
        pattern: BulletPattern.SPIRAL,
        angularSpeed: angularSpeed
      }));
    }
    
    return bullets;
  }
  
  /**
   * 检测与玩家的碰撞和擦弹
   * @param {Object} player - 玩家对象
   * @returns {{ hit: Bullet|null, grazed: Bullet[] }}
   */
  checkPlayerCollision(player) {
    if (!player || !player.sprite) return { hit: null, grazed: [] };
    
    // 玩家 hitbox 中心（身体中心，不是脚底）
    const hitboxCenter = player.getHitboxCenter ? player.getHitboxCenter() : { x: player.sprite.x, y: player.sprite.y };
    const px = hitboxCenter.x;
    const py = hitboxCenter.y;
    const playerRadius = 8; // 玩家碰撞半径（较小，便于躲避）
    
    let hitBullet = null;
    const grazedBullets = [];
    
    for (const bullet of this.bullets) {
      if (!bullet.active) continue;
      if (bullet.isPlayerBullet) continue; // 玩家子弹不与玩家碰撞
      
      const dx = bullet.x - px;
      const dy = bullet.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // 碰撞检测
      if (dist < bullet.radius + playerRadius) {
        hitBullet = bullet;
        this.stats.totalHit++;
        break; // 一次只处理一个碰撞
      }
      
      // 擦弹检测
      if (!bullet.grazed && dist < bullet.grazeRadius + playerRadius && dist >= bullet.radius + playerRadius) {
        bullet.grazed = true;
        grazedBullets.push(bullet);
        this.stats.totalGrazed++;
      }
    }
    
    return { hit: hitBullet, grazed: grazedBullets };
  }
  
  /**
   * 检测与敌人的碰撞（用于玩家子弹或殉爆）
   */
  checkEnemyCollision(enemies) {
    const hits = [];
    
    for (const bullet of this.bullets) {
      if (!bullet.active) continue;
      if (!bullet.isPlayerBullet) continue; // 只检查玩家子弹
      
      for (const enemy of enemies) {
        if (!enemy.isAlive) continue;
        
        const ex = enemy.sprite.x;
        const ey = enemy.sprite.y;
        const enemyRadius = TILE_SIZE / 2;
        
        const dx = bullet.x - ex;
        const dy = bullet.y - ey;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < bullet.radius + enemyRadius) {
          hits.push({ bullet, enemy });
          this.recycleBullet(bullet);
          break;
        }
      }
    }
    
    return hits;
  }
  
  /**
   * 清除所有弹幕（决死清弹）
   */
  clearAll() {
    for (const bullet of this.bullets) {
      this.recycleBullet(bullet);
    }
  }
  
  /**
   * 清除指定范围内的弹幕
   */
  clearInRadius(x, y, radius) {
    for (const bullet of this.bullets) {
      if (!bullet.active) continue;
      
      const dx = bullet.x - x;
      const dy = bullet.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < radius) {
        this.recycleBullet(bullet);
      }
    }
  }
  
  /**
   * 回收弹幕到池中
   */
  recycleBullet(bullet) {
    bullet.active = false;
    if (bullet.sprite) {
      bullet.sprite.setVisible(false);
    }
    
    // 从活跃列表移除，加入池中
    const idx = this.bullets.indexOf(bullet);
    if (idx !== -1) {
      this.bullets.splice(idx, 1);
    }
    this.pool.push(bullet);
  }
  
  /**
   * 清理不活跃的弹幕
   */
  cleanup() {
    // 已经在 recycleBullet 中处理了列表移除
    // 这里可以做额外的清理工作
  }
  
  /**
   * 获取活跃弹幕数量
   */
  getActiveBulletCount() {
    return this.bullets.filter(b => b.active).length;
  }
  
  /**
   * 销毁管理器
   */
  destroy() {
    for (const bullet of this.bullets) {
      if (bullet.sprite) {
        bullet.sprite.destroy();
      }
    }
    for (const bullet of this.pool) {
      if (bullet.sprite) {
        bullet.sprite.destroy();
      }
    }
    this.bullets = [];
    this.pool = [];
    if (this.container) {
      this.container.destroy();
    }
  }
}
