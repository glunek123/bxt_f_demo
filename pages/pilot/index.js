const mock = require('../../utils/mock.js');

Page({
  data: {
    city: '上海',
    court: '上海市某人民法院（演示虚构）',
    submitted: false,
    record: null,
    busy: false
  },

  setField(e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value });
  },

  async submit() {
    this.setData({ busy: true });
    const result = await mock.registerPilotInterest({
      city: this.data.city,
      court: this.data.court,
      contactPreference: '站内消息'
    });
    this.setData({ busy: false, submitted: true, record: result.record });
  },

  home() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
