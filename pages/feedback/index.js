// pages/feedback/index.js
const mock = require('../../utils/mock.js');

Page({
  data: {
    types: ['体验问题', '业务建议', '演示异常', '其他'],
    typeIndex: 0,
    flows: ['P00 首页', 'P01 发布协作', 'P02 协作详情', 'P03 邀请详情', 'P04 我的协作', 'P05 认证与接收设置'],
    flowIndex: 0,
    desc: '',
    contact: '',
    images: [],
    submitting: false,
    submitted: false,
    fbId: ''
  },

  onType(e) { this.setData({ typeIndex: e.detail.value }); },
  onFlow(e) { this.setData({ flowIndex: e.detail.value }); },
  onDesc(e) { this.setData({ desc: e.detail.value }); },
  onContact(e) { this.setData({ contact: e.detail.value }); },

  // Mock 截图上传：仅占位，不调用真实上传接口
  addMockImage() {
    if (this.data.images.length >= 3) {
      wx.showToast({ title: '演示最多上传 3 张', icon: 'none' });
      return;
    }
    const images = this.data.images.concat(['截图 ' + (this.data.images.length + 1) + '（演示占位）']);
    this.setData({ images });
  },
  removeImage(e) {
    const i = e.currentTarget.dataset.i;
    const images = this.data.images.slice();
    images.splice(i, 1);
    this.setData({ images });
  },

  async submit() {
    if (!this.data.desc.trim()) {
      wx.showToast({ title: '请填写问题描述', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    const res = await mock.submitFeedback({
      type: this.data.types[this.data.typeIndex],
      flow: this.data.flows[this.data.flowIndex],
      desc: this.data.desc,
      contact: this.data.contact,
      images: this.data.images
    });
    this.setData({ submitting: false, submitted: true, fbId: res.fbId });
  },

  back() { wx.navigateBack(); }
});
