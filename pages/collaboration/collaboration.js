const mock = require('../../utils/mock.js');

const META = {
  AUDITING: ['审核中', '系统正在核验结构化信息，必要时转人工审核。', 1, '审'],
  MANUAL_REVIEW: ['人工审核中', '审核人员将处理需要进一步核验的内容。', 1, '审'],
  NEED_EDIT: ['需要修改', '部分信息未通过审核，请修改后重新提交。', 1, '改'],
  MATCH_PREPARING: ['等待健康协作群', '系统会先预占健康空群，再开始发送邀请。', 2, '等'],
  MATCHING: ['匹配邀请中', '候选快照已冻结，系统正按批次邀请；发起方不可见候选名单与推荐分。', 2, '配'],
  WAIT_PAY: ['已匹配，待确认连接', '请在 10 分钟内确认 1 元连接信息服务费。', 3, '¥'],
  PAYMENT_CONFIRMING: ['支付结果确认中', '正在等待服务端回调或主动查询结果，请勿重复支付。', 3, '…'],
  PAYMENT_TIMEOUT: ['支付窗口已结束', '当前接收资格已解除，系统不会自动启动下一批。', 3, '!'],
  PAYMENT_REFUNDED: ['连接费已退款', '当前协作尝试已关闭，退款结果已写入连接费订单。', 3, '退'],
  WAIT_JOIN: ['等待双方入群', '打开入口不等于实际入群，以企微回调或查询对账为准。', 3, '群'],
  JOIN_EXCEPTION: ['入群状态异常', '入口已停用，请重新匹配或联系平台运营核验。', 3, '!'],
  COMMUNICATING: ['沟通中', '双方已由企微回调确认入群，平台不采集群聊内容。', 4, '协'],
  NEGOTIATION_FAILED: ['沟通未达成', '请选择重新匹配、修改协作内容或结束需求。', 4, '!'],
  NO_MATCH: ['本轮未匹配', '三批邀请均未产生有效接受；这不同于超过截止时间。', 2, '—'],
  EXPIRED: ['需求已过期', '已超过停止匹配时间，旧邀请不会恢复。', 2, '期'],
  CLOSED_CONNECTED: ['协作记录已结束', '仅表示平台连接记录结束，不代表平台确认法律服务已经履行。', 5, '✓'],
  CLOSED: ['需求已结束', '本次需求记录已关闭。', 5, '✓']
};

Page({
  data: {
    view: null,
    meta: META.AUDITING,
    paymentCountdown: '10:00',
    failureOpen: false,
    nextOpen: false,
    closeOpen: false,
    failureReason: '',
    reasons: ['无人响应', '时间无法协调', '事项理解不一致', '费用未谈妥', '资质/冲突问题', '其他'],
    busy: false
  },

  onShow() {
    this.refresh();
    this.startTimer();
  },

  onHide() {
    this.stopTimer();
  },

  onUnload() {
    this.stopTimer();
  },

  refresh() {
    const view = mock.getCollaborationView();
    if (!view.demand) {
      wx.redirectTo({ url: '/pages/publish/publish' });
      return;
    }
    const meta = META[view.status] || [mock.statusText(view.status), '查看当前协作进度。', 0, '·'];
    this.setData({ view, meta });
    this.updateCountdown();
  },

  startTimer() {
    this.stopTimer();
    this._timer = setInterval(() => this.updateCountdown(), 1000);
  },

  stopTimer() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  },

  updateCountdown() {
    const order = this.data.view && this.data.view.order;
    if (!order || order.status !== 'UNPAID') return;
    const left = Math.max(0, order.expiresAt - Date.now());
    const minutes = Math.floor(left / 60000);
    const seconds = Math.floor((left % 60000) / 1000);
    this.setData({ paymentCountdown: ('0' + minutes).slice(-2) + ':' + ('0' + seconds).slice(-2) });
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/publish/publish' });
  },

  async pay() {
    this.setData({ busy: true });
    const result = await mock.payConnection({ useVoucher: Boolean(this.data.view.availableVoucher) });
    this.setData({ busy: false });
    this.refresh();
    if (result.ok && result.zero) wx.showToast({ title: '补贴券已抵扣', icon: 'success' });
  },

  async openEntry() {
    const join = this.data.view.join;
    if (join.initiator === 'NOT_OPENED') {
      await mock.openJoinEntry('initiator');
      this.refresh();
      wx.showModal({
        title: '已打开入群入口',
        content: '当前仍是“等待回调确认”，不能把打开二维码视为已经入群。PAC 控制台可模拟企微回调。',
        showCancel: false
      });
    }
  },

  showClose() {
    this.setData({ closeOpen: true });
  },

  hideClose() {
    this.setData({ closeOpen: false });
  },

  async confirmClose() {
    this.setData({ busy: true, closeOpen: false });
    await mock.closeCollaborationRecord();
    this.setData({ busy: false });
    this.refresh();
  },

  showFailure() {
    this.setData({ failureOpen: true, failureReason: '' });
  },

  hideFailure() {
    this.setData({ failureOpen: false });
  },

  pickReason(e) {
    this.setData({ failureReason: e.currentTarget.dataset.reason });
  },

  async submitFailure() {
    if (!this.data.failureReason) {
      wx.showToast({ title: '请选择原因', icon: 'none' });
      return;
    }
    await mock.reportNegotiationFailed(this.data.failureReason);
    this.setData({ failureOpen: false, nextOpen: true });
    this.refresh();
  },

  showNext() {
    this.setData({ nextOpen: true });
  },

  hideNext() {
    this.setData({ nextOpen: false });
  },

  async rematch() {
    this.setData({ busy: true, nextOpen: false });
    const result = await mock.rematch();
    this.setData({ busy: false });
    if (!result.ok) wx.showToast({ title: '当前状态不能重匹配', icon: 'none' });
    this.refresh();
  },

  modifyDemand() {
    this.setData({ nextOpen: false });
    wx.navigateTo({ url: '/pages/publish/publish' });
  },

  endDemand() {
    wx.showModal({
      title: '结束需求',
      content: '结束后旧邀请保持终态，不能恢复。是否继续？',
      success: async (result) => {
        if (!result.confirm) return;
        await mock.closeDemand('发起方选择结束需求');
        this.setData({ nextOpen: false });
        this.refresh();
      }
    });
  },

  republish() {
    wx.navigateTo({ url: '/pages/publish/publish' });
  },

  feedback() {
    wx.navigateTo({ url: '/pages/feedback/index' });
  },

  orders() {
    wx.navigateTo({ url: '/pages/orders/index' });
  },

  home() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
