const mock = require('../../utils/mock.js');

Page({
  data: {
    profile: null
  },

  async onShow() {
    this.setData({ profile: await mock.getProfile() });
  },

  go(e) {
    wx.navigateTo({ url: e.currentTarget.dataset.url });
  }
});
