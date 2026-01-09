/**
 * 召唤师妖精（精英怪）
 * 可以召唤小妖精作为援军
 */
import Enemy from '../Enemy.js';
import SlowFairy from './SlowFairy.js';
import { TILE_SIZE } from '../../config/gameConfig.js';

export default class SummonerFairy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'danmakuFairy', {
      name: '召唤妖精',
      hp: 60,
      attack: 8,
      defense: 3,
      speed: 60,
      expReward: 35,
      detectionRange: 7,
      attackRange: 5
    });
    
    this.isElite = true;  // 精英怪标记
    this.summonCooldown = 0;   // 召唤冷却
    this.maxSummons = 3;       // 最多召唤数量
    this.summonedCount = 0;    // 已召唤数量
    
    // 给精灵添加精英标记（紫色光环）
    this.sprite.setTint(0xdd88ff);
    
    // 添加光环效果
    this.auraGraphic = this.scene.add.graphics();
    this.auraGraphic.lineStyle(1, 0xaa66ff, 0.5);
    this.auraGraphic.strokeCircle(0, 0, 20);
    this.auraGraphic.setDepth(9);
    this.updateAuraPosition();
  }
  
  updateAuraPosition() {
    if (this.auraGraphic && this.sprite) {
      this.auraGraphic.setPosition(this.sprite.x, this.sprite.y);
    }
  }

  /**
   * AI 行动
   */
  async act(player) {
    if (!this.isAlive || !player.isAlive) return;
    
    // 冷却递减
    if (this.summonCooldown > 0) this.summonCooldown--;
    
    const distance = this.getDistanceTo(player);
    
    // 统计当前存活的召唤物数量
    const aliveSummons = this.scene.enemies.filter(e => 
      e.isAlive && e.summoner === this
    ).length;
    
    // 优先召唤（如果冷却完毕且存活召唤物不超过上限）
    if (this.summonCooldown === 0 && aliveSummons < this.maxSummons && distance <= this.detectionRange) {
      if (this.scene.createCircleWarning) {
        this.scene.createCircleWarning(this.pixelX, this.pixelY, 26, 220, 0xaa66ff);
      }
      await new Promise(r => this.scene.time.delayedCall(200, r));
      await this.summonMinion();
      return;
    }
    
    // 保持距离，远程攻击
    if (distance <= 2) {
      // 太近，后退
      await this.retreat(player);
    } else if (distance <= this.attackRange && distance >= 3) {
      // 在射程内，发射弹幕
      await this.shootProjectile(player);
    } else if (distance <= this.detectionRange) {
      // 接近到射程
      await this.approach(player);
    } else {
      await this.idle();
    }
    
    this.updateAuraPosition();
  }
  
  /**
   * 召唤小妖精
   */
  async summonMinion() {
    this.aiState = 'summon';
    
    // 寻找附近可用的空格
    const positions = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        if (dx === 0 && dy === 0) continue;
        const nx = this.tileX + dx;
        const ny = this.tileY + dy;
        if (this.scene.mapManager.isWalkable(nx, ny)) {
          // 检查是否有其他实体
          const hasEntity = this.scene.enemies.some(e => e.tileX === nx && e.tileY === ny) ||
                           (this.scene.player.tileX === nx && this.scene.player.tileY === ny);
          if (!hasEntity) {
            positions.push({ x: nx, y: ny });
          }
        }
      }
    }
    
    if (positions.length === 0) {
      // 无可用位置，跳过
      this.aiState = 'idle';
      return;
    }
    
    // 随机选一个位置
    const pos = positions[Math.floor(Math.random() * positions.length)];
    
    // 召唤动画
    await this.createSummonEffect(pos.x, pos.y);
    
    // 创建小妖精
    try {
      const minion = new SlowFairy(this.scene, pos.x, pos.y);
      minion.summoner = this;  // 记录召唤者
      minion.name = '召唤妖精';
      minion.hp = Math.floor(minion.hp * 0.6);  // 召唤物血量减少
      minion.maxHp = minion.hp;
      minion.sprite.setTint(0xccaaff);  // 淡紫色标记
      minion.sprite.setDepth(10);
      
      // 记录所属房间（继承召唤者的房间）
      minion.room = this.room;
      
      this.scene.enemies.push(minion);
      this.scene.actionQueue.addEntity(minion);
      
      this.summonedCount++;
      this.summonCooldown = 4;  // 4回合冷却
      
      this.scene.events.emit('showMessage', `${this.name}召唤了一只小妖精！`);
    } catch (e) {
      console.error('Summon failed:', e);
    }
  }
  
  /**
   * 召唤视觉效果
   */
  async createSummonEffect(tx, ty) {
    return new Promise(resolve => {
      try {
        const px = tx * TILE_SIZE + TILE_SIZE / 2;
        const py = ty * TILE_SIZE + TILE_SIZE / 2;
        
        // 魔法阵效果
        const circle = this.scene.add.graphics();
        circle.lineStyle(2, 0xaa66ff, 1);
        circle.strokeCircle(px, py, 4);
        circle.setDepth(12);
        
        this.scene.tweens.add({
          targets: circle,
          scaleX: 3,
          scaleY: 3,
          alpha: 0,
          duration: 400,
          onComplete: () => {
            circle.destroy();
            resolve();
          }
        });
        
        // 自身也闪烁一下
        this.scene.tweens.add({
          targets: this.sprite,
          alpha: 0.5,
          duration: 100,
          yoyo: true,
          repeat: 2
        });
      } catch (e) {
        resolve();
      }
    });
  }
  
  /**
   * 发射单发弹幕
   */
  async shootProjectile(player) {
    this.aiState = 'attack';
    const sx = this.pixelX, sy = this.pixelY;
    const tx = player.pixelX, ty = player.pixelY;
    if (this.scene.createLineWarning) {
      this.scene.createLineWarning(sx, sy, tx, ty, 200, 0xcc99ff);
    }
    await new Promise(r => this.scene.time.delayedCall(180, r));
    if (this.scene.bulletManager) {
      this.scene.bulletManager.fireAimed(sx, sy, tx, ty, 140, { damage: this.attack, texture: 'enemyBullet' });
    }
  }
  
  /**
   * 死亡时清理
   */
  die() {
    if (this.auraGraphic) {
      try { this.auraGraphic.destroy(); } catch (e) {}
    }
    super.die();
  }
  
  /**
   * 移动后更新光环位置
   */
  moveTo(tileX, tileY, animate = true) {
    const result = super.moveTo(tileX, tileY, animate);
    setTimeout(() => this.updateAuraPosition(), 100);
    return result;
  }
}
