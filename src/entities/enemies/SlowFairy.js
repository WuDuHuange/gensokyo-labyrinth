/**
 * 慢速妖精
 * 速度为灵梦的一半
 */
import Enemy from '../Enemy.js';
import { ENEMY_CONFIG } from '../../config/gameConfig.js';

export default class SlowFairy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'slowFairy', {
      name: ENEMY_CONFIG.slowFairy.name,
      hp: ENEMY_CONFIG.slowFairy.hp,
      attack: ENEMY_CONFIG.slowFairy.attack,
      defense: ENEMY_CONFIG.slowFairy.defense,
      speed: ENEMY_CONFIG.slowFairy.speed,
      expReward: ENEMY_CONFIG.slowFairy.expReward,
      detectionRange: 6,
      attackRange: 1
    });
  }
}
