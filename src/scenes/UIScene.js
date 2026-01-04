/**
 * UI场景 - 显示游戏HUD
 * 重构版：支持装备、天赋、金币、Boss阶段等新系统显示
 */
import { PLAYER_CONFIG, ITEM_CONFIG } from '../config/gameConfig.js';
import { TileType } from '../systems/MapGenerator.js';
import { EQUIPMENT_CONFIG } from '../systems/EquipmentSystem.js';
import { TALENT_CONFIG } from '../systems/TalentSystem.js';

export default class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
    this.playerStats = null;
    // Boss UI 相关
    this.bossHealthBar = null;
    this.bossPhaseText = null;
    this.currentBoss = null;
  }

  create() {
    // 初始化玩家数据显示
    this.createHUD();
    
    // 监听游戏场景的事件
    const gameScene = this.scene.get('GameScene');
    
    gameScene.events.on('updateStats', (stats) => {
      this.updateStats(stats);
    });

    gameScene.events.on('showMessage', (message) => {
      this.showMessage(message);
    });

    gameScene.events.on('showDamage', (data) => {
      this.showDamageNumber(data);
    });
    
    // 打开符卡切换菜单的事件（由 MenuScene 或其他触发）
    gameScene.events.on('openSpellMenu', () => {
      this.openSpellMenuOverlay();
    });
    
    // Boss 战事件
    gameScene.events.on('bossEncounter', (boss) => {
      this.showBossUI(boss);
    });
    
    gameScene.events.on('bossDefeated', () => {
      this.hideBossUI();
    });
    
    gameScene.events.on('bossPhaseChange', (data) => {
      this.updateBossPhase(data);
    });
  }

  createHUD() {
    const padding = 10;
    const panelWidth = 220;
    const panelHeight = 180;
    
    // 主背景面板（扩大以容纳更多信息）
    this.hudBg = this.add.graphics();
    this.hudBg.fillStyle(0x0a0a12, 0.85);
    this.hudBg.fillRoundedRect(padding, padding, panelWidth, panelHeight, 10);
    this.hudBg.lineStyle(2, 0x4a4a6a, 0.6);
    this.hudBg.strokeRoundedRect(padding, padding, panelWidth, panelHeight, 10);

    // 角色名 + 层数
    this.add.text(padding + 12, padding + 10, '博丽灵梦', {
      fontSize: '15px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#e94560'
    });
    
    this.floorText = this.add.text(padding + panelWidth - 12, padding + 10, '1F', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#88aaff'
    }).setOrigin(1, 0);

    // HP条背景 + 装饰
    const hpBarY = padding + 32;
    this.add.graphics()
      .fillStyle(0x1a1a2a)
      .fillRoundedRect(padding + 12, hpBarY, panelWidth - 24, 18, 4);

    // HP条
    this.hpBar = this.add.graphics();
    this.hpBarWidth = panelWidth - 28;
    this.hpBarX = padding + 14;
    this.hpBarY = hpBarY + 2;
    this.updateHPBar(PLAYER_CONFIG.maxHp, PLAYER_CONFIG.maxHp);

    // HP图标和文字
    this.add.text(padding + 16, hpBarY + 2, '♥', { fontSize: '12px', color: '#ff6b6b' });
    this.hpText = this.add.text(padding + panelWidth / 2, hpBarY + 3, `${PLAYER_CONFIG.maxHp}/${PLAYER_CONFIG.maxHp}`, {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5, 0);

    // MP条背景
    const mpBarY = padding + 54;
    this.add.graphics()
      .fillStyle(0x1a1a2a)
      .fillRoundedRect(padding + 12, mpBarY, panelWidth - 24, 18, 4);

    // MP条
    this.mpBar = this.add.graphics();
    this.mpBarWidth = panelWidth - 28;
    this.mpBarX = padding + 14;
    this.mpBarY = mpBarY + 2;
    this.updateMPBar(PLAYER_CONFIG.maxMp, PLAYER_CONFIG.maxMp);

    // MP图标和文字
    this.add.text(padding + 16, mpBarY + 2, '✦', { fontSize: '11px', color: '#6b9fff' });
    this.mpText = this.add.text(padding + panelWidth / 2, mpBarY + 3, `${PLAYER_CONFIG.maxMp}/${PLAYER_CONFIG.maxMp}`, {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5, 0);

    // 分隔线
    this.add.graphics()
      .lineStyle(1, 0x4a4a6a, 0.4)
      .lineBetween(padding + 12, padding + 78, padding + panelWidth - 12, padding + 78);

    // 金币显示
    this.goldText = this.add.text(padding + 16, padding + 84, '💰 0', {
      fontSize: '13px',
      fontFamily: 'Arial',
      color: '#ffd700'
    });

    // 回合数显示
    this.turnText = this.add.text(padding + panelWidth - 16, padding + 84, '回合 0', {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#888899'
    }).setOrigin(1, 0);

    // 装备槽区域（2个饰品槽）
    this.createEquipmentSlots(padding + 12, padding + 106, panelWidth - 24);

    // 天赋图标栏
    this.createTalentBar(padding + 12, padding + 148, panelWidth - 24);

    // 地面物品提示（移到面板下方）
    this.groundItemText = this.add.text(padding + 12, padding + panelHeight + 8, '', {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#fff2b0'
    });

    // 符卡显示
    this.createSpellCardUI();

    // 小地图（右上角）
    this.createMinimap();

    // 消息日志（底部）
    this.createMessageLog();
    
    // Boss 血条（初始隐藏）
    this.createBossUI();
    
    // 操作提示面板（左下角）
    this.createControlHints();
  }
  
  /**
   * 创建装备槽显示
   */
  createEquipmentSlots(x, y, width) {
    const slotSize = 32;
    const gap = 8;
    
    // 装备槽标题
    this.add.text(x, y, '装备', {
      fontSize: '10px',
      fontFamily: 'Arial',
      color: '#888899'
    });
    
    // 两个饰品槽
    this.equipSlots = [];
    this.equipSlotIcons = [];
    this.equipSlotTooltips = [];
    
    for (let i = 0; i < 2; i++) {
      const slotX = x + 40 + i * (slotSize + gap);
      const slotY = y - 2;
      
      // 槽位背景
      const slot = this.add.graphics();
      slot.fillStyle(0x1a1a2a, 1);
      slot.fillRoundedRect(slotX, slotY, slotSize, slotSize, 4);
      slot.lineStyle(1, 0x4a4a6a, 0.8);
      slot.strokeRoundedRect(slotX, slotY, slotSize, slotSize, 4);
      this.equipSlots.push(slot);
      
      // 空槽位文字
      const icon = this.add.text(slotX + slotSize / 2, slotY + slotSize / 2, i === 0 ? '饰' : '饰', {
        fontSize: '12px',
        fontFamily: 'Arial',
        color: '#444455'
      }).setOrigin(0.5);
      this.equipSlotIcons.push(icon);
    }
  }
  
  /**
   * 更新装备槽显示
   */
  updateEquipmentSlots() {
    const gameScene = this.scene.get('GameScene');
    if (!gameScene || !gameScene.equipmentSystem) return;
    
    const equipped = gameScene.equipmentSystem.equippedAccessories || [];
    
    for (let i = 0; i < 2; i++) {
      const equip = equipped[i];
      const icon = this.equipSlotIcons[i];
      const slot = this.equipSlots[i];
      
      if (equip) {
        const cfg = EQUIPMENT_CONFIG[equip];
        if (cfg) {
          // 根据稀有度设置颜色
          let color = '#ffffff';
          let borderColor = 0x4a4a6a;
          if (cfg.rarity === 'rare') { color = '#6b9fff'; borderColor = 0x6b9fff; }
          else if (cfg.rarity === 'epic') { color = '#bf6bff'; borderColor = 0xbf6bff; }
          
          icon.setText(cfg.name.charAt(0));
          icon.setColor(color);
          
          // 更新边框
          slot.clear();
          slot.fillStyle(0x1a1a2a, 1);
          slot.fillRoundedRect(slot.x || 0, slot.y || 0, 32, 32, 4);
          slot.lineStyle(2, borderColor, 0.9);
          slot.strokeRoundedRect(slot.x || 0, slot.y || 0, 32, 32, 4);
        }
      } else {
        icon.setText('饰');
        icon.setColor('#444455');
      }
    }
  }
  
  /**
   * 创建天赋图标栏
   */
  createTalentBar(x, y, width) {
    // 天赋标题
    this.add.text(x, y, '天赋', {
      fontSize: '10px',
      fontFamily: 'Arial',
      color: '#888899'
    });
    
    // 天赋图标容器
    this.talentIcons = [];
    this.talentContainer = this.add.container(x + 40, y - 2);
    
    // 初始显示空白
    this.talentCountText = this.add.text(x + 40, y, '无', {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#555566'
    });
  }
  
  /**
   * 更新天赋显示
   */
  updateTalentBar() {
    const gameScene = this.scene.get('GameScene');
    if (!gameScene || !gameScene.talentSystem) return;
    
    const talents = gameScene.talentSystem.acquiredTalents || [];
    
    // 清除旧图标
    this.talentContainer.removeAll(true);
    
    if (talents.length === 0) {
      this.talentCountText.setText('无');
      this.talentCountText.setVisible(true);
    } else {
      this.talentCountText.setVisible(false);
      
      // 显示天赋图标（最多显示6个，多余的显示+N）
      const maxShow = 6;
      const iconSize = 20;
      const gap = 4;
      
      for (let i = 0; i < Math.min(talents.length, maxShow); i++) {
        const cfg = TALENT_CONFIG[talents[i]];
        if (!cfg) continue;
        
        // 根据类型设置颜色
        let color = '#ffffff';
        if (cfg.type === 'attack') color = '#ff6b6b';
        else if (cfg.type === 'defense') color = '#6bff6b';
        else if (cfg.type === 'utility') color = '#6b9fff';
        
        const icon = this.add.text(i * (iconSize + gap), 0, cfg.name.charAt(0), {
          fontSize: '11px',
          fontFamily: 'Arial',
          color: color,
          backgroundColor: '#1a1a2a',
          padding: { x: 4, y: 2 }
        });
        this.talentContainer.add(icon);
      }
      
      // 如果有更多天赋
      if (talents.length > maxShow) {
        const moreText = this.add.text(maxShow * (iconSize + gap), 0, `+${talents.length - maxShow}`, {
          fontSize: '10px',
          fontFamily: 'Arial',
          color: '#888899'
        });
        this.talentContainer.add(moreText);
      }
    }
  }
  
  /**
   * 创建 Boss 血条 UI（初始隐藏）
   */
  createBossUI() {
    const width = this.cameras.main.width;
    const bossBarWidth = 400;
    const bossBarHeight = 24;
    const bossBarX = (width - bossBarWidth) / 2;
    const bossBarY = 20;
    
    // Boss UI 容器
    this.bossUIContainer = this.add.container(0, 0);
    this.bossUIContainer.setVisible(false);
    
    // 背景
    const bossBg = this.add.graphics();
    bossBg.fillStyle(0x0a0a12, 0.9);
    bossBg.fillRoundedRect(bossBarX - 10, bossBarY - 30, bossBarWidth + 20, bossBarHeight + 50, 8);
    bossBg.lineStyle(2, 0x8b4a8b, 0.8);
    bossBg.strokeRoundedRect(bossBarX - 10, bossBarY - 30, bossBarWidth + 20, bossBarHeight + 50, 8);
    this.bossUIContainer.add(bossBg);
    
    // Boss 名字
    this.bossNameText = this.add.text(width / 2, bossBarY - 20, '', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#ff66ff'
    }).setOrigin(0.5);
    this.bossUIContainer.add(this.bossNameText);
    
    // 血条背景
    const hpBg = this.add.graphics();
    hpBg.fillStyle(0x1a1a2a);
    hpBg.fillRoundedRect(bossBarX, bossBarY, bossBarWidth, bossBarHeight, 4);
    this.bossUIContainer.add(hpBg);
    
    // 血条
    this.bossHpBar = this.add.graphics();
    this.bossHpBarX = bossBarX + 2;
    this.bossHpBarY = bossBarY + 2;
    this.bossHpBarWidth = bossBarWidth - 4;
    this.bossHpBarHeight = bossBarHeight - 4;
    this.bossUIContainer.add(this.bossHpBar);
    
    // 血量文字
    this.bossHpText = this.add.text(width / 2, bossBarY + bossBarHeight / 2, '', {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.bossUIContainer.add(this.bossHpText);
    
    // 阶段指示器
    this.bossPhaseContainer = this.add.container(bossBarX, bossBarY + bossBarHeight + 8);
    this.bossUIContainer.add(this.bossPhaseContainer);
    
    // 阶段状态文字
    this.bossPhaseText = this.add.text(width / 2, bossBarY + bossBarHeight + 12, '', {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#ffaa66'
    }).setOrigin(0.5);
    this.bossUIContainer.add(this.bossPhaseText);
  }
  
  /**
   * 显示 Boss UI
   */
  showBossUI(boss) {
    this.currentBoss = boss;
    this.bossUIContainer.setVisible(true);
    
    this.bossNameText.setText(`◆ ${boss.name} ◆`);
    this.updateBossHP(boss.hp, boss.maxHp);
    this.updateBossPhase({ phase: boss.phase || 1, shieldActive: boss.shieldActive });
    
    // 入场动画
    this.bossUIContainer.setAlpha(0);
    this.tweens.add({
      targets: this.bossUIContainer,
      alpha: 1,
      duration: 500,
      ease: 'Power2'
    });
  }
  
  /**
   * 隐藏 Boss UI
   */
  hideBossUI() {
    this.tweens.add({
      targets: this.bossUIContainer,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        this.bossUIContainer.setVisible(false);
        this.currentBoss = null;
      }
    });
  }
  
  /**
   * 更新 Boss 血条
   */
  updateBossHP(current, max) {
    const percent = Math.max(0, current / max);
    
    // 根据血量决定颜色
    let color = 0xbf6bff; // 紫色
    if (percent <= 0.3) color = 0xff4444; // 红色（狂暴）
    else if (percent <= 0.6) color = 0xff8844; // 橙色（阶段2）
    
    this.bossHpBar.clear();
    this.bossHpBar.fillStyle(color, 1);
    this.bossHpBar.fillRoundedRect(
      this.bossHpBarX,
      this.bossHpBarY,
      this.bossHpBarWidth * percent,
      this.bossHpBarHeight,
      3
    );
    
    this.bossHpText.setText(`${current}/${max}`);
  }
  
  /**
   * 更新 Boss 阶段显示
   */
  updateBossPhase(data) {
    const { phase, shieldActive } = data;
    
    // 清除旧的阶段指示器
    this.bossPhaseContainer.removeAll(true);
    
    // 创建阶段点
    const phases = ['I', 'II', 'III'];
    const dotSize = 24;
    const gap = 8;
    const startX = (400 - (phases.length * dotSize + (phases.length - 1) * gap)) / 2;
    
    for (let i = 0; i < phases.length; i++) {
      const isActive = (i + 1) === phase;
      const isPast = (i + 1) < phase;
      
      let bgColor = 0x1a1a2a;
      let textColor = '#555566';
      let borderColor = 0x3a3a4a;
      
      if (isActive) {
        bgColor = 0x8b4a8b;
        textColor = '#ffffff';
        borderColor = 0xbf6bff;
      } else if (isPast) {
        bgColor = 0x4a2a4a;
        textColor = '#888888';
        borderColor = 0x6a4a6a;
      }
      
      const dot = this.add.graphics();
      dot.fillStyle(bgColor, 1);
      dot.fillRoundedRect(startX + i * (dotSize + gap), 0, dotSize, dotSize, 4);
      dot.lineStyle(2, borderColor, 0.9);
      dot.strokeRoundedRect(startX + i * (dotSize + gap), 0, dotSize, dotSize, 4);
      this.bossPhaseContainer.add(dot);
      
      const text = this.add.text(startX + i * (dotSize + gap) + dotSize / 2, dotSize / 2, phases[i], {
        fontSize: '12px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        color: textColor
      }).setOrigin(0.5);
      this.bossPhaseContainer.add(text);
    }
    
    // 状态文字
    let statusText = '';
    if (phase === 1) statusText = '普通阶段';
    else if (phase === 2) statusText = shieldActive ? '⚡ 护盾启动' : '强化阶段';
    else if (phase === 3) statusText = '🔥 狂暴模式';
    
    this.bossPhaseText.setText(statusText);
  }

  createSpellCardUI() {
    const width = this.cameras.main.width;
    const padding = 10;
    const panelWidth = 200;
    const panelHeight = 115;

    // 符卡面板背景（美化）
    const spellBg = this.add.graphics();
    spellBg.fillStyle(0x0a0a12, 0.85);
    spellBg.fillRoundedRect(width - panelWidth - padding, padding, panelWidth, panelHeight, 10);
    spellBg.lineStyle(2, 0x4a4a6a, 0.6);
    spellBg.strokeRoundedRect(width - panelWidth - padding, padding, panelWidth, panelHeight, 10);
    
    // 标题
    this.add.text(width - panelWidth / 2 - padding, padding + 8, '符卡', {
      fontSize: '12px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#bf6bff'
    }).setOrigin(0.5);

    // 快捷槽显示（Z/X/C）及对应符卡名/冷却显示
    this.spellSlotTexts = [];
    this.spellSlotCd = [];
    this.spellSlotBgs = [];
    const slotX = width - panelWidth + padding;
    const baseY = padding + 28;
    const slotLabels = ['Z', 'X', 'C'];
    const slotHeight = 26;
    
    for (let i = 0; i < 3; i++) {
      // 槽位背景（用于显示冷却状态）
      const bg = this.add.graphics();
      bg.fillStyle(0x1a1a2a, 0.6);
      bg.fillRoundedRect(slotX - 4, baseY + i * slotHeight - 2, panelWidth - 22, slotHeight - 4, 3);
      this.spellSlotBgs.push(bg);
      
      // 快捷键标识
      this.add.text(slotX, baseY + i * slotHeight, `[${slotLabels[i]}]`, {
        fontSize: '10px',
        fontFamily: 'Arial',
        color: '#888899'
      });
      
      // 符卡名
      this.spellSlotTexts[i] = this.add.text(slotX + 28, baseY + i * slotHeight, '-', {
        fontSize: '11px',
        fontFamily: 'Arial',
        color: '#ffffff'
      });
      
      // 冷却/消耗
      this.spellSlotCd[i] = this.add.text(width - padding - 16, baseY + i * slotHeight, '', {
        fontSize: '10px',
        fontFamily: 'Arial',
        color: '#aaaaaa'
      }).setOrigin(1, 0);
    }

    // 初始化显示
    this.updateSpellUI();
  }

  updateSpellUI() {
    const game = this.scene.get('GameScene');
    if (!game || !game.spellCardSystem || !game.player) return;
    const status = game.spellCardSystem.getStatus();
    
    for (let i = 0; i < 3; i++) {
      const mappedIndex = (game.player.quickSlots && game.player.quickSlots[i] !== undefined) ? game.player.quickSlots[i] : i;
      const s = status[mappedIndex] || { name: '未知', mpCost: 0, cooldown: 0, maxCooldown: 0 };
      
      this.spellSlotTexts[i].setText(s.name);
      
      // 根据冷却状态设置颜色
      if (s.cooldown > 0) {
        this.spellSlotCd[i].setText(`${s.cooldown}回合`);
        this.spellSlotCd[i].setColor('#ff6b6b');
        this.spellSlotTexts[i].setColor('#666677');
      } else {
        this.spellSlotCd[i].setText(`${s.mpCost}MP`);
        this.spellSlotCd[i].setColor('#6b9fff');
        this.spellSlotTexts[i].setColor('#ffffff');
      }
    }
  }

  openSpellMenuOverlay() {
    const game = this.scene.get('GameScene');
    if (!game || !game.spellCardSystem) return;

    // 若已存在覆盖层，移除
    try { if (this.spellMenuContainer) { this.spellMenuContainer.destroy(true); this.spellMenuContainer = null; } } catch (e) {}

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const container = this.add.container(0,0);
    const overlay = this.add.rectangle(0,0,width*2,height*2,0x000000,0.6).setOrigin(0);
    container.add(overlay);

    const boxW = 480, boxH = 360;
    const box = this.add.rectangle(width/2, height/2, boxW, boxH, 0x0f0f16, 1.0);
    box.setStrokeStyle(2, 0xffffff, 0.12);
    container.add(box);

    const title = this.add.text(width/2, height/2 - boxH/2 + 24, '符卡配置', { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    container.add(title);

    const spells = game.spellCardSystem.getStatus();
    // 显示所有可用符卡，并为每个符卡添加 3 个按钮分配到槽位
    for (let si = 0; si < spells.length; si++) {
      const s = spells[si];
      const y = height/2 - boxH/2 + 64 + si * 36;
      const nameTxt = this.add.text(width/2 - 160, y, s.name, { fontSize: '16px', color: '#ffffff' }).setOrigin(0,0.5);
      container.add(nameTxt);

      // 创建三个小按钮（Z/X/C）用于分配
      const labels = ['Z','X','C'];
      for (let slot = 0; slot < 3; slot++) {
        const btn = this.add.text(width/2 + (slot*60) - 20, y, labels[slot], { fontSize: '14px', color: '#ffffff', backgroundColor: '#222222' }).setOrigin(0.5).setInteractive();
        btn.on('pointerover', () => { try { btn.setStyle({ backgroundColor: '#335533', color: '#88ff88' }); } catch(e) {} });
        btn.on('pointerout', () => { try { btn.setStyle({ backgroundColor: '#222222', color: '#ffffff' }); } catch(e) {} });
        (function(sIndex, slotIndex, selfRef) {
          btn.on('pointerdown', function() {
            try { game.player.setQuickSlot(slotIndex, sIndex); } catch (e) {}
            // 更新 HUD 显示
            selfRef.updateSpellUI();
          });
        })(si, slot, this);
        container.add(btn);
      }
    }

    const close = this.add.text(width/2, height/2 + boxH/2 - 30, '返回 (ESC)', { fontSize: '18px', color: '#aaffaa' }).setOrigin(0.5).setInteractive();
    const selfRef = this;
    const closeMenu = () => { 
      try { 
        selfRef.input.keyboard.off('keydown-ESC', closeMenu);
        container.destroy(true); 
        selfRef.spellMenuContainer = null; 
      } catch(e) {} 
    };
    close.on('pointerdown', closeMenu);
    container.add(close);
    
    // 监听ESC键直接关闭
    this.input.keyboard.on('keydown-ESC', closeMenu);

    this.spellMenuContainer = container;
  }

  createMinimap() {
    const width = this.cameras.main.width;
    const minimapSize = 150;
    const padding = 10;
    
    // 小地图位置（在符卡面板下方）
    this.minimapX = width - minimapSize - padding;
    this.minimapY = 140;
    this.minimapSize = minimapSize;

    // 小地图背景（保存为实例属性以便拖拽）
    this.minimapBg = this.add.graphics();
    this.minimapBg.fillStyle(0x0a0a12, 0.85);
    this.minimapBg.fillRoundedRect(this.minimapX, this.minimapY - 15, minimapSize, minimapSize + 20, 10);
    this.minimapBg.lineStyle(2, 0x4a4a6a, 0.6);
    this.minimapBg.strokeRoundedRect(this.minimapX, this.minimapY - 15, minimapSize, minimapSize + 20, 10);

    // 标题（保存引用以便更新位置）
    this.minimapTitle = this.add.text(this.minimapX + minimapSize / 2, this.minimapY - 8, '小地图', {
      fontSize: '10px',
      fontFamily: 'Arial',
      color: '#888899'
    }).setOrigin(0.5, 0);

    // 小地图绘制图形
    this.minimapGraphics = this.add.graphics();
    
    // 获取游戏场景引用
    const gameScene = this.scene.get('GameScene');
    
    // 保存最后一次小地图数据以便拖动时重绘
    this._lastMinimapData = null;
    // 监听小地图更新事件
    gameScene.events.on('updateMinimap', (data) => {
      this._lastMinimapData = data;
      this.drawMinimap(data);
    });

    // 使小地图背景可交互并可拖拽
    try {
      this.minimapBg.setInteractive(new Phaser.Geom.Rectangle(this.minimapX, this.minimapY - 15, minimapSize, minimapSize + 15), Phaser.Geom.Rectangle.Contains);
      this.input.setDraggable(this.minimapBg);

      this.input.on('dragstart', (pointer, gameObject) => {
        if (gameObject !== this.minimapBg) return;
        this._minimapDragOffsetX = pointer.x - this.minimapX;
        this._minimapDragOffsetY = pointer.y - this.minimapY;
      });

      this.input.on('drag', (pointer, gameObject) => {
        if (gameObject !== this.minimapBg) return;
        const camW = this.cameras.main.width;
        const camH = this.cameras.main.height;
        let nx = pointer.x - this._minimapDragOffsetX;
        let ny = pointer.y - this._minimapDragOffsetY;
        // 边界约束
        nx = Phaser.Math.Clamp(nx, 0, camW - minimapSize);
        ny = Phaser.Math.Clamp(ny, 20, camH - minimapSize);
        this.minimapX = nx;
        this.minimapY = ny;

        // 重新绘制背景与标题位置
        this.minimapBg.clear();
        this.minimapBg.fillStyle(0x0a0a12, 0.85);
        this.minimapBg.fillRoundedRect(this.minimapX, this.minimapY - 15, minimapSize, minimapSize + 20, 10);
        this.minimapBg.lineStyle(2, 0x4a4a6a, 0.6);
        this.minimapBg.strokeRoundedRect(this.minimapX, this.minimapY - 15, minimapSize, minimapSize + 20, 10);
        this.minimapTitle.setPosition(this.minimapX + minimapSize / 2, this.minimapY - 8);

        // 重新设置 interactive 区域（因为位置改变）
        try { this.minimapBg.input.hitArea.setTo(this.minimapX, this.minimapY - 15, minimapSize, minimapSize + 15); } catch (e) {}

        // 重新绘制小地图内容
        if (this._lastMinimapData) this.drawMinimap(this._lastMinimapData);
      });
    } catch (e) {
      // 如果运行环境不支持交互（极少数情况），忽略拖拽功能
    }
  }

  /**
   * 绘制小地图
   */
  drawMinimap(data) {
    if (!this.minimapGraphics) return;
    
    this.minimapGraphics.clear();
    
    const { mapData, player, enemies, exitPoint } = data;
    if (!mapData || !player) return;
    
    const mapWidth = mapData.width;
    const mapHeight = mapData.height;
    
    // 计算缩放比例
    const scale = (this.minimapSize - 10) / Math.max(mapWidth, mapHeight);
    const offsetX = this.minimapX + 5;
    const offsetY = this.minimapY + 5;
    
    // 使用迷雾信息绘制瓦片：只显示已探索的地板，当前可见用亮色，已探索但不可见用暗色
    const fog = data.fog || null;
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const tile = (mapData.tiles[y] && mapData.tiles[y][x]) ? mapData.tiles[y][x] : TileType.WALL;
        if (tile !== TileType.FLOOR && tile !== TileType.SPAWN && tile !== TileType.EXIT) continue;

        const explored = fog && fog.explored && fog.explored[y] ? !!fog.explored[y][x] : true;
        const visible = fog && fog.visible && fog.visible[y] ? !!fog.visible[y][x] : true;

        if (!explored) continue; // 未探索则不绘制

        if (visible) this.minimapGraphics.fillStyle(0x6b88ff, 1); // 可见：亮蓝色（走廊/房间）
        else this.minimapGraphics.fillStyle(0x2b2b3b, 1); // 已探索但不可见：暗色

        this.minimapGraphics.fillRect(
          offsetX + x * scale,
          offsetY + y * scale,
          Math.max(1, scale),
          Math.max(1, scale)
        );
      }
    }
    
    // 绘制特殊房间标记（危险房间红色边框、战斗房间橙色边框）
    if (mapData.rooms) {
      for (const room of mapData.rooms) {
        // 只绘制已探索的房间（房间中心点可见或已探索）
        const rx = room.centerX, ry = room.centerY;
        const roomExplored = fog && fog.explored && fog.explored[ry] ? !!fog.explored[ry][rx] : true;
        if (!roomExplored) continue;
        
        let borderColor = null;
        let fillColor = null;
        
        if (room.type === 'danger') {
          borderColor = room.cleared ? 0x664444 : 0xff4444;  // 红色，已清理变暗
          fillColor = room.cleared ? 0x331111 : 0x440000;
        } else if (room.type === 'combat') {
          borderColor = room.cleared ? 0x664422 : 0xffaa44;  // 橙色，已清理变暗
          fillColor = room.cleared ? 0x221100 : 0x442200;
        } else if (room.type === 'boss') {
          borderColor = 0xff44ff; // 紫色
          fillColor = 0x330033;
        } else if (room.type === 'resource') {
          borderColor = 0x44ff44; // 绿色
          fillColor = 0x003300;
        }
        
        if (borderColor) {
          // 绘制房间边框
          this.minimapGraphics.lineStyle(1, borderColor, 0.8);
          this.minimapGraphics.strokeRect(
            offsetX + room.x * scale,
            offsetY + room.y * scale,
            room.width * scale,
            room.height * scale
          );
        }
      }
    }
    
    // 绘制出口（遵循迷雾：仅在已探索时显示，可见时更亮）
    if (exitPoint) {
      const ex = exitPoint.x;
      const ey = exitPoint.y;
      const exploredExit = fog && fog.explored && fog.explored[ey] ? !!fog.explored[ey][ex] : true;
      const visibleExit = fog && fog.visible && fog.visible[ey] ? !!fog.visible[ey][ex] : true;
      if (exploredExit) {
        this.minimapGraphics.fillStyle(visibleExit ? 0x00ff88 : 0x007a44, 1);
        this.minimapGraphics.fillRect(
          offsetX + ex * scale - 2,
          offsetY + ey * scale - 2,
          4,
          4
        );
      }
    }

    // 绘制敌人（仅在当前可见时显示，迷雾遮挡敌人）
    if (enemies) {
      this.minimapGraphics.fillStyle(0xff6666, 1);
      for (const enemy of enemies) {
        try {
          const ex = enemy.tileX;
          const ey = enemy.tileY;
          const isVis = fog && fog.visible && fog.visible[ey] ? !!fog.visible[ey][ex] : true;
          if (enemy.isAlive && isVis) {
            this.minimapGraphics.fillRect(
              offsetX + ex * scale - 1,
              offsetY + ey * scale - 1,
              2,
              2
            );
          }
        } catch (e) {
          // ignore invalid enemy data
        }
      }
    }
    
    // 绘制地面物品（仅在当前可见时显示）
    if (data.items) {
      this.minimapGraphics.fillStyle(0xffdd44, 1);
      for (const it of data.items) {
        try {
          const ix = it.x;
          const iy = it.y;
          const isVis = fog && fog.visible && fog.visible[iy] ? !!fog.visible[iy][ix] : true;
          if (!isVis) continue;
          this.minimapGraphics.fillRect(
            offsetX + ix * scale - 1,
            offsetY + iy * scale - 1,
            2,
            2
          );
        } catch (e) {}
      }
    }
    
    // 绘制门（仅绘制未开的门，使用特殊颜色）
    if (data.doors) {
      this.minimapGraphics.fillStyle(0xff66cc, 1); // 粉色表示未开门
      for (const door of data.doors) {
        try {
          if (door.isOpen) continue;
          const dx = door.x, dy = door.y;
          const isVis = fog && fog.visible && fog.visible[dy] ? !!fog.visible[dy][dx] : true;
          // 仅在该门所在格可见或已探索时显示小标记
          const explored = fog && fog.explored && fog.explored[dy] ? !!fog.explored[dy][dx] : true;
          if (!explored) continue;
          // 如果不可见但已探索，画暗色；如果可见画亮色
          if (!isVis) this.minimapGraphics.fillStyle(0x8b3b5a, 1);
          else this.minimapGraphics.fillStyle(0xff66cc, 1);
          this.minimapGraphics.fillRect(
            offsetX + dx * scale - 1,
            offsetY + dy * scale - 1,
            2,
            2
          );
        } catch (e) {}
      }
    }
    
    // 绘制玩家（最后绘制，确保在最上层）
    this.minimapGraphics.fillStyle(0xffff00, 1);
    this.minimapGraphics.fillRect(
      offsetX + player.tileX * scale - 2,
      offsetY + player.tileY * scale - 2,
      4,
      4
    );

    // 更新地面物品 HUD 提示（检测玩家所在格及四周格）
    try {
      let nearby = [];
      if (data.items) {
        for (const it of data.items) {
          const dx = Math.abs(it.x - player.tileX);
          const dy = Math.abs(it.y - player.tileY);
          if (dx + dy <= 2) {
            // 附近 2 格内列为提示
            nearby.push(it);
          }
        }
      }

      if (nearby.length === 0) {
        this.groundItemText.setText('');
      } else {
        // 简短计数提示
        this.groundItemText.setText(`地上物品: ${nearby.length} 件（按移动拾取）`);
      }
    } catch (e) { /* ignore */ }
  }

  createMessageLog() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const padding = 10;
    const logWidth = Math.min(600, width - padding * 2);
    const logX = (width - logWidth) / 2;

    // 消息日志背景（居中，半透明）
    const logBg = this.add.graphics();
    logBg.fillStyle(0x0a0a12, 0.75);
    logBg.fillRoundedRect(logX, height - 85, logWidth, 75, 10);
    logBg.lineStyle(1, 0x4a4a6a, 0.4);
    logBg.strokeRoundedRect(logX, height - 85, logWidth, 75, 10);

    // 消息文字容器
    this.messageTexts = [];
    for (let i = 0; i < 3; i++) {
      const text = this.add.text(logX + 12, height - 75 + i * 22, '', {
        fontSize: '12px',
        fontFamily: 'Arial',
        color: '#cccccc'
      });
      this.messageTexts.push(text);
    }

    this.messages = [];
  }

  /**
   * 创建操作提示面板（SUPERHOT 风格）
   */
  createControlHints() {
    const padding = 10;
    const panelWidth = 200;
    const panelHeight = 220;
    const panelX = padding;
    const panelY = 200; // 在主HUD下方
    
    // 背景面板
    const hintBg = this.add.graphics();
    hintBg.fillStyle(0x0a0a12, 0.7);
    hintBg.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
    hintBg.lineStyle(1, 0x3a3a5a, 0.5);
    hintBg.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
    
    // 标题
    this.add.text(panelX + panelWidth / 2, panelY + 10, '◆ 操作指南 ◆', {
      fontSize: '11px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#e94560'
    }).setOrigin(0.5, 0);
    
    // 操作提示内容
    const hints = [
      { key: 'WASD/方向键', desc: '移动(时间流动)' },
      { key: 'SPACE', desc: '等待/原地狙击' },
      { key: 'Q+方向', desc: '转向(不动)' },
      { key: 'Z/X/C', desc: '释放符卡' },
      { key: 'TAB', desc: '自由视角' },
      { key: 'R', desc: '回神社/返回' },
      { key: 'ESC', desc: '暂停菜单' },
    ];
    
    const startY = panelY + 32;
    const lineHeight = 22;
    
    hints.forEach((hint, i) => {
      // 按键
      this.add.text(panelX + 12, startY + i * lineHeight, hint.key, {
        fontSize: '10px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        color: '#6b9fff'
      });
      
      // 描述
      this.add.text(panelX + panelWidth - 12, startY + i * lineHeight, hint.desc, {
        fontSize: '10px',
        fontFamily: 'Arial',
        color: '#aaaaaa'
      }).setOrigin(1, 0);
    });
    
    // 分隔线
    const sepY = startY + hints.length * lineHeight + 4;
    this.add.graphics()
      .lineStyle(1, 0x3a3a5a, 0.4)
      .lineBetween(panelX + 12, sepY, panelX + panelWidth - 12, sepY);
    
    // SUPERHOT 特色提示
    const tipsY = sepY + 10;
    this.add.text(panelX + panelWidth / 2, tipsY, '⚡ SUPERHOT 机制 ⚡', {
      fontSize: '9px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: '#ffaa44'
    }).setOrigin(0.5, 0);
    
    const superhotTips = [
      '• 时间随你的移动流逝',
      '• 擦弹恢复 MP',
      '• 濒死时触发【决死时刻】'
    ];
    
    superhotTips.forEach((tip, i) => {
      this.add.text(panelX + 12, tipsY + 16 + i * 14, tip, {
        fontSize: '9px',
        fontFamily: 'Arial',
        color: '#888899'
      });
    });
  }

  updateHPBar(current, max) {
    this.hpBar.clear();
    
    // 根据血量百分比渐变颜色
    const percent = current / max;
    let color = 0xe94560; // 红色
    if (percent > 0.6) color = 0x44cc66; // 绿色
    else if (percent > 0.3) color = 0xffaa44; // 橙色
    
    this.hpBar.fillStyle(color);
    this.hpBar.fillRoundedRect(this.hpBarX, this.hpBarY, this.hpBarWidth * percent, 14, 3);
  }

  updateMPBar(current, max) {
    this.mpBar.clear();
    this.mpBar.fillStyle(0x6b9fff);
    this.mpBar.fillRoundedRect(this.mpBarX, this.mpBarY, this.mpBarWidth * (current / max), 14, 3);
  }

  updateStats(stats) {
    // 更新HP
    this.updateHPBar(stats.hp, stats.maxHp);
    this.hpText.setText(`${stats.hp}/${stats.maxHp}`);

    // 更新MP
    this.updateMPBar(stats.mp, stats.maxMp);
    this.mpText.setText(`${stats.mp}/${stats.maxMp}`);

    // 更新层数
    if (stats.floor !== undefined) {
      this.floorText.setText(`${stats.floor}F`);
    }

    // 更新回合数
    if (stats.turn !== undefined) {
      this.turnText.setText(`回合 ${stats.turn}`);
    }
    
    // 更新金币（从 spellUpgradeSystem 获取）
    const gameScene = this.scene.get('GameScene');
    if (gameScene && gameScene.spellUpgradeSystem) {
      const gold = gameScene.spellUpgradeSystem.gold || 0;
      this.goldText.setText(`💰 ${gold}`);
    }
    
    // 更新装备和天赋显示
    this.updateEquipmentSlots();
    this.updateTalentBar();
    
    // 更新符卡显示
    this.updateSpellUI();
    
    // 更新 Boss 血条（如果有）
    if (this.currentBoss && this.currentBoss.isAlive) {
      this.updateBossHP(this.currentBoss.hp, this.currentBoss.maxHp);
      if (this.currentBoss.phase !== this._lastBossPhase || 
          this.currentBoss.shieldActive !== this._lastBossShield) {
        this.updateBossPhase({ 
          phase: this.currentBoss.phase, 
          shieldActive: this.currentBoss.shieldActive 
        });
        this._lastBossPhase = this.currentBoss.phase;
        this._lastBossShield = this.currentBoss.shieldActive;
      }
    }
  }

  showMessage(message) {
    // 添加新消息
    this.messages.unshift(message);
    if (this.messages.length > 3) {
      this.messages.pop();
    }

    // 更新显示
    for (let i = 0; i < this.messageTexts.length; i++) {
      if (i < this.messages.length) {
        this.messageTexts[i].setText(this.messages[i]);
        this.messageTexts[i].setAlpha(1 - i * 0.3);
      } else {
        this.messageTexts[i].setText('');
      }
    }
  }

  showDamageNumber(data) {
    const { x, y, damage, isHeal } = data;

    // 把 GameScene 的世界坐标转换为 UI 场景坐标（考虑摄像机滚动）
    let screenX = x;
    let screenY = y;
    const gameScene = this.scene.get('GameScene');
    if (gameScene && gameScene.cameras && gameScene.cameras.main) {
      const cam = gameScene.cameras.main;
      screenX = x - cam.worldView.x;
      screenY = y - cam.worldView.y;
    }

    const color = isHeal ? '#00ff00' : '#ff0000';
    const prefix = isHeal ? '+' : '-';

    if (!this._damageTexts) this._damageTexts = [];

    const damageText = this.add.text(screenX, screenY, `${prefix}${damage}`, {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: color,
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    this._damageTexts.push(damageText);

    // 让数字先轻微上弹然后缓慢消失（更舒适的节奏）
    const tween = this.tweens.add({
      targets: damageText,
      y: screenY - 40,
      alpha: 0,
      duration: 1400,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        try {
          const idx = this._damageTexts.indexOf(damageText);
          if (idx !== -1) this._damageTexts.splice(idx, 1);
        } catch (e) {}
        try { damageText.destroy(); } catch (e) {}
      }
    });

    // 保险回退：若 tween 被中断或未执行，在稍后确保销毁
    this.time.delayedCall(1600, () => {
      try {
        if (damageText && damageText.active) {
          try {
            const idx = this._damageTexts.indexOf(damageText);
            if (idx !== -1) this._damageTexts.splice(idx, 1);
          } catch (e) {}
          damageText.destroy();
        }
      } catch (e) {}
    });
  }
}
