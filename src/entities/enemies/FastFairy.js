/**
 * 快速妖精
 * 速度为灵梦的两倍
 */
import Enemy from '../Enemy.js';
import { ENEMY_CONFIG } from '../../config/gameConfig.js';

export default class FastFairy extends Enemy {
  constructor(scene, x, y) {
    super(scene, x, y, 'fastFairy', {
      name: ENEMY_CONFIG.fastFairy.name,
      hp: ENEMY_CONFIG.fastFairy.hp,
      attack: ENEMY_CONFIG.fastFairy.attack,
      defense: ENEMY_CONFIG.fastFairy.defense,
      speed: ENEMY_CONFIG.fastFairy.speed,
      expReward: ENEMY_CONFIG.fastFairy.expReward,
      detectionRange: 10,
      attackRange: 1
    });
  }
}
