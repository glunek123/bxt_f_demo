// pages/messages/index.js
const mock = require('../../utils/mock.js');

Page({
  data: {
    list: [],
    loading: true
  },

  onShow() { this.load(); },

  async load() {
    this.setData({ loading: true });
    const list = await mock.getMessages();
    this.setData({ list, loading: false });
  },

  openMsg(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find(m => m.id === id);
    // 先跳转，标记已读放后台执行，避免点击后卡顿再跳
    if (item && item.page) wx.navigateTo({ url: item.page });
    mock.markMessageRead(id).then(() => {
      this.setData({ list: this.data.list.map(m => m.id === id ? Object.assign({}, m, { read: true }) : m) });
    });
  },

  async markAll() {
    await mock.markAllMessagesRead();
    this.setData({ list: this.data.list.map(m => Object.assign({}, m, { read: true })) });
    wx.showToast({ title: '已全部标记为已读', icon: 'success', duration: 800 });
  }
});
