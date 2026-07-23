// pages/settings/index.js
const mock = require('../../utils/mock.js');
const store = require('../../utils/store.js');

Page({
  data: {
    settings: null,
    profile: null,
    saving: false
  },

  onShow() {
    const st = store.getState();
    this.setData({ settings: Object.assign({}, st.settings), profile: Object.assign({}, st.profile) });
  },

  async toggle(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    const next = Object.assign({}, this.data.settings, { [key]: value });
    this.setData({ settings: next });
    this.setData({ saving: true });
    await mock.updateSettings(next);
    this.setData({ saving: false });
    wx.showToast({ title: '已保存', icon: 'success', duration: 800 });
  },

  goAbout() { wx.navigateTo({ url: '/pages/about/index' }); },
  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/index' }); },

  doReset() {
    wx.showModal({
      title: '重置演示数据',
      content: '将清空本地所有演示状态（需求、匹配、券、订单、消息等），恢复初始模拟数据。此操作不可撤销（仅本地）。',
      confirmText: '确认重置',
      confirmColor: '#D9503E',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '重置中…' });
          await mock.resetDemoData();
          wx.hideLoading();
          wx.showToast({ title: '已重置（本地模拟）', icon: 'success' });
          setTimeout(() => { wx.reLaunch({ url: '/pages/index/index' }); }, 800);
        }
      }
    });
  }
});
