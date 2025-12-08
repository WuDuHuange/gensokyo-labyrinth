/**
 * 敌人基类
 */
import Entity from './Entity.js';
import { TILE_SIZE } from '../config/gameConfig.js';

export default class Enemy extends Entity {
  constructor(scene, x, y, texture, config) {
    super(scene, x, y, texture, config);
    
    this.isPlayer = false;
    this.aiState = 'idle'; // idle, chase, attack, retreat
    this.detectionRange = config.detectionRange || 8;
    this.attackRange = config.attackRange || 1;
    this.expReward = config.expReward || 10;
  }

  /**
   * AI行动
   * @param {Player} player 
   */
  async act(player) {
    if (!this.isAlive || !player.isAlive) return;
    
    const distance = this.getDistanceTo(player);
    
    // 根据距离决定行为
    if (distance <= this.attackRange) {
      // 在攻击范围内，攻击玩家
      await this.attackPlayer(player);
    } else if (distance <= this.detectionRange) {
      // 在检测范围内，追逐玩家
      await this.chasePlayer(player);
    } else {
      // 超出范围，随机移动或待命
      await this.idle();
    }
  }

  /**
   * 攻击玩家
   * @param {Player} player 
   */
  async attackPlayer(player) {
    this.aiState = 'attack';
    
    // 攻击动画
    const dx = player.tileX - this.tileX;
    const dy = player.tileY - this.tileY;
    
    await new Promise(resolve => {
      this.scene.tweens.add({
        targets: this.sprite,
        x: this.sprite.x + dx * 8,
        y: this.sprite.y + dy * 8,
        duration: 50,
        yoyo: true,
        onComplete: resolve
      });
    });
    
    // 造成伤害
    const damage = player.takeDamage(this.attack);
    
    // 显示伤害数字
    this.scene.events.emit('showDamage', {
      x: player.sprite.x,
      y: player.sprite.y - 20,
      damage: damage,
      isHeal: false
    });
    
    this.scene.events.emit('showMessage', `${this.name} 攻击灵梦，造成 ${damage} 点伤害！`);
  }

  /**
   * 追逐玩家
   * @param {Player} player 
   */
  async chasePlayer(player) {
    this.aiState = 'chase';
    
    const direction = this.getDirectionTo(player);
    
    // 尝试向玩家移动
    // 优先选择距离更近的方向
    const moves = this.getPossibleMoves(player);
    
    if (moves.length > 0) {
      // 选择最优移动
      const bestMove = moves[0];
      await this.moveTo(bestMove.x, bestMove.y);
    }
  }

  /**
   * 获取可能的移动选项，按优先级排序
   * @param {Player} player 
   * @returns {Array}
   */
  getPossibleMoves(player) {
    const directions = [
      { x: 0, y: -1 },  // 上
      { x: 0, y: 1 },   // 下
      { x: -1, y: 0 },  // 左
      { x: 1, y: 0 }    // 右
    ];
    
    const moves = [];
    
    for (const dir of directions) {
      const newX = this.tileX + dir.x;
      const newY = this.tileY + dir.y;
      
      // 检查是否可以移动
      if (this.scene.canMoveTo(newX, newY) && !this.scene.getEnemyAt(newX, newY)) {
        // 如果目标位置是玩家位置，跳过（应该攻击而不是移动）
        if (newX === player.tileX && newY === player.tileY) continue;
        
        // 计算移动后到玩家的距离
        const newDistance = Math.abs(newX - player.tileX) + Math.abs(newY - player.tileY);
        moves.push({ x: newX, y: newY, distance: newDistance });
      }
    }
    
    // 按距离排序
    moves.sort((a, b) => a.distance - b.distance);
    
    return moves;
  }

  /**
   * 空闲行为
   */
  async idle() {
    this.aiState = 'idle';
    
    // 30%概率随机移动
    if (Math.random() < 0.3) {
      const directions = [
        { x: 0, y: -1 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
        { x: 1, y: 0 }
      ];
      
      // 随机打乱方向
      directions.sort(() => Math.random() - 0.5);
      
      for (const dir of directions) {
        const newX = this.tileX + dir.x;
        const newY = this.tileY + dir.y;
        
        if (this.scene.canMoveTo(newX, newY) && !this.scene.getEnemyAt(newX, newY)) {
          await this.moveTo(newX, newY);
          break;
        }
      }
    }
  }
}
