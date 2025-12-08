/**
 * 弹幕妖精
 * 可以发射扇形弹幕
 */
import Enemy from '../Enemy.js';
import { ENEMY_CONFIG, TILE_SIZE } from '../../config/gameConfig.js';

export default class DanmakuFairy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'danmakuFairy', {
      name: ENEMY_CONFIG.danmakuFairy.name,
      hp: ENEMY_CONFIG.danmakuFairy.hp,
      attack: ENEMY_CONFIG.danmakuFairy.attack,
      defense: ENEMY_CONFIG.danmakuFairy.defense,
      speed: ENEMY_CONFIG.danmakuFairy.speed,
      expReward: ENEMY_CONFIG.danmakuFairy.expReward,
      detectionRange: 8,
      attackRange: 4  // 远程攻击范围
    });
    
    this.preferredDistance = 3; // 保持与玩家的理想距离
  }

  /**
   * 重写AI行动
   * @param {Player} player 
   */
  async act(player) {
    if (!this.isAlive || !player.isAlive) return;
    
    const distance = this.getDistanceTo(player);
    
    if (distance <= this.attackRange && distance >= 2) {
      // 在射程内且保持距离，发射弹幕
      await this.shootDanmaku(player);
    } else if (distance < 2) {
      // 太近了，后退
      await this.retreat(player);
    } else if (distance <= this.detectionRange) {
      // 接近到射程
      await this.approach(player);
    } else {
      await this.idle();
    }
  }

  /**
   * 发射扇形弹幕
   * @param {Player} player 
   */
  async shootDanmaku(player) {
    this.aiState = 'attack';
    
    const direction = this.getDirectionTo(player);
    
    // 计算扇形范围（3个方向）
    const hitPositions = this.calculateFanPositions(direction);
    
    // 视觉效果
    await this.createDanmakuEffect(hitPositions);
    
    // 检查玩家是否被命中
    for (const pos of hitPositions) {
      if (pos.x === player.tileX && pos.y === player.tileY) {
        const damage = player.takeDamage(this.attack);
        
        this.scene.events.emit('showDamage', {
          x: player.sprite.x,
          y: player.sprite.y - 20,
          damage: damage,
          isHeal: false
        });
        
        this.scene.events.emit('showMessage', `${this.name} 的弹幕命中灵梦！造成 ${damage} 点伤害！`);
        break;
      }
    }
  }

  /**
   * 计算扇形攻击位置
   * @param {Object} direction 
   * @returns {Array}
   */
  calculateFanPositions(direction) {
    const positions = [];
    
    // 主方向
    const mainDirs = [];
    
    if (direction.x !== 0 && direction.y !== 0) {
      // 斜向：使用斜向扇形
      mainDirs.push(direction);
      mainDirs.push({ x: direction.x, y: 0 });
      mainDirs.push({ x: 0, y: direction.y });
    } else if (direction.x !== 0) {
      // 水平方向
      mainDirs.push({ x: direction.x, y: 0 });
      mainDirs.push({ x: direction.x, y: -1 });
      mainDirs.push({ x: direction.x, y: 1 });
    } else {
      // 垂直方向
      mainDirs.push({ x: 0, y: direction.y });
      mainDirs.push({ x: -1, y: direction.y });
      mainDirs.push({ x: 1, y: direction.y });
    }
    
    // 为每个方向计算攻击路径
    for (const dir of mainDirs) {
      for (let dist = 1; dist <= this.attackRange; dist++) {
        const x = this.tileX + dir.x * dist;
        const y = this.tileY + dir.y * dist;
        
        // 检查是否撞墙
        if (!this.scene.mapManager.isWalkable(x, y)) break;
        
        positions.push({ x, y });
      }
    }
    
    return positions;
  }

  /**
   * 创建弹幕视觉效果
   * @param {Array} positions 
   */
  async createDanmakuEffect(positions) {
    const bullets = [];
    
    for (const pos of positions) {
      const bullet = this.scene.add.sprite(
        this.tileX * TILE_SIZE + TILE_SIZE / 2,
        this.tileY * TILE_SIZE + TILE_SIZE / 2,
        'enemyBullet'
      );
      bullets.push({ sprite: bullet, target: pos });
    }
    
    // 所有弹幕同时移动
    await Promise.all(bullets.map((bullet, index) => {
      return new Promise(resolve => {
        this.scene.tweens.add({
          targets: bullet.sprite,
          x: bullet.target.x * TILE_SIZE + TILE_SIZE / 2,
          y: bullet.target.y * TILE_SIZE + TILE_SIZE / 2,
          duration: 200,
          delay: index * 30,
          ease: 'Linear',
          onComplete: () => {
            // 命中效果
            const effect = this.scene.add.graphics();
            effect.fillStyle(0xb56bff, 0.5);
            effect.fillCircle(bullet.sprite.x, bullet.sprite.y, 12);
            
            this.scene.tweens.add({
              targets: effect,
              alpha: 0,
              duration: 150,
              onComplete: () => effect.destroy()
            });
            
            bullet.sprite.destroy();
            resolve();
          }
        });
      });
    }));
  }

  /**
   * 后退远离玩家
   * @param {Player} player 
   */
  async retreat(player) {
    this.aiState = 'retreat';
    
    const direction = this.getDirectionTo(player);
    
    // 尝试反方向移动
    const retreatDirs = [
      { x: -direction.x, y: -direction.y },
      { x: -direction.x, y: 0 },
      { x: 0, y: -direction.y }
    ];
    
    for (const dir of retreatDirs) {
      const newX = this.tileX + dir.x;
      const newY = this.tileY + dir.y;
      
      if (this.scene.canMoveTo(newX, newY) && !this.scene.getEnemyAt(newX, newY)) {
        await this.moveTo(newX, newY);
        return;
      }
    }
  }

  /**
   * 接近玩家到射程
   * @param {Player} player 
   */
  async approach(player) {
    // 使用基类的追逐逻辑
    await this.chasePlayer(player);
  }
}
