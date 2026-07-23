// pages/vouchers/index.js
const mock = require('../../utils/mock.js');

Page({
  data: {
    list: [],
    loading: true
  },

  onShow() { this.load(); },

  async load() {
    this.setData({ loading: true });
    const raw = await mock.getVouchers();
    const map = { '可用': 's-ok', '已使用': 's-used', '已过期': 's-expired' };
    const list = raw.map(v => Object.assign({}, v, { statusClass: map[v.status] || '' }));
    this.setData({ list, loading: false });
  }
});
