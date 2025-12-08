/**
 * 普通妖精
 * 速度与灵梦相同
 */
import Enemy from '../Enemy.js';
import { ENEMY_CONFIG } from '../../config/gameConfig.js';

export default class NormalFairy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'normalFairy', {
      name: ENEMY_CONFIG.normalFairy.name,
      hp: ENEMY_CONFIG.normalFairy.hp,
      attack: ENEMY_CONFIG.normalFairy.attack,
      defense: ENEMY_CONFIG.normalFairy.defense,
      speed: ENEMY_CONFIG.normalFairy.speed,
      expReward: ENEMY_CONFIG.normalFairy.expReward,
      detectionRange: 8,
      attackRange: 1
    });
  }
}
