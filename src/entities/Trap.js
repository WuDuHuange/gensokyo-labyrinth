/**
 * 陷阱系统
 * 包括地刺和传送阵
 */
import { TILE_SIZE } from '../config/gameConfig.js';

/**
 * 地刺陷阱 - 踩到扣血
 */
export class SpikeTrap {
  constructor(scene, tileX, tileY, config = {}) {
    this.scene = scene;
    this.tileX = tileX;
    this.tileY = tileY;
    this.type = 'spike';
    
    this.damage = config.damage || 10;
    this.isRevealed = false;  // 是否已被发现（踩过或被探测）
    this.cooldown = 0;        // 冷却（防止连续触发）
    
    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;
    
    // 隐藏状态的精灵（半透明）
    this.sprite = scene.add.sprite(px, py, 'spike');
    this.sprite.setDepth(5);
    this.sprite.setAlpha(0.3);  // 未发现时几乎不可见
  }
  
  /**
   * 检查是否触发
   */
  checkTrigger(entity) {
    if (this.cooldown > 0) {
      this.cooldown--;
      return false;
    }
    
    if (entity.tileX === this.tileX && entity.tileY === this.tileY) {
      this.trigger(entity);
      return true;
    }
    return false;
  }
  
  /**
   * 触发陷阱
   */
  trigger(entity) {
    // 揭示陷阱
    if (!this.isRevealed) {
      this.isRevealed = true;
      this.sprite.setAlpha(0.9);
    }
    
    // 地刺弹出动画
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - 8,
      duration: 100,
      yoyo: true,
      ease: 'Cubic.easeOut'
    });
    
    // 造成伤害
    const damage = entity.takeDamage ? entity.takeDamage(this.damage) : this.damage;
    
    this.scene.events.emit('showDamage', {
      x: entity.sprite.x,
      y: entity.sprite.y - 20,
      damage: damage,
      isHeal: false
    });
    
    const name = entity.name || '目标';
    this.scene.events.emit('showMessage', `${name}踩到了地刺！受到 ${damage} 点伤害！`);
    
    // 设置冷却防止连续触发
    this.cooldown = 2;
  }
  
  /**
   * 揭示陷阱（被探测时）
   */
  reveal() {
    this.isRevealed = true;
    this.sprite.setAlpha(0.9);
  }
  
  setVisible(visible) {
    // 未发现的陷阱在可见范围内也只显示微弱痕迹
    if (!this.isRevealed) {
      this.sprite.setVisible(visible);
      this.sprite.setAlpha(visible ? 0.15 : 0);
    } else {
      this.sprite.setVisible(visible);
      this.sprite.setAlpha(visible ? 0.9 : 0);
    }
  }
}

/**
 * 传送阵 - 随机传送到其他位置
 */
export class TeleportTrap {
  constructor(scene, tileX, tileY, config = {}) {
    this.scene = scene;
    this.tileX = tileX;
    this.tileY = tileY;
    this.type = 'teleport';
    
    this.cooldown = 0;
    this.isRevealed = true;  // 传送阵总是可见
    
    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;
    
    this.sprite = scene.add.sprite(px, py, 'portal');
    this.sprite.setDepth(5);
    
    // 旋转动画
    scene.tweens.add({
      targets: this.sprite,
      angle: 360,
      duration: 3000,
      repeat: -1
    });
  }
  
  /**
   * 检查是否触发
   */
  checkTrigger(entity) {
    if (this.cooldown > 0) {
      this.cooldown--;
      return false;
    }
    
    if (entity.tileX === this.tileX && entity.tileY === this.tileY) {
      this.trigger(entity);
      return true;
    }
    return false;
  }
  
  /**
   * 触发传送
   */
  trigger(entity) {
    // 寻找可传送的位置
    const validPositions = [];
    const mapData = this.scene.mapData;
    
    if (!mapData || !mapData.tiles) return;
    
    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        // 跳过当前位置和附近位置
        if (Math.abs(x - this.tileX) <= 3 && Math.abs(y - this.tileY) <= 3) continue;
        
        // 必须是可通行的地板
        if (!this.scene.mapManager.isWalkable(x, y)) continue;
        
        // 不能有其他实体
        const hasEntity = this.scene.enemies?.some(e => e.tileX === x && e.tileY === y) ||
                         (this.scene.player?.tileX === x && this.scene.player?.tileY === y);
        if (hasEntity) continue;
        
        // 不能有障碍物
        const hasObstacle = this.scene.obstacles?.some(o => o.tileX === x && o.tileY === y && o.isAlive);
        if (hasObstacle) continue;
        
        // 确保目标位置四周至少有一个可通行的格子（避免传送到死路）
        let hasExit = false;
        const dirs = [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];
        for (const dir of dirs) {
          const nx = x + dir.dx, ny = y + dir.dy;
          if (this.scene.mapManager.isWalkable(nx, ny)) {
            hasExit = true;
            break;
          }
        }
        if (!hasExit) continue;
        
        validPositions.push({ x, y });
      }
    }
    
    if (validPositions.length === 0) {
      this.scene.events.emit('showMessage', '传送阵能量不足，无法传送！');
      return;
    }
    
    // 随机选择目标
    const target = validPositions[Math.floor(Math.random() * validPositions.length)];
    
    // 传送动画
    const name = entity.name || '目标';
    const originalScaleX = entity.sprite.scaleX;
    const originalScaleY = entity.sprite.scaleY;
    
    // 消失效果（保留原始缩放，避免传送后变大/变形）
    this.scene.tweens.add({
      targets: entity.sprite,
      alpha: 0,
      scaleX: originalScaleX * 0.5,
      scaleY: originalScaleY * 0.5,
      duration: 200,
      onComplete: () => {
        // 移动到新位置
        entity.tileX = target.x;
        entity.tileY = target.y;
        entity.sprite.x = target.x * TILE_SIZE + TILE_SIZE / 2;
        entity.sprite.y = target.y * TILE_SIZE + TILE_SIZE / 2;
        
        // 出现效果
        this.scene.tweens.add({
          targets: entity.sprite,
          alpha: 1,
          scaleX: originalScaleX,
          scaleY: originalScaleY,
          duration: 200
        });
      }
    });
    
    // 传送特效
    this.createTeleportEffect(this.tileX, this.tileY);
    setTimeout(() => this.createTeleportEffect(target.x, target.y), 200);
    
    this.scene.events.emit('showMessage', `${name}被传送到了别处！`);
    
    // 冷却
    this.cooldown = 5;
  }
  
  createTeleportEffect(tx, ty) {
    try {
      const px = tx * TILE_SIZE + TILE_SIZE / 2;
      const py = ty * TILE_SIZE + TILE_SIZE / 2;
      
      const ring = this.scene.add.graphics();
      ring.lineStyle(3, 0x9966ff, 1);
      ring.strokeCircle(px, py, 5);
      ring.setDepth(20);
      
      this.scene.tweens.add({
        targets: ring,
        scaleX: 3,
        scaleY: 3,
        alpha: 0,
        duration: 400,
        onComplete: () => ring.destroy()
      });
    } catch (e) {}
  }
  
  setVisible(visible) {
    this.sprite.setVisible(visible);
  }
}
