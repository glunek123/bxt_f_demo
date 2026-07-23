const store = require('../../utils/store.js');
const mock = require('../../utils/mock.js');

Page({
  data: {
    status: 'EMPTY',
    statusText: '暂无需求',
    demand: null,
    activeItems: [],
    pendingInvite: null
  },

  onShow() {
    this.refresh();
  },

  async refresh() {
    const state = store.getState();
    const status = mock.publicStatus(state);
    const lists = await mock.getCollabList();
    const pendingInvite = (state.receiverInbox || []).find((item) => item.status === 'PENDING') || null;
    this.setData({
      status,
      statusText: mock.statusText(status),
      demand: state.demand,
      activeItems: lists.initiator.filter((item) => item.current).slice(0, 2),
      pendingInvite
    });
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/publish/publish' });
  },

  goInvitation() {
    wx.navigateTo({ url: '/pages/invitation/invitation' });
  },

  goCurrent() {
    wx.navigateTo({ url: '/pages/collaboration/collaboration' });
  },

  goPilot(e) {
    wx.navigateTo({ url: '/pages/pilot/index?scene=' + (e.currentTarget.dataset.scene || 'COURT_APPEARANCE') });
  },

  goHelp() {
    wx.navigateTo({ url: '/pages/help/index' });
  }
});
