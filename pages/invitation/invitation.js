const mock = require('../../utils/mock.js');

Page({
  data: {
    invitation: null,
    statusText: '',
    countdown: '--:--',
    rejectOpen: false,
    reason: '',
    reasons: ['时间不合适', '当前事项不在承接范围', '可能存在利益冲突', '近期无法响应', '其他'],
    busy: false,
    resultCode: '',
    qualificationMessage: '',
    voucherIssued: false
  },

  onLoad(options) {
    this._requestedId = options.id || '';
  },

  async onShow() {
    await this.refresh(true);
    this.startTimer();
  },

  onHide() {
    this.stopTimer();
  },

  onUnload() {
    this.stopTimer();
  },

  async refresh(open) {
    const invitations = mock.getReceiverInvitations();
    const invitation = invitations.find((item) => item.invitationId === this._requestedId)
      || invitations.find((item) => item.status === 'PENDING')
      || invitations[0]
      || null;
    if (invitation && open) {
      const result = await mock.openReceiverInvitation(invitation.invitationId);
      this.setData({ voucherIssued: Boolean(result.voucher) });
    }
    this.setData({
      invitation,
      statusText: invitation ? mock.invitationStatusText(invitation.status) : ''
    });
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
    const invitation = this.data.invitation;
    if (!invitation || invitation.status !== 'PENDING') return;
    const left = Math.max(0, invitation.expiresAt - Date.now());
    const minutes = Math.floor(left / 60000);
    const seconds = Math.floor((left % 60000) / 1000);
    this.setData({ countdown: ('0' + minutes).slice(-2) + ':' + ('0' + seconds).slice(-2) });
    if (left === 0) this.refresh(false);
  },

  async accept() {
    this.setData({ busy: true });
    const result = await mock.receiverAcceptInvitation(this.data.invitation.invitationId);
    this.setData({
      busy: false,
      resultCode: result.result,
      voucherIssued: result.result === 'LOCKED_BY_OTHER' || this.data.voucherIssued,
      qualificationMessage: result.message || ''
    });
    await this.refresh(false);
  },

  showReject() {
    this.setData({ rejectOpen: true, reason: '' });
  },

  hideReject() {
    this.setData({ rejectOpen: false });
  },

  pickReason(e) {
    this.setData({ reason: e.currentTarget.dataset.reason });
  },

  async reject() {
    if (!this.data.reason) {
      wx.showToast({ title: '请选择原因', icon: 'none' });
      return;
    }
    await mock.receiverDeclineInvitation(this.data.invitation.invitationId, this.data.reason);
    this.setData({ rejectOpen: false, resultCode: 'REJECTED' });
    await this.refresh(false);
  },

  goVoucher() {
    wx.navigateTo({ url: '/pages/vouchers/index' });
  },

  goSettings() {
    wx.navigateTo({ url: '/pages/profile/receiver/index' });
  },

  goList() {
    wx.switchTab({ url: '/pages/collaboration/list' });
  }
});
