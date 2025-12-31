/**
 * 美化版游戏内菜单场景
 * 包含：物品栏、符卡配置、角色强化查看、存档读档
 */
import { ITEM_CONFIG } from '../config/gameConfig.js';
import { EQUIPMENT_CONFIG } from '../systems/EquipmentSystem.js';
import { TALENT_CONFIG } from '../systems/TalentSystem.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'InGameMenu' });
  }

  create() {
    this.width = this.cameras.main.width;
    this.height = this.cameras.main.height;
    
    // 主题色
    this.colors = {
      bg: 0x0a0a12,
      panel: 0x12121a,
      border: 0x3a3a5a,
      highlight: 0x4a6a8a,
      text: '#ffffff',
      textDim: '#888899',
      accent: '#bf6bff',
      success: '#66ff88',
      warning: '#ffaa44',
      danger: '#ff6b6b'
    };

    // 背景遮罩（带模糊效果）
    this.overlay = this.add.rectangle(0, 0, this.width * 2, this.height * 2, 0x000000, 0.7).setOrigin(0);

    // 创建主菜单
    this.createMainMenu();
    
    // 当前打开的子面板
    this.currentPanel = null;
    
    // 键盘绑定
    this.setupKeyboard();
  }

  createMainMenu() {
    const menuWidth = 320;
    const menuHeight = 530; // 增加高度以容纳更多选项
    const menuX = this.width / 2;
    const menuY = this.height / 2;

    // 记录布局数据供更新/重绘使用
    this.menuLayout = {
      menuWidth,
      menuHeight,
      menuX,
      menuY,
      startY: menuY - menuHeight / 2 + 100,
      itemHeight: 52,
      itemBgWidth: 260,
      itemBgHeight: 44,
      itemBgOffsetX: 130,
      itemBgOffsetY: 18
    };

    // 主容器
    this.mainMenuContainer = this.add.container(0, 0);

    // 背景面板
    const bg = this.add.graphics();
    bg.fillStyle(this.colors.panel, 0.95);
    bg.fillRoundedRect(menuX - menuWidth/2, menuY - menuHeight/2, menuWidth, menuHeight, 16);
    bg.lineStyle(2, this.colors.border, 0.8);
    bg.strokeRoundedRect(menuX - menuWidth/2, menuY - menuHeight/2, menuWidth, menuHeight, 16);
    this.mainMenuContainer.add(bg);

    // 标题装饰线
    const titleLine = this.add.graphics();
    titleLine.lineStyle(2, this.colors.highlight, 0.6);
    titleLine.lineBetween(menuX - 100, menuY - menuHeight/2 + 60, menuX + 100, menuY - menuHeight/2 + 60);
    this.mainMenuContainer.add(titleLine);

    // 标题
    const title = this.add.text(menuX, menuY - menuHeight/2 + 35, '◆ 游戏菜单 ◆', {
      fontSize: '22px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: this.colors.accent
    }).setOrigin(0.5);
    this.mainMenuContainer.add(title);

    // 菜单选项
    this.menuItems = [];
    this.menuActions = [];
    const options = [
      { text: '继续游戏', key: 'ESC', action: () => this.closeMenu(), icon: '▶' },
      { text: '物品栏', key: 'I', action: () => this.openInventory(), icon: '🎒' },
      { text: '装备栏', key: 'E', action: () => this.openEquipmentPanel(), icon: '💎' },
      { text: '角色强化', key: 'T', action: () => this.openEnhancePanel(), icon: '⚔' },
      { text: '符卡配置', key: 'TAB', action: () => this.openSpellMenu(), icon: '✦' },
      { text: '存档', key: 'F5', action: () => this.saveGame(), icon: '💾' },
      { text: '读档', key: 'F9', action: () => this.loadGame(), icon: '📂' }
    ];

    const { startY, itemHeight, itemBgWidth, itemBgHeight, itemBgOffsetX, itemBgOffsetY } = this.menuLayout;

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const y = startY + i * itemHeight;
      
      // 选项背景
      const itemBg = this.add.graphics();
      itemBg.fillStyle(this.colors.bg, 0.6);
      itemBg.fillRoundedRect(menuX - itemBgOffsetX, y - itemBgOffsetY, itemBgWidth, itemBgHeight, 8);
      this.mainMenuContainer.add(itemBg);
      
      // 图标
      const icon = this.add.text(menuX - 110, y, opt.icon, {
        fontSize: '18px',
        color: this.colors.text
      }).setOrigin(0, 0.5);
      this.mainMenuContainer.add(icon);
      
      // 选项文字
      const text = this.add.text(menuX - 80, y, opt.text, {
        fontSize: '16px',
        fontFamily: 'Arial',
        color: this.colors.text
      }).setOrigin(0, 0.5).setInteractive();
      this.mainMenuContainer.add(text);
      
      // 快捷键提示
      const keyHint = this.add.text(menuX + 110, y, `[${opt.key}]`, {
        fontSize: '12px',
        fontFamily: 'Arial',
        color: this.colors.textDim
      }).setOrigin(1, 0.5);
      this.mainMenuContainer.add(keyHint);

      // 交互
      const self = this;
      const idx = i;
      text.on('pointerover', function() { self.selectedIndex = idx; self.updateMenuSelection(); });
      text.on('pointerdown', function() { self.selectedIndex = idx; self.updateMenuSelection(); opt.action(); });
      // 背景也可点击/选中，避免点击偏移
      itemBg.setInteractive(new Phaser.Geom.Rectangle(menuX - itemBgOffsetX, y - itemBgOffsetY, itemBgWidth, itemBgHeight), Phaser.Geom.Rectangle.Contains);
      itemBg.on('pointerover', function() { self.selectedIndex = idx; self.updateMenuSelection(); });
      itemBg.on('pointerdown', function() { self.selectedIndex = idx; self.updateMenuSelection(); opt.action(); });

      this.menuItems.push({ text, bg: itemBg, icon, keyHint, y });
      this.menuActions.push(opt.action);
    }

    this.selectedIndex = 0;
    this.updateMenuSelection();

    // 底部提示
    const hint = this.add.text(menuX, menuY + menuHeight/2 - 30, '↑↓ 选择  |  Z/Enter 确认  |  ESC 关闭', {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: this.colors.textDim
    }).setOrigin(0.5);
    this.mainMenuContainer.add(hint);
  }

  setupKeyboard() {
    const self = this;
    
    this.input.keyboard.on('keydown-ESC', function() {
      if (self.currentPanel) {
        self.closeCurrentPanel();
      } else {
        self.closeMenu();
      }
    });
    
    this.input.keyboard.on('keydown-I', function() { if (!self.currentPanel) self.openInventory(); });
    this.input.keyboard.on('keydown-E', function() { if (!self.currentPanel) self.openEquipmentPanel(); });
    this.input.keyboard.on('keydown-T', function() { if (!self.currentPanel) self.openEnhancePanel(); });
    this.input.keyboard.on('keydown-TAB', function(e) { e.preventDefault(); if (!self.currentPanel) self.openSpellMenu(); });
    this.input.keyboard.on('keydown-F5', function() { if (!self.currentPanel) self.saveGame(); });
    this.input.keyboard.on('keydown-F9', function() { if (!self.currentPanel) self.loadGame(); });

    this.input.keyboard.on('keydown-UP', function() { self.navigateMenu(-1); });
    this.input.keyboard.on('keydown-DOWN', function() { self.navigateMenu(1); });
    this.input.keyboard.on('keydown-W', function() { self.navigateMenu(-1); });
    this.input.keyboard.on('keydown-S', function() { self.navigateMenu(1); });
    this.input.keyboard.on('keydown-Z', function() { self.confirmSelection(); });
    this.input.keyboard.on('keydown-ENTER', function() { self.confirmSelection(); });
    this.input.keyboard.on('keydown-X', function() { if (self.currentPanel) self.closeCurrentPanel(); });
  }

  navigateMenu(direction) {
    if (this.currentPanel) {
      if (this.panelNavigate) this.panelNavigate(direction);
      return;
    }
    this.selectedIndex = (this.selectedIndex + direction + this.menuItems.length) % this.menuItems.length;
    this.updateMenuSelection();
  }

  updateMenuSelection() {
    const layout = this.menuLayout || { menuX: this.width / 2, itemBgWidth: 260, itemBgHeight: 44, itemBgOffsetX: 130, itemBgOffsetY: 18 };
    const startY = layout.startY || (this.height / 2 - (layout.menuHeight || 480) / 2 + 100);
    const itemHeight = layout.itemHeight || 52;
    for (let i = 0; i < this.menuItems.length; i++) {
      const item = this.menuItems[i];
      const isSelected = (i === this.selectedIndex);
      const y = item.y || (startY + i * itemHeight);
      
      item.bg.clear();
      if (isSelected) {
        item.bg.fillStyle(this.colors.highlight, 0.4);
        item.bg.lineStyle(1, 0x6b9fff, 0.6);
      } else {
        item.bg.fillStyle(this.colors.bg, 0.6);
      }
      item.bg.fillRoundedRect(layout.menuX - layout.itemBgOffsetX, y - layout.itemBgOffsetY, layout.itemBgWidth, layout.itemBgHeight, 8);
      if (isSelected) {
        item.bg.strokeRoundedRect(layout.menuX - layout.itemBgOffsetX, y - layout.itemBgOffsetY, layout.itemBgWidth, layout.itemBgHeight, 8);
      }
      
      try {
        item.text.setColor(isSelected ? this.colors.success : this.colors.text);
        item.text.setScale(isSelected ? 1.05 : 1);
      } catch (e) {}
    }
  }

  confirmSelection() {
    if (this.currentPanel) {
      if (this.panelConfirm) this.panelConfirm();
      return;
    }
    if (this.menuActions[this.selectedIndex]) {
      this.menuActions[this.selectedIndex]();
    }
  }

  closeMenu() {
    this.scene.stop();
    this.scene.resume('GameScene');
  }

  closeCurrentPanel() {
    if (this.currentPanel) {
      this.currentPanel.destroy(true);
      this.currentPanel = null;
      this.panelNavigate = null;
      this.panelConfirm = null;
      this.mainMenuContainer.setVisible(true);
    }
  }

  // ================== 物品栏 ==================
  openInventory() {
    const game = this.scene.get('GameScene');
    if (!game) return;
    
    this.mainMenuContainer.setVisible(false);
    
    const inv = game.player.inventory || [];
    const panelWidth = 500;
    const panelHeight = 450;
    
    const container = this.add.container(0, 0);
    this.currentPanel = container;
    
    // 背景
    const bg = this.add.graphics();
    bg.fillStyle(this.colors.panel, 0.95);
    bg.fillRoundedRect(this.width/2 - panelWidth/2, this.height/2 - panelHeight/2, panelWidth, panelHeight, 16);
    bg.lineStyle(2, this.colors.border, 0.8);
    bg.strokeRoundedRect(this.width/2 - panelWidth/2, this.height/2 - panelHeight/2, panelWidth, panelHeight, 16);
    container.add(bg);
    
    // 标题
    const title = this.add.text(this.width/2, this.height/2 - panelHeight/2 + 30, '🎒 物品栏', {
      fontSize: '20px',
      fontStyle: 'bold',
      color: this.colors.accent
    }).setOrigin(0.5);
    container.add(title);
    
    // 合并重复道具
    const itemCounts = {};
    const itemOrder = [];
    for (let i = 0; i < inv.length; i++) {
      const id = inv[i];
      if (itemCounts[id] === undefined) {
        itemCounts[id] = 0;
        itemOrder.push(id);
      }
      itemCounts[id]++;
    }
    
    this.invItems = [];
    this.invSelectedIndex = 0;
    
    const startY = this.height/2 - panelHeight/2 + 70;
    const itemH = 36;
    const maxVisible = 9;
    
    if (itemOrder.length === 0) {
      const empty = this.add.text(this.width/2, this.height/2, '背包空空如也...', {
        fontSize: '16px',
        color: this.colors.textDim
      }).setOrigin(0.5);
      container.add(empty);
    } else {
      for (let i = 0; i < Math.min(itemOrder.length, maxVisible); i++) {
        const itemId = itemOrder[i];
        const cfg = ITEM_CONFIG[itemId] || { name: itemId };
        const count = itemCounts[itemId];
        const y = startY + i * itemH;
        
        const itemBg = this.add.graphics();
        container.add(itemBg);
        
        // 根据类型设置颜色
        let typeColor = this.colors.text;
        if (cfg.type === 'consumable') typeColor = '#66ff88';
        else if (cfg.type === 'currency') typeColor = '#ffd700';
        else if (cfg.type === 'equipment') typeColor = '#6b9fff';
        
        const text = this.add.text(this.width/2 - panelWidth/2 + 30, y, 
          `${cfg.name}${count > 1 ? ' x' + count : ''}`, {
          fontSize: '14px',
          color: typeColor
        }).setInteractive();
        container.add(text);
        
        // 描述
        if (cfg.description) {
          const desc = this.add.text(this.width/2 + panelWidth/2 - 30, y, cfg.description, {
            fontSize: '11px',
            color: this.colors.textDim
          }).setOrigin(1, 0);
          container.add(desc);
        }
        
        const self = this;
        const idx = i;
        text.on('pointerover', function() { self.invSelectedIndex = idx; self.updateInvSelection(); });
        text.on('pointerdown', function() { self.useInventoryItem(itemId); });
        
        this.invItems.push({ text, bg: itemBg, itemId, canUse: cfg.type !== 'currency' });
      }
    }
    
    // 返回按钮
    const back = this.add.text(this.width/2, this.height/2 + panelHeight/2 - 30, '返回 (X/ESC)', {
      fontSize: '14px',
      color: this.colors.textDim
    }).setOrigin(0.5).setInteractive();
    back.on('pointerdown', () => this.closeCurrentPanel());
    container.add(back);
    
    this.updateInvSelection();
    
    // 导航和确认
    this.panelNavigate = (dir) => {
      if (this.invItems.length === 0) return;
      this.invSelectedIndex = (this.invSelectedIndex + dir + this.invItems.length) % this.invItems.length;
      this.updateInvSelection();
    };
    this.panelConfirm = () => {
      if (this.invItems.length > 0 && this.invItems[this.invSelectedIndex]) {
        this.useInventoryItem(this.invItems[this.invSelectedIndex].itemId);
      }
    };
  }

  updateInvSelection() {
    if (!this.invItems) return;
    const panelWidth = 500;
    const panelHeight = 450;
    const startY = this.height/2 - panelHeight/2 + 70;
    
    for (let i = 0; i < this.invItems.length; i++) {
      const item = this.invItems[i];
      const isSelected = (i === this.invSelectedIndex);
      const y = startY + i * 36;
      
      item.bg.clear();
      if (isSelected) {
        item.bg.fillStyle(this.colors.highlight, 0.3);
        item.bg.fillRoundedRect(this.width/2 - panelWidth/2 + 20, y - 4, panelWidth - 40, 30, 4);
      }
      
      try { item.text.setScale(isSelected ? 1.05 : 1); } catch (e) {}
    }
  }

  useInventoryItem(itemId) {
    const game = this.scene.get('GameScene');
    if (!game || !game.player) return;
    
    const cfg = ITEM_CONFIG[itemId];
    if (cfg && cfg.type === 'currency') {
      this.showToast('金币不能直接使用');
      return;
    }
    
    const realIdx = game.player.inventory.indexOf(itemId);
    if (realIdx !== -1) {
      try { game.player.useItem(realIdx); } catch (e) {}
      this.closeCurrentPanel();
      this.openInventory();
    }
  }

  // ================== 装备栏面板 ==================
  openEquipmentPanel() {
    const game = this.scene.get('GameScene');
    if (!game || !game.equipmentSystem) return;
    
    this.mainMenuContainer.setVisible(false);
    
    const panelWidth = 600;
    const panelHeight = 500;
    
    const container = this.add.container(0, 0);
    this.currentPanel = container;
    
    // 背景
    const bg = this.add.graphics();
    bg.fillStyle(this.colors.panel, 0.95);
    bg.fillRoundedRect(this.width/2 - panelWidth/2, this.height/2 - panelHeight/2, panelWidth, panelHeight, 16);
    bg.lineStyle(2, this.colors.border, 0.8);
    bg.strokeRoundedRect(this.width/2 - panelWidth/2, this.height/2 - panelHeight/2, panelWidth, panelHeight, 16);
    container.add(bg);
    
    // 标题
    const title = this.add.text(this.width/2, this.height/2 - panelHeight/2 + 30, '💎 装备管理', {
      fontSize: '22px',
      fontStyle: 'bold',
      color: this.colors.accent
    }).setOrigin(0.5);
    container.add(title);
    
    const startX = this.width/2 - panelWidth/2 + 30;
    const startY = this.height/2 - panelHeight/2 + 80;
    
    // ====== 左侧：当前装备槽位 ======
    this.createText(container, startX, startY, '📌 装备槽位', this.colors.text, '16px');
    
    const slots = game.equipmentSystem.slots;
    const slotNames = { accessory1: '饰品槽 1', accessory2: '饰品槽 2' };
    let slotY = startY + 35;
    
    this.equipSlots = [];
    this.equipSelectedIndex = 0;
    
    let slotIdx = 0;
    for (const slotKey in slots) {
      const equipId = slots[slotKey];
      const slotName = slotNames[slotKey] || slotKey;
      const y = slotY + slotIdx * 70;
      
      // 槽位背景
      const slotBg = this.add.graphics();
      slotBg.fillStyle(this.colors.bg, 0.8);
      slotBg.fillRoundedRect(startX, y, 250, 60, 8);
      slotBg.lineStyle(1, this.colors.border, 0.6);
      slotBg.strokeRoundedRect(startX, y, 250, 60, 8);
      container.add(slotBg);
      
      // 槽位名称
      this.createText(container, startX + 10, y + 8, slotName, this.colors.textDim, '12px');
      
      if (equipId) {
        const cfg = EQUIPMENT_CONFIG[equipId];
        if (cfg) {
          // 已装备的物品
          let rarityColor = '#ffffff';
          if (cfg.rarity === 'rare') rarityColor = '#6b9fff';
          else if (cfg.rarity === 'epic') rarityColor = '#bf6bff';
          
          const nameText = this.createText(container, startX + 10, y + 26, `◆ ${cfg.name}`, rarityColor, '14px');
          nameText.setInteractive();
          
          const descText = this.createText(container, startX + 10, y + 44, cfg.description, this.colors.textDim, '10px');
          
          // 卸下按钮
          const unequipBtn = this.add.text(startX + 200, y + 30, '[卸下]', {
            fontSize: '12px',
            color: this.colors.danger
          }).setInteractive();
          container.add(unequipBtn);
          
          const self = this;
          const currentSlotKey = slotKey;
          unequipBtn.on('pointerover', function() { unequipBtn.setColor('#ff9999'); });
          unequipBtn.on('pointerout', function() { unequipBtn.setColor(self.colors.danger); });
          unequipBtn.on('pointerdown', function() { self.unequipItem(currentSlotKey); });
          
          this.equipSlots.push({ slotKey, equipId, bg: slotBg, nameText, unequipBtn });
        }
      } else {
        // 空槽位
        this.createText(container, startX + 10, y + 30, '- 空 -', this.colors.textDim, '14px');
        this.equipSlots.push({ slotKey, equipId: null, bg: slotBg });
      }
      
      slotIdx++;
    }
    
    // ====== 右侧：背包中的装备道具 ======
    const rightX = this.width/2 + 20;
    this.createText(container, rightX, startY, '🎒 可装备物品', this.colors.text, '16px');
    
    // 分隔线
    const divider = this.add.graphics();
    divider.lineStyle(1, this.colors.border, 0.4);
    divider.lineBetween(rightX - 20, startY + 25, rightX - 20, this.height/2 + panelHeight/2 - 70);
    container.add(divider);
    
    // 筛选背包中的装备类道具
    const inv = game.player.inventory || [];
    const equipItems = [];
    for (let i = 0; i < inv.length; i++) {
      const itemId = inv[i];
      const cfg = ITEM_CONFIG[itemId];
      if (cfg && cfg.type === 'equipment') {
        equipItems.push({ itemId, index: i });
      }
    }
    
    this.equipInvItems = [];
    this.equipInvSelectedIndex = 0;
    
    if (equipItems.length === 0) {
      this.createText(container, rightX, startY + 40, '背包中没有装备...', this.colors.textDim, '13px');
    } else {
      const itemH = 40;
      for (let i = 0; i < Math.min(equipItems.length, 8); i++) {
        const { itemId, index } = equipItems[i];
        const eqCfg = EQUIPMENT_CONFIG[itemId];
        if (!eqCfg) continue;
        
        const y = startY + 40 + i * itemH;
        
        // 背景
        const itemBg = this.add.graphics();
        container.add(itemBg);
        
        let rarityColor = '#ffffff';
        if (eqCfg.rarity === 'rare') rarityColor = '#6b9fff';
        else if (eqCfg.rarity === 'epic') rarityColor = '#bf6bff';
        
        const text = this.add.text(rightX, y, `• ${eqCfg.name}`, {
          fontSize: '13px',
          color: rarityColor
        }).setInteractive();
        container.add(text);
        
        const desc = this.createText(container, rightX + 10, y + 16, eqCfg.description, this.colors.textDim, '10px');
        
        const self = this;
        const idx = i;
        const currentItemId = itemId;
        text.on('pointerover', function() { self.equipInvSelectedIndex = idx; self.updateEquipInvSelection(); });
        text.on('pointerdown', function() { self.equipItemFromInventory(currentItemId); });
        
        this.equipInvItems.push({ itemId, bg: itemBg, text, y });
      }
      
      if (equipItems.length > 8) {
        this.createText(container, rightX, startY + 40 + 8 * 40, `...还有 ${equipItems.length - 8} 件`, this.colors.textDim, '11px');
      }
    }
    
    this.updateEquipInvSelection();
    
    // 底部属性加成总览
    const bonusY = this.height/2 + panelHeight/2 - 90;
    const bonusDivider = this.add.graphics();
    bonusDivider.lineStyle(1, this.colors.border, 0.5);
    bonusDivider.lineBetween(startX, bonusY - 10, startX + panelWidth - 60, bonusY - 10);
    container.add(bonusDivider);
    
    this.createText(container, startX, bonusY, '📊 装备属性加成', this.colors.accent, '14px');
    
    const bonuses = game.equipmentSystem.bonuses || {};
    const bonusParts = [];
    if (bonuses.attackFlat) bonusParts.push(`攻击+${bonuses.attackFlat}`);
    if (bonuses.defenseFlat) bonusParts.push(`防御+${bonuses.defenseFlat}`);
    if (bonuses.maxHpFlat) bonusParts.push(`生命+${bonuses.maxHpFlat}`);
    if (bonuses.maxMpFlat) bonusParts.push(`灵力+${bonuses.maxMpFlat}`);
    if (bonuses.speedFlat) bonusParts.push(`速度+${bonuses.speedFlat}`);
    if (bonuses.critChance) bonusParts.push(`暴击+${Math.floor(bonuses.critChance * 100)}%`);
    if (bonuses.hpRegen) bonusParts.push(`回复/回合+${bonuses.hpRegen}`);
    if (bonuses.killHeal) bonusParts.push(`击杀回血+${bonuses.killHeal}`);
    
    this.createText(container, startX + 10, bonusY + 22, 
      bonusParts.length > 0 ? bonusParts.join('  |  ') : '暂无加成',
      bonusParts.length > 0 ? this.colors.success : this.colors.textDim, '12px');
    
    // 返回按钮
    const back = this.add.text(this.width/2, this.height/2 + panelHeight/2 - 25, '返回 (X/ESC)', {
      fontSize: '14px',
      color: this.colors.textDim
    }).setOrigin(0.5).setInteractive();
    back.on('pointerdown', () => this.closeCurrentPanel());
    container.add(back);
    
    // 导航和确认
    this.panelNavigate = (dir) => {
      if (this.equipInvItems && this.equipInvItems.length > 0) {
        this.equipInvSelectedIndex = (this.equipInvSelectedIndex + dir + this.equipInvItems.length) % this.equipInvItems.length;
        this.updateEquipInvSelection();
      }
    };
    this.panelConfirm = () => {
      if (this.equipInvItems && this.equipInvItems.length > 0 && this.equipInvItems[this.equipInvSelectedIndex]) {
        this.equipItemFromInventory(this.equipInvItems[this.equipInvSelectedIndex].itemId);
      }
    };
  }

  updateEquipInvSelection() {
    if (!this.equipInvItems) return;
    const panelWidth = 600;
    const rightX = this.width/2 + 20;
    
    for (let i = 0; i < this.equipInvItems.length; i++) {
      const item = this.equipInvItems[i];
      const isSelected = (i === this.equipInvSelectedIndex);
      
      item.bg.clear();
      if (isSelected) {
        item.bg.fillStyle(this.colors.highlight, 0.3);
        item.bg.fillRoundedRect(rightX - 5, item.y - 3, 220, 36, 4);
      }
      
      try { item.text.setScale(isSelected ? 1.05 : 1); } catch (e) {}
    }
  }

  equipItemFromInventory(itemId) {
    const game = this.scene.get('GameScene');
    if (!game || !game.player || !game.equipmentSystem) return;
    
    const realIdx = game.player.inventory.indexOf(itemId);
    if (realIdx !== -1) {
      try { 
        game.player.useItem(realIdx);
        this.showToast(`已装备「${EQUIPMENT_CONFIG[itemId]?.name || itemId}」`);
      } catch (e) {
        this.showToast('装备失败');
      }
      this.closeCurrentPanel();
      this.openEquipmentPanel();
    }
  }

  unequipItem(slotKey) {
    const game = this.scene.get('GameScene');
    if (!game || !game.equipmentSystem) return;
    
    const equipId = game.equipmentSystem.unequip(slotKey);
    if (equipId) {
      // 卸下的装备返回背包
      game.player.inventory.push(equipId);
      this.showToast(`已卸下「${EQUIPMENT_CONFIG[equipId]?.name || equipId}」`);
    }
    this.closeCurrentPanel();
    this.openEquipmentPanel();
  }

  // ================== 角色强化面板 ==================
  openEnhancePanel() {
    const game = this.scene.get('GameScene');
    if (!game) return;
    
    this.mainMenuContainer.setVisible(false);
    
    const panelWidth = 700;
    const panelHeight = 500;
    
    const container = this.add.container(0, 0);
    this.currentPanel = container;
    
    // 背景
    const bg = this.add.graphics();
    bg.fillStyle(this.colors.panel, 0.95);
    bg.fillRoundedRect(this.width/2 - panelWidth/2, this.height/2 - panelHeight/2, panelWidth, panelHeight, 16);
    bg.lineStyle(2, this.colors.border, 0.8);
    bg.strokeRoundedRect(this.width/2 - panelWidth/2, this.height/2 - panelHeight/2, panelWidth, panelHeight, 16);
    container.add(bg);
    
    // 标题
    const title = this.add.text(this.width/2, this.height/2 - panelHeight/2 + 30, '⚔ 角色强化总览', {
      fontSize: '22px',
      fontStyle: 'bold',
      color: this.colors.accent
    }).setOrigin(0.5);
    container.add(title);
    
    const startX = this.width/2 - panelWidth/2 + 30;
    const startY = this.height/2 - panelHeight/2 + 70;
    const colWidth = (panelWidth - 60) / 3;
    
    // ====== 第一列：天赋 ======
    this.createSectionTitle(container, startX, startY, '🌟 已获得天赋');
    
    const talents = game.talentSystem?.acquiredTalents || [];
    if (talents.length === 0) {
      this.createText(container, startX + 10, startY + 30, '暂无天赋', this.colors.textDim);
    } else {
      for (let i = 0; i < Math.min(talents.length, 8); i++) {
        const cfg = TALENT_CONFIG[talents[i]];
        if (!cfg) continue;
        
        let typeColor = '#ffffff';
        if (cfg.type === 'attack') typeColor = '#ff6b6b';
        else if (cfg.type === 'defense') typeColor = '#66ff88';
        else if (cfg.type === 'utility') typeColor = '#6b9fff';
        
        this.createText(container, startX + 10, startY + 30 + i * 24, `• ${cfg.name}`, typeColor, '13px');
        this.createText(container, startX + 20, startY + 46 + i * 24, cfg.description, this.colors.textDim, '10px');
      }
      if (talents.length > 8) {
        this.createText(container, startX + 10, startY + 30 + 8 * 24, `...还有 ${talents.length - 8} 个`, this.colors.textDim);
      }
    }
    
    // ====== 第二列：装备 ======
    const col2X = startX + colWidth;
    this.createSectionTitle(container, col2X, startY, '💎 已装备饰品');
    
    const equipped = game.equipmentSystem?.equippedAccessories || [];
    if (equipped.length === 0 || equipped.every(e => !e)) {
      this.createText(container, col2X + 10, startY + 30, '暂无装备', this.colors.textDim);
    } else {
      let eqIdx = 0;
      for (let i = 0; i < equipped.length; i++) {
        if (!equipped[i]) continue;
        const cfg = EQUIPMENT_CONFIG[equipped[i]];
        if (!cfg) continue;
        
        let rarityColor = '#ffffff';
        if (cfg.rarity === 'rare') rarityColor = '#6b9fff';
        else if (cfg.rarity === 'epic') rarityColor = '#bf6bff';
        
        this.createText(container, col2X + 10, startY + 30 + eqIdx * 40, `◆ ${cfg.name}`, rarityColor, '14px');
        this.createText(container, col2X + 20, startY + 48 + eqIdx * 40, cfg.description, this.colors.textDim, '11px');
        eqIdx++;
      }
    }
    
    // ====== 第三列：符卡等级 ======
    const col3X = startX + colWidth * 2;
    this.createSectionTitle(container, col3X, startY, '✦ 符卡强化');
    
    const spellSystem = game.spellUpgradeSystem;
    const spellCardSystem = game.spellCardSystem;
    
    if (spellSystem && spellCardSystem) {
      const gold = spellSystem.gold || 0;
      this.createText(container, col3X + 10, startY + 30, `持有金币: ${gold}`, '#ffd700', '14px');
      
      const status = spellCardSystem.getStatus();
      for (let i = 0; i < Math.min(status.length, 6); i++) {
        const s = status[i];
        const level = spellSystem.getSpellLevel(i);
        const y = startY + 60 + i * 45;
        
        this.createText(container, col3X + 10, y, s.name, this.colors.text, '13px');
        
        // 等级条
        const levelBg = this.add.graphics();
        levelBg.fillStyle(0x1a1a2a, 1);
        levelBg.fillRect(col3X + 10, y + 18, 100, 8);
        levelBg.fillStyle(0xbf6bff, 1);
        levelBg.fillRect(col3X + 10, y + 18, (level / 5) * 100, 8);
        container.add(levelBg);
        
        this.createText(container, col3X + 115, y + 14, `Lv.${level}/5`, this.colors.textDim, '11px');
      }
    } else {
      this.createText(container, col3X + 10, startY + 30, '暂无数据', this.colors.textDim);
    }
    
    // ====== 底部：属性总览 ======
    const statsY = this.height/2 + panelHeight/2 - 100;
    const divider = this.add.graphics();
    divider.lineStyle(1, this.colors.border, 0.5);
    divider.lineBetween(startX, statsY - 10, startX + panelWidth - 60, statsY - 10);
    container.add(divider);
    
    this.createText(container, startX, statsY, '📊 当前属性加成', this.colors.accent, '14px');
    
    const bonuses = game.talentSystem?.getTotalBonuses() || {};
    const eqBonuses = game.equipmentSystem?.getTotalBonuses() || {};
    
    // 合并加成
    const total = { ...bonuses };
    for (const key in eqBonuses) {
      total[key] = (total[key] || 0) + eqBonuses[key];
    }
    
    const statsText = [];
    if (total.attackFlat) statsText.push(`攻击+${total.attackFlat}`);
    if (total.attackMult) statsText.push(`攻击×${total.attackMult.toFixed(2)}`);
    if (total.defenseFlat) statsText.push(`防御+${total.defenseFlat}`);
    if (total.maxHpFlat) statsText.push(`生命+${total.maxHpFlat}`);
    if (total.maxMpFlat) statsText.push(`灵力+${total.maxMpFlat}`);
    if (total.critChance) statsText.push(`暴击+${Math.floor(total.critChance * 100)}%`);
    if (total.speedFlat) statsText.push(`速度+${total.speedFlat}`);
    
    this.createText(container, startX + 10, statsY + 24, 
      statsText.length > 0 ? statsText.join('  |  ') : '暂无加成',
      statsText.length > 0 ? this.colors.success : this.colors.textDim, '12px');
    
    // 返回按钮
    const back = this.add.text(this.width/2, this.height/2 + panelHeight/2 - 25, '返回 (X/ESC)', {
      fontSize: '14px',
      color: this.colors.textDim
    }).setOrigin(0.5).setInteractive();
    back.on('pointerdown', () => this.closeCurrentPanel());
    container.add(back);
    
    this.panelNavigate = null;
    this.panelConfirm = () => this.closeCurrentPanel();
  }

  createSectionTitle(container, x, y, text) {
    const t = this.add.text(x, y, text, {
      fontSize: '15px',
      fontStyle: 'bold',
      color: this.colors.text
    });
    container.add(t);
    
    const line = this.add.graphics();
    line.lineStyle(1, this.colors.highlight, 0.5);
    line.lineBetween(x, y + 22, x + 180, y + 22);
    container.add(line);
  }

  createText(container, x, y, text, color, size = '12px') {
    const t = this.add.text(x, y, text, {
      fontSize: size,
      color: color
    });
    container.add(t);
    return t;
  }

  // ================== 符卡配置 ==================
  openSpellMenu() {
    const game = this.scene.get('GameScene');
    if (!game || !game.spellCardSystem) { 
      this.showToast('无法获取符卡系统');
      return; 
    }
    
    this.mainMenuContainer.setVisible(false);
    
    const panelWidth = 500;
    const panelHeight = 400;
    
    const container = this.add.container(0, 0);
    this.currentPanel = container;
    
    // 背景
    const bg = this.add.graphics();
    bg.fillStyle(this.colors.panel, 0.95);
    bg.fillRoundedRect(this.width/2 - panelWidth/2, this.height/2 - panelHeight/2, panelWidth, panelHeight, 16);
    bg.lineStyle(2, this.colors.border, 0.8);
    bg.strokeRoundedRect(this.width/2 - panelWidth/2, this.height/2 - panelHeight/2, panelWidth, panelHeight, 16);
    container.add(bg);
    
    // 标题
    const title = this.add.text(this.width/2, this.height/2 - panelHeight/2 + 30, '✦ 符卡配置', {
      fontSize: '22px',
      fontStyle: 'bold',
      color: this.colors.accent
    }).setOrigin(0.5);
    container.add(title);
    
    // 说明
    const hint = this.add.text(this.width/2, this.height/2 - panelHeight/2 + 60, '点击 Z/X/C 按钮将符卡分配到对应快捷键', {
      fontSize: '12px',
      color: this.colors.textDim
    }).setOrigin(0.5);
    container.add(hint);
    
    const spells = game.spellCardSystem.getStatus();
    const startY = this.height/2 - panelHeight/2 + 100;
    
    // 显示所有符卡
    for (let si = 0; si < spells.length; si++) {
      const s = spells[si];
      const y = startY + si * 50;
      
      // 符卡名称
      const nameTxt = this.add.text(this.width/2 - panelWidth/2 + 30, y, s.name, {
        fontSize: '16px',
        color: this.colors.text
      }).setOrigin(0, 0.5);
      container.add(nameTxt);
      
      // 符卡描述
      const descTxt = this.add.text(this.width/2 - panelWidth/2 + 30, y + 18, `消耗: ${s.mpCost} MP | 冷却: ${s.cooldown}回合`, {
        fontSize: '11px',
        color: this.colors.textDim
      }).setOrigin(0, 0.5);
      container.add(descTxt);
      
      // 创建三个槽位按钮 (Z/X/C)
      const labels = ['Z', 'X', 'C'];
      const self = this;
      for (let slot = 0; slot < 3; slot++) {
        // 检查当前槽位是否绑定了此符卡
        const isActive = game.player.quickSlots && game.player.quickSlots[slot] === si;
        
        const btn = this.add.text(this.width/2 + 80 + slot * 50, y, labels[slot], {
          fontSize: '14px',
          color: isActive ? '#88ff88' : '#ffffff',
          backgroundColor: isActive ? '#335533' : '#222233',
          padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive();
        
        btn.on('pointerover', function() { btn.setStyle({ backgroundColor: '#445544' }); });
        btn.on('pointerout', function() { 
          const active = game.player.quickSlots && game.player.quickSlots[slot] === si;
          btn.setStyle({ backgroundColor: active ? '#335533' : '#222233' }); 
        });
        
        (function(sIndex, slotIndex) {
          btn.on('pointerdown', function() {
            try { 
              game.player.setQuickSlot(slotIndex, sIndex);
              self.showToast(`已将「${s.name}」绑定到 ${labels[slotIndex]} 键`);
              // 刷新面板
              self.closeCurrentPanel();
              self.openSpellMenu();
            } catch (e) {}
          });
        })(si, slot);
        
        container.add(btn);
      }
    }
    
    // 返回按钮
    const back = this.add.text(this.width/2, this.height/2 + panelHeight/2 - 30, '返回 (X/ESC)', {
      fontSize: '14px',
      color: this.colors.textDim
    }).setOrigin(0.5).setInteractive();
    back.on('pointerdown', () => this.closeCurrentPanel());
    container.add(back);
    
    this.panelNavigate = null;
    this.panelConfirm = () => this.closeCurrentPanel();
  }

  // ================== 存档/读档 ==================
  saveGame() {
    const game = this.scene.get('GameScene');
    if (!game || !game.player) {
      this.showToast('✗ 无法获取游戏状态');
      return;
    }
    
    try {
      // 收集完整的游戏状态
      const state = {
        version: 1, // 存档版本号，用于未来兼容性
        timestamp: Date.now(),
        
        // 玩家基础状态
        player: {
          hp: game.player.hp,
          maxHp: game.player.maxHp,
          mp: game.player.mp,
          maxMp: game.player.maxMp,
          attack: game.player.attack,
          defense: game.player.defense,
          speed: game.player.speed,
          tileX: game.player.tileX,
          tileY: game.player.tileY,
          facing: game.player.facing,
          inventory: [...game.player.inventory], // 背包物品
          quickSlots: [...game.player.quickSlots] // 快捷符卡槽
        },
        
        // 游戏进度
        floor: game.floor || 1,
        
        // 金币
        gold: game.spellUpgradeSystem?.gold || 0,
        
        // 天赋系统
        talents: game.talentSystem?.acquiredTalents ? [...game.talentSystem.acquiredTalents] : [],
        
        // 装备系统 - 保存装备槽状态
        equipment: {
          accessory1: game.equipmentSystem?.slots?.accessory1 || null,
          accessory2: game.equipmentSystem?.slots?.accessory2 || null
        },
        
        // 符卡升级等级
        spellLevels: game.spellUpgradeSystem?.levels ? {...game.spellUpgradeSystem.levels} : {},
        
        // 神社捐赠状态
        shrineDonate: {
          totalDonated: game.shrineDonateSystem?.totalDonated || 0,
          blessingLevel: game.shrineDonateSystem?.blessingLevel || 0
        }
      };
      
      localStorage.setItem('genso_save', JSON.stringify(state));
      
      // 格式化时间显示
      const date = new Date(state.timestamp);
      const timeStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')}`;
      this.showToast(`✓ 存档成功 (${timeStr})`);
    } catch (e) {
      console.error('save failed', e);
      this.showToast('✗ 存档失败: ' + e.message);
    }
  }

  loadGame() {
    const data = localStorage.getItem('genso_save');
    if (!data) {
      this.showToast('没有找到存档');
      return;
    }
    
    try {
      const state = JSON.parse(data);
      const game = this.scene.get('GameScene');
      if (!game || !game.player) {
        this.showToast('✗ 无法获取游戏状态');
        return;
      }
      
      // 恢复玩家状态
      if (state.player) {
        game.player.hp = state.player.hp ?? game.player.hp;
        game.player.maxHp = state.player.maxHp ?? game.player.maxHp;
        game.player.mp = state.player.mp ?? game.player.mp;
        game.player.maxMp = state.player.maxMp ?? game.player.maxMp;
        game.player.attack = state.player.attack ?? game.player.attack;
        game.player.defense = state.player.defense ?? game.player.defense;
        game.player.speed = state.player.speed ?? game.player.speed;
        
        // 恢复背包
        if (state.player.inventory && Array.isArray(state.player.inventory)) {
          game.player.inventory = [...state.player.inventory];
        }
        
        // 恢复快捷符卡槽
        if (state.player.quickSlots && Array.isArray(state.player.quickSlots)) {
          game.player.quickSlots = [...state.player.quickSlots];
        }
        
        // 恢复朝向
        if (state.player.facing) {
          game.player.facing = state.player.facing;
        }
      }
      
      // 恢复金币
      if (state.gold !== undefined && game.spellUpgradeSystem) {
        game.spellUpgradeSystem.gold = state.gold;
      }
      
      // 恢复天赋
      if (state.talents && Array.isArray(state.talents) && game.talentSystem) {
        game.talentSystem.acquiredTalents = [...state.talents];
        game.talentSystem.recalculateBonuses();
      }
      
      // 恢复装备
      if (state.equipment && game.equipmentSystem) {
        // 先清空当前装备
        game.equipmentSystem.slots = {
          accessory1: state.equipment.accessory1 || null,
          accessory2: state.equipment.accessory2 || null
        };
        game.equipmentSystem.recalculateBonuses();
        game.equipmentSystem.updatePlayerStats();
      }
      
      // 恢复符卡升级等级
      if (state.spellLevels && game.spellUpgradeSystem) {
        game.spellUpgradeSystem.levels = {...state.spellLevels};
        // 重新应用符卡升级效果
        try { game.spellUpgradeSystem.applyAllBonuses(); } catch (e) {}
      }
      
      // 恢复神社捐赠状态
      if (state.shrineDonate && game.shrineDonateSystem) {
        game.shrineDonateSystem.totalDonated = state.shrineDonate.totalDonated || 0;
        game.shrineDonateSystem.blessingLevel = state.shrineDonate.blessingLevel || 0;
      }
      
      // 更新UI
      try { game.updateUI(); } catch (e) {}
      
      // 显示存档时间
      let timeInfo = '';
      if (state.timestamp) {
        const date = new Date(state.timestamp);
        timeInfo = ` (${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')})`;
      }
      
      this.showToast(`✓ 读档成功${timeInfo}`);
    } catch (e) {
      console.error('load failed', e);
      this.showToast('✗ 读档失败: ' + e.message);
    }
  }

  showToast(message) {
    const toast = this.add.text(this.width/2, this.height - 100, message, {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#ffffff',
      backgroundColor: '#333344',
      padding: { x: 16, y: 8 }
    }).setOrigin(0.5).setDepth(100);
    
    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: this.height - 130,
      duration: 1500,
      delay: 1000,
      onComplete: () => toast.destroy()
    });
  }
}
