/**
 * 幻想迷宫 - Gensokyo Labyrinth
 * 游戏入口文件
 */
import Phaser from 'phaser';
import { GAME_CONFIG } from './config/gameConfig.js';
import BootScene from './scenes/BootScene.js';
import PreloadScene from './scenes/PreloadScene.js';
import MainMenuScene from './scenes/MainMenuScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import UIScene from './scenes/UIScene.js';

// 创建游戏配置
const config = {
  ...GAME_CONFIG,
  scene: [BootScene, PreloadScene, MainMenuScene, GameScene, UIScene, MenuScene]
};

// 启动游戏
const game = new Phaser.Game(config);

// 调试模式下暴露到全局
if (import.meta.env.DEV) {
  window.game = game;
}
