import { cocosz } from "../Manager/CocosZ";
import Constant, { PanelName } from "../Manager/Constant";
import UIPage from "../Manager/UIPage";

const { ccclass } = cc._decorator;

@ccclass
export default class UIRankingsPanel extends UIPage {
  constructor() {
    super(PanelName.UIRankingsPanel);
    this.isValid() && this.onLoad();
  }

  private _panel: cc.Node = null;

  protected onLoad(): void {
    this._panel = this._page.getChildByName("panel");
    const btnBack = this._panel.getChildByName("BtnBack");
    if (btnBack) {
      btnBack.on(cc.Node.EventType.TOUCH_END, this._onBtnClickHandler, this);
    }
  }

  parseGameTime(timeInSeconds: number): string {
    const h = Math.floor(timeInSeconds / 3600);
    const m = Math.floor((timeInSeconds % 3600) / 60);
    const s = timeInSeconds % 60;
    let r = "";
    if (h > 0) r += h + ":";
    r += (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    return r;
  }

  protected onOpen(): void {
    this._panel.scale = 0;
    cc.tween(this._panel).to(0.3, { scale: 1 }, { easing: "backOut" }).start();
    this._loadRankings();
  }

  protected onClose(): void {
    cc.game.targetOff(this);
  }

  private _loadRankings(): void {
    const list = cc.find("panel/list", this._page);
    if (!list) return;
    const content = cc.find("view/content", list);
    if (!content) return;
    content.removeAllChildren();

    // Show local personal best as the only leaderboard entry
    const bestKill = cocosz.dataMgr.best_kill || 0;
    const bestTime = cocosz.dataMgr.best_time || 0;
    const username = (window.userAccount as string) || "You";

    const timeNode = cc.find("panel/latestTime", this._page);
    if (timeNode) {
      timeNode.getComponent(cc.Label).string = "Personal Best";
      timeNode.active = true;
    }

    if (bestKill === 0 && bestTime === 0) return;

    const pre = cocosz.resMgr.getRes("RankingListItem", cc.Prefab);
    if (!pre) return;
    const instance: cc.Node = cc.instantiate(pre);

    const icon = instance.getChildByName("icon");
    if (icon) {
      const reddit = cocosz.resMgr.getRes("somnia_logo", cc.SpriteFrame);
      if (reddit) icon.getComponent(cc.Sprite).spriteFrame = reddit;
    }

    const rankLabel = instance.getChildByName("rank");
    if (rankLabel) rankLabel.getComponent(cc.Label).string = "NO.1";

    const addressLabel = instance.getChildByName("address");
    if (addressLabel) addressLabel.getComponent(cc.Label).string = username;

    const timeLabel = instance.getChildByName("time");
    if (timeLabel) timeLabel.getComponent(cc.Label).string = this.parseGameTime(bestTime);

    const gradeLabel = instance.getChildByName("grade");
    if (gradeLabel) gradeLabel.getComponent(cc.Label).string = String(bestKill);

    instance.parent = content;
  }

  protected async _onBtnClickHandler(event: cc.Event.EventTouch) {
    await cocosz.audioMgr.playBtnEffect().catch();
    if (event.target.name === "BtnBack") {
      cocosz.uiMgr.closePanel(PanelName.UIRankingsPanel);
    }
  }
}
