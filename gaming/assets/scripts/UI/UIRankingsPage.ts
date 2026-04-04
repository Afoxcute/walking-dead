import { cocosz } from "../Manager/CocosZ";
import Constant, { PanelName } from "../Manager/Constant";
import UIPage from "../Manager/UIPage";

const i18n = require("LanguageData");

const { ccclass, property } = cc._decorator;

@ccclass
export default class UIRankingsPanel extends UIPage {
  constructor() {
    super(PanelName.UIRankingsPanel);
    this.isValid() && this.onLoad();
  }

  private _panel: cc.Node = null;

  protected onLoad(): void {
    this._panel = this._page.getChildByName("panel");

    const btnNames: string[] = ["BtnBack"];
    for (let i = 0; i < btnNames.length; i++) {
      const btn: cc.Node = this._panel.getChildByName(btnNames[i]);
      if (btn) {
        btn.on(cc.Node.EventType.TOUCH_END, this._onBtnClickHandler, this);
      }
    }
  }

  parseGameTime(timeInSeconds) {
    let h = Math.floor(timeInSeconds / 3600);
    let m = Math.floor((timeInSeconds % 3600) / 60);
    let s = timeInSeconds % 60;

    let r = "";
    if (h > 0) {
      r += h + ":";
    }
    r += m < 10 ? "0" + m : m;
    r += ":";
    r += s < 10 ? "0" + s : s;
    return r;
  }

  formatTime(timestamp: string) {
    let date = new Date(parseInt(timestamp) * 1000);

    return date.toLocaleString("en-US", {
      hourCycle: "h24",
    });
  }

  protected onOpen(): void {
    this._panel.scale = 0;
    cc.tween(this._panel).to(0.3, { scale: 1 }, { easing: "backOut" }).start();

    cc.game.on(Constant.E_GAME_LOGIC, this._onGameMessageHandler, this);
    this._loadRankings();
  }

  protected onClose(): void {
    cc.game.targetOff(this);
  }

  private _onGameMessageHandler(event: any): void {
    if (event.type === Constant.E_SOMNIA_REACTIVITY && this.isOpen()) {
      this._loadRankings();
    }
  }

  private _loadRankings(): void {
    if (window.getTopListInfo == null || window.getTopListInfo == undefined) {
      return;
    }
    const list = cc.find("panel/list", this._page);
    if (!list) return;
    const content = cc.find("view/content", list);
    if (content) {
      content.removeAllChildren();
    }

    window.getTopListInfo((result) => {
      if (!this.isValid()) return;
      const listAfter = cc.find("panel/list", this._page);
      const contentAfter = listAfter ? cc.find("view/content", listAfter) : null;
      if (!contentAfter) return;

      console.log("result:", result);

      let rankingsList = [];
      let topGradeList = result[0];
      let topTimeList = result[1];
      let topPlayerList = result[2];
      let topPlayerChainHashList: any[] = result[3];
      let lastUpdateTime = result[4];
      for (let i = 0; i < 10; i++) {
        let grade = parseInt(topGradeList[i]);
        if (grade > 0) {
          let chainHash = topPlayerChainHashList[i];
          let chainName = "unknown";
          if (
            chainHash ===
            "0x5354540000000000000000000000000000000000000000000000000000000000"
          ) {
            chainName = "STT";
          } else if (
            chainHash ===
            "0x5055534800000000000000000000000000000000000000000000000000000000"
          ) {
            chainName = "STT";
          } else if (
            chainHash ===
            "0xf6839e8ce78fb8ed241eafab49d6b96103bbb6c0087d28eb668a9342ff6078a3"
          ) {
            chainName = "Ethereum";
          } else if (
            chainHash ===
            "0xbf4fcc51643a2a75fa848f3480f506e82661c06551ddc80a6d6180d49aff20b9"
          ) {
            chainName = "Solana";
          } else if (
            chainHash ===
            "0x1b39756aef587380aa62b477d0e0a7cd438c5098f3cab5f040b3f908d891a37d"
          ) {
            chainName = "Base";
          } else if (
            chainHash ===
            "0x988cfce8d0ac6a40d4ed7edbe0829990cc7970babae80067a0016fc42538c6c0"
          ) {
            chainName = "Arbitrum";
          }

          rankingsList.push({
            time: parseInt(topTimeList[i]),
            address: topPlayerList[i],
            grade: grade,
            chainName: chainName,
          });
        }
      }

      if (lastUpdateTime != null && lastUpdateTime != "") {
        let timeStr = this.formatTime(lastUpdateTime);
        let timeNode = cc.find("panel/latestTime", this._page);
        timeNode.getComponent(cc.Label).string =
          "Last updated on   " + timeStr;
        timeNode.active = true;
      }

      rankingsList.sort((a, b) => b.grade - a.grade);

      console.log("rankingsList:", rankingsList);

      for (let i = 0; i < rankingsList.length; i++) {
        let pre = cocosz.resMgr.getRes("RankingListItem", cc.Prefab);
        const instance: cc.Node = cc.instantiate(pre);

        console.log("rankingsList[i].chainName: ", rankingsList[i].chainName);
        console.log("rankingsList[i].time: ", rankingsList[i].time);
        console.log(
          "this.parseGameTime(rankingsList[i].time): ",
          this.parseGameTime(rankingsList[i].time)
        );

        let address = rankingsList[i].address;
        let chainName = rankingsList[i].chainName;

        switch (chainName) {
          case "STT":
            instance.getChildByName("icon").getComponent(
              cc.Sprite
            ).spriteFrame = cocosz.resMgr.getRes(
              "somnia_logo",
              cc.SpriteFrame
            );
            break;
          case "Ethereum":
            instance.getChildByName("icon").getComponent(
              cc.Sprite
            ).spriteFrame = cocosz.resMgr.getRes(
              "ethereum_logo",
              cc.SpriteFrame
            );
            break;
          case "Solana":
            instance.getChildByName("icon").getComponent(
              cc.Sprite
            ).spriteFrame = cocosz.resMgr.getRes(
              "solana_logo",
              cc.SpriteFrame
            );
            break;
          case "Base":
            instance.getChildByName("icon").getComponent(
              cc.Sprite
            ).spriteFrame = cocosz.resMgr.getRes(
              "base_logo",
              cc.SpriteFrame
            );
            break;
          case "Arbitrum":
            instance.getChildByName("icon").getComponent(
              cc.Sprite
            ).spriteFrame = cocosz.resMgr.getRes(
              "arbitrum_logo",
              cc.SpriteFrame
            );
            break;
          default:
            instance.getChildByName("icon").getComponent(
              cc.Sprite
            ).spriteFrame = cocosz.resMgr.getRes(
              "unknown_logo",
              cc.SpriteFrame
            );
            break;
        }

        instance.getChildByName("rank").getComponent(cc.Label).string =
          "NO." + (i + 1);
        instance.getChildByName("address").getComponent(cc.Label).string =
          address.slice(0, 6) + "..." + address.slice(-4);
        instance.getChildByName("time").getComponent(cc.Label).string =
          this.parseGameTime(rankingsList[i].time);
        instance.getChildByName("grade").getComponent(cc.Label).string =
          rankingsList[i].grade;

        instance.parent = contentAfter;
      }
    });
  }

  protected async _onBtnClickHandler(event: cc.Event.EventTouch) {
    await cocosz.audioMgr.playBtnEffect().catch();
    switch (event.target.name) {
      case "BtnBack": {
        cocosz.uiMgr.closePanel(PanelName.UIRankingsPanel);
        break;
      }
    }
  }
}
