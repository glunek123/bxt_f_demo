const mock = require('../../../utils/mock.js');

Page({
  data: {
    settings: null,
    saving: false
  },

  async onLoad() {
    this.setSettings(await mock.getReceiverSettings());
  },

  setSettings(settings) {
    this.setData({
      settings: Object.assign({}, settings, {
        serviceCitiesText: settings.serviceCities.join('、'),
        serviceItemsText: settings.serviceItems.join('、'),
        practiceAreasText: settings.practiceAreas.join('、')
      })
    });
  },

  toggle(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ ['settings.' + key]: e.detail.value });
    this.save({ [key]: e.detail.value });
  },

  edit(e) {
    const key = e.currentTarget.dataset.key;
    const title = e.currentTarget.dataset.title;
    const current = Array.isArray(this.data.settings[key]) ? this.data.settings[key].join('、') : this.data.settings[key];
    wx.showModal({
      title,
      editable: true,
      placeholderText: '使用顿号分隔多个选项',
      content: current || '',
      success: (result) => {
        if (!result.confirm) return;
        const value = Array.isArray(this.data.settings[key])
          ? result.content.split(/[、,，]/).map((item) => item.trim()).filter(Boolean)
          : result.content;
        const next = Object.assign({}, this.data.settings, { [key]: value });
        this.setSettings(next);
        this.save({ [key]: value });
      }
    });
  },

  async save(patch) {
    this.setData({ saving: true });
    await mock.updateReceiverSettings(patch);
    this.setData({ saving: false });
    wx.showToast({ title: '已保存', icon: 'success', duration: 700 });
  },

  goInbox() {
    wx.navigateTo({ url: '/pages/invitation/invitation' });
  }
});
