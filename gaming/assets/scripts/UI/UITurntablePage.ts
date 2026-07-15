import { cocosz } from "../Manager/CocosZ";
import Constant, { PageName, PanelName } from "../Manager/Constant";
import Msg from "../Manager/Msg";
import UIPage from "../Manager/UIPage";
import GameDate, { RewardType } from "../game/gameDate";
import Weapon from "../game/weapon";

const i18n = require("LanguageData");

const { ccclass, property } = cc._decorator;

@ccclass
export default class UITurntablePanel extends UIPage {
  constructor() {
    super(PanelName.UITurntablePanel);
    this.isValid() && this.onLoad();
  }

  private _panel: cc.Node = null;
  private _rewardList: cc.Node = null;
  private _btnCJ: cc.Node = null;

  protected onLoad(): void {
    this._panel = this._page.getChildByName("panel");
    this._rewardList = this._panel.getChildByName("rewardList");

    const btnNames: string[] = ["BtnBack", "BtnCJ"];
    for (let i = 0; i < btnNames.length; i++) {
      const btn: cc.Node = this._panel.getChildByName(btnNames[i]);
      if (btn) {
        btn.on(cc.Node.EventType.TOUCH_END, this._onBtnClickHandler, this);
        if (btnNames[i] == "BtnCJ") this._btnCJ = btn;
      }
    }
  }

  protected onOpen(): void {
    this._panel.scale = 0;
    cc.tween(this._panel).to(0.3, { scale: 0.8 }, { easing: "backOut" }).start();
    cc.tween(this._page.getChildByName("guang"))
      .by(0.5, { angle: 60, opacity: -150 })
      .by(0.5, { angle: 60, opacity: 150 })
      .union()
      .repeatForever()
      .start();
    this.updateReward();
  }

  updateReward() {
    for (let i = 0; i < 12; i++) {
      let str = `reward${i + 1}`;
      let reward = this._rewardList.getChildByName(str);
      if (GameDate.TurntableReward[i].type == RewardType.Gold) {
        let gold = reward.getChildByName("gold");
        if (gold) gold.active = true;
        let label = reward.getChildByName("label");
        if (label) {
          label.active = true;
          label.zIndex = 2;
          label.setPosition(reward.x + label.x, reward.y + label.y);
          label.setParent(this._rewardList);
          label.getComponent(cc.Label).string = `+${GameDate.TurntableReward[i].num}`;
        }
      } else if (GameDate.TurntableReward[i].type == RewardType.Diamond) {
        let diamond = reward.getChildByName("diamond");
        if (diamond) diamond.active = true;
        let label = reward.getChildByName("label");
        if (label) {
          label.active = true;
          label.zIndex = 2;
          label.setPosition(reward.x + label.x, reward.y + label.y);
          label.setParent(this._rewardList);
          label.getComponent(cc.Label).string = `+${GameDate.TurntableReward[i].num}`;
        }
      } else if (GameDate.TurntableReward[i].type == RewardType.Weapon) {
        let node = new cc.Node();
        let str = "w_" + Weapon.WeaponName[GameDate.TurntableReward[i].num];
        node.addComponent(cc.Sprite).spriteFrame = cocosz.resMgr.getRes(str, cc.SpriteFrame);
        node.setParent(this._rewardList);
        node.setPosition(reward.x, reward.y);
        let nameSpr = reward.getChildByName("nameSpr");
        if (nameSpr) {
          nameSpr.active = true;
          nameSpr.zIndex = 2;
          nameSpr.setPosition(reward.x + nameSpr.x, reward.y + nameSpr.y);
          nameSpr.setParent(this._rewardList);
          nameSpr.getComponent(cc.Sprite).spriteFrame = cocosz.resMgr.getRes(`w_${GameDate.TurntableReward[i].num + 1}`, cc.SpriteFrame);
        }
      }
    }
  }

  /** The winning reward index (0-11), set before CJ() animation starts. */
  private _winIndex: number = 0;
  isCJ: boolean = false;

  CJ() {
    this.isCJ = true;
    let count = 0;
    let stopped = false;
    cocosz.audioMgr.playEffect("turntable");

    let timeCount = setInterval(() => {
      // Deselect previous
      this._rewardList.children[count % 12].children[0].opacity = 0;
      count++;
      let lastNum = count % 12;
      this._rewardList.children[lastNum].children[0].opacity = 255;

      // Stop when we've spun at least 2 full rounds and land on winning index
      if (!stopped && count >= 24 && lastNum === this._winIndex) {
        stopped = true;
        clearInterval(timeCount);
        this._applyReward(lastNum);
        this.isCJ = false;
        cocosz.useCJTimes++;
        cocosz.totalCJTimes++;
      }
    }, 80);
  }

  private _applyReward(index: number) {
    const item = GameDate.TurntableReward[index];
    if (item.type == RewardType.Gold) {
      cocosz.dataMgr.CoinCount += item.num;
      Msg.Show(i18n.t("msg.gxhdjb") + item.num);
    } else if (item.type == RewardType.Diamond) {
      cocosz.dataMgr.DiamondCount += item.num;
      Msg.Show(i18n.t("msg.gxhdzs") + item.num);
    } else if (item.type == RewardType.Skin) {
      const skinInfo = cocosz.dataMgr.getSkinInfo(item.num - 1);
      if (skinInfo && skinInfo.State == 0) {
        skinInfo.State = 1;
        cocosz.dataMgr.setSkinInfo(skinInfo.Id, skinInfo);
      }
      Msg.Show(i18n.t("msg.gxhdxjs"));
      cocosz.dataMgr.CurSkinId = item.num - 1;
      cc.game.emit(Constant.E_GAME_LOGIC, { type: Constant.E_CJ_SKIN });
      this._rewardList.children[index].children[0].opacity = 0;
      const mask = this._rewardList.getChildByName(`mask6`);
      if (mask) { mask.active = true; mask.zIndex = 3; }
    } else {
      // Weapon
      const weaponInfo = cocosz.dataMgr.getGunInfo(item.num);
      if (weaponInfo && weaponInfo.State == 0) {
        weaponInfo.State = 1;
        cocosz.dataMgr.setGunInfo(weaponInfo.Id, weaponInfo);
      }
      Msg.Show(i18n.t("msg.gxhdxwq"));
      cocosz.dataMgr.curWeapon = item.num;
      cc.game.emit(Constant.E_GAME_LOGIC, { type: Constant.E_CJ_Weapon });
      this._rewardList.children[index].children[0].opacity = 0;
      const mask = this._rewardList.getChildByName(`mask12`);
      if (mask) { mask.active = true; mask.zIndex = 3; }
    }
  }

  protected async _onBtnClickHandler(event: cc.Event.EventTouch) {
    await cocosz.audioMgr.playBtnEffect().catch();
    if (this.isCJ) return;
    switch (event.target.name) {
      case "BtnBack": {
        cocosz.uiMgr.closePanel(PanelName.UITurntablePanel);
        break;
      }
      case "BtnCJ": {
        // Pick a random reward index and spin to it — no blockchain tx
        this._winIndex = Math.floor(Math.random() * 12);
        this.CJ();
        break;
      }
    }
  }
}
