/**
 * 行动队列系统
 * 管理回合制战斗中的行动顺序
 */
import { ACTION_CONFIG } from '../config/gameConfig.js';

export default class ActionQueue {
  constructor() {
    this.entities = [];
    this.currentActor = null;
    this.turnCount = 0;
  }

  /**
   * 添加实体到队列
   * @param {Entity} entity - 要添加的实体
   */
  addEntity(entity) {
    if (!this.entities.includes(entity)) {
      entity.actionPoints = 0;
      this.entities.push(entity);
    }
  }

  /**
   * 从队列移除实体
   * @param {Entity} entity - 要移除的实体
   */
  removeEntity(entity) {
    const index = this.entities.indexOf(entity);
    if (index !== -1) {
      this.entities.splice(index, 1);
    }
    if (this.currentActor === entity) {
      this.currentActor = null;
    }
  }

  /**
   * 处理一个游戏回合
   * 增加所有实体的行动点数，返回可以行动的实体
   * @returns {Entity|null} 可以行动的实体
   */
  tick() {
    if (this.entities.length === 0) return null;

    // 如果当前没有可行动的实体，增加所有实体的AP
    while (!this.hasActionableEntity()) {
      for (const entity of this.entities) {
        if (entity.isAlive) {
          entity.actionPoints += entity.speed;
        }
      }
    }

    // 获取AP最高的实体
    const actor = this.getNextActor();
    this.currentActor = actor;
    
    return actor;
  }

  /**
   * 检查是否有实体可以行动
   * @returns {boolean}
   */
  hasActionableEntity() {
    return this.entities.some(
      entity => entity.isAlive && entity.actionPoints >= ACTION_CONFIG.threshold
    );
  }

  /**
   * 获取下一个行动的实体（AP最高的）
   * @returns {Entity|null}
   */
  getNextActor() {
    let maxAP = -1;
    let nextActor = null;

    for (const entity of this.entities) {
      if (entity.isAlive && entity.actionPoints >= ACTION_CONFIG.threshold) {
        // 优先玩家行动（相同AP时）
        if (entity.actionPoints > maxAP || 
            (entity.actionPoints === maxAP && entity.isPlayer)) {
          maxAP = entity.actionPoints;
          nextActor = entity;
        }
      }
    }

    return nextActor;
  }

  /**
   * 实体完成行动后调用
   * @param {Entity} entity - 完成行动的实体
   */
  endAction(entity) {
    if (entity) {
      entity.actionPoints -= ACTION_CONFIG.threshold;
      
      // 如果是玩家完成行动，增加回合计数
      if (entity.isPlayer) {
        this.turnCount++;
      }
    }
    this.currentActor = null;
  }

  /**
   * 获取当前回合数
   * @returns {number}
   */
  getTurnCount() {
    return this.turnCount;
  }

  /**
   * 清空队列
   */
  clear() {
    this.entities = [];
    this.currentActor = null;
    this.turnCount = 0;
  }

  /**
   * 获取所有存活的敌人
   * @returns {Entity[]}
   */
  getAliveEnemies() {
    return this.entities.filter(e => e.isAlive && !e.isPlayer);
  }

  /**
   * 调试：打印队列状态
   */
  debug() {
    console.log('=== Action Queue ===');
    console.log(`Turn: ${this.turnCount}`);
    for (const entity of this.entities) {
      console.log(`${entity.name}: AP=${entity.actionPoints}, Speed=${entity.speed}, Alive=${entity.isAlive}`);
    }
    console.log('====================');
  }
}
