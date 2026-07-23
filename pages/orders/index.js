// pages/orders/index.js
const mock = require('../../utils/mock.js');

Page({
  data: {
    list: [],
    loading: true,
    opened: null
  },

  onShow() { this.load(); },

  async load() {
    this.setData({ loading: true });
    const raw = await mock.getOrders();
    const map = {
      '待支付': 's-unpaid',
      '已支付': 's-paid',
      '券抵扣(零支付)': 's-zero',
      '已关闭': 's-closed',
      '退款中': 's-refund'
    };
    const list = raw.map(o => Object.assign({}, o, { statusClass: map[o.status] || '' }));
    this.setData({ list, loading: false });
  },

  openOrder(e) {
    const id = e.currentTarget.dataset.id;
    const opened = this.data.list.find(o => o.id === id) || null;
    this.setData({ opened });
  },
  noop() {},
  closeOrder() { this.setData({ opened: null }); }
});
