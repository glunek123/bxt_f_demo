const mock = require('../../utils/mock.js');

Page({
  data: {
    role: 'initiator',
    filter: '全部',
    filters: ['全部', '待处理', '进行中', '已结束'],
    source: [],
    items: []
  },

  onShow() {
    this.refresh();
  },

  async refresh() {
    const lists = await mock.getCollabList();
    const source = this.data.role === 'initiator' ? lists.initiator : lists.receiver;
    this.setData({ source });
    this.applyFilter(source, this.data.filter);
  },

  changeRole(e) {
    this.setData({ role: e.currentTarget.dataset.role, filter: '全部' }, () => this.refresh());
  },

  changeFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ filter });
    this.applyFilter(this.data.source, filter);
  },

  applyFilter(source, filter) {
    let items = source;
    if (filter === '待处理') items = source.filter((item) => /待|审核|修改|邀请/.test(item.statusText));
    if (filter === '进行中') items = source.filter((item) => /匹配|支付|入群|沟通|连接/.test(item.statusText));
    if (filter === '已结束') items = source.filter((item) => /结束|过期|拒绝|超时|未匹配/.test(item.statusText));
    this.setData({ items });
  },

  openItem(e) {
    const item = this.data.items[e.currentTarget.dataset.index];
    if (!item) return;
    if (item.role === 'receiver') {
      wx.navigateTo({ url: '/pages/invitation/invitation?id=' + item.id });
      return;
    }
    if (item.current) {
      wx.navigateTo({ url: '/pages/collaboration/collaboration' });
      return;
    }
    wx.showToast({ title: '历史记录仅作界面演示', icon: 'none' });
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/publish/publish' });
  }
});
