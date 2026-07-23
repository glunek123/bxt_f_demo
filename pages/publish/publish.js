const store = require('../../utils/store.js');
const mock = require('../../utils/mock.js');

function pad(value) { return value < 10 ? '0' + value : String(value); }
function inputTime(offsetHours) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

const BASE_FORM = {
  sceneCode: 'FILE_RETRIEVAL',
  city: '上海',
  institution: '上海市浦东新区档案服务中心（演示虚构）',
  serviceItem: '诉讼档案复制',
  practiceArea: '民商事',
  matchDeadlineAt: inputTime(20),
  serviceAt: inputTime(168),
  urgency: '普通',
  supplement: '',
  structuredFields: {
    archiveType: '诉讼档案',
    institutionType: '档案机构',
    retrievalMethods: ['现场查阅', '复制'],
    materialsStatus: '部分齐全',
    originalRequired: false
  }
};

Page({
  data: {
    mode: 'FORM',
    description: '',
    form: BASE_FORM,
    errors: {},
    pendingFields: [],
    institutionLow: false,
    serviceTimeLow: false,
    noticeOpen: false,
    summaryOpen: false,
    extracting: false,
    submitting: false,
    charCount: 0
  },

  onLoad(options) {
    const state = store.getState();
    const source = state.draft || (state.demand && state.demand.status === 'NEED_EDIT' ? state.demand : null);
    const form = source ? Object.assign({}, BASE_FORM, source, { fromEdit: Boolean(state.demand) }) : BASE_FORM;
    this.setData({
      form,
      noticeOpen: !state.notice.acknowledged,
      mode: options.mode === 'ai' ? 'AI' : 'FORM'
    });
  },

  acknowledgeNotice() {
    mock.acknowledgeNotice().then(() => this.setData({ noticeOpen: false }));
  },

  closeNotice() {
    wx.navigateBack();
  },

  switchMode(e) {
    const next = e.currentTarget.dataset.mode;
    if (next === this.data.mode) return;
    const hasContent = this.data.description.trim() || this.data.form.supplement;
    if (!hasContent) {
      this.setData({ mode: next });
      return;
    }
    wx.showActionSheet({
      itemList: ['保留并映射已有内容', '清空后切换', '取消'],
      success: (result) => {
        if (result.tapIndex === 0) this.setData({ mode: next });
        if (result.tapIndex === 1) this.setData({ mode: next, description: '', charCount: 0, form: BASE_FORM });
      }
    });
  },

  setField(e) {
    const key = e.currentTarget.dataset.key;
    const form = Object.assign({}, this.data.form, { [key]: e.detail.value });
    this.setData({ form, errors: Object.assign({}, this.data.errors, { [key]: '' }) });
  },

  setStructured(e) {
    const key = e.currentTarget.dataset.key;
    const structuredFields = Object.assign({}, this.data.form.structuredFields, { [key]: e.detail.value });
    this.setData({ form: Object.assign({}, this.data.form, { structuredFields }) });
  },

  chooseScene(e) {
    const sceneCode = e.currentTarget.dataset.scene;
    if (sceneCode === 'COURT_APPEARANCE') {
      wx.navigateTo({ url: '/pages/pilot/index?scene=COURT_APPEARANCE' });
      return;
    }
    const meeting = sceneCode === 'LAWYER_MEETING';
    const form = Object.assign({}, this.data.form, {
      sceneCode,
      institution: meeting ? '上海市第二看守所（演示虚构）' : '上海市浦东新区档案服务中心（演示虚构）',
      serviceItem: meeting ? '一般会见' : '诉讼档案复制',
      structuredFields: meeting
        ? { meetingType: '一般会见', appointmentStatus: '预约中', materialsStatus: '部分齐全', feedbackItems: '基本情况、签署材料', sensitiveCase: false }
        : { archiveType: '诉讼档案', institutionType: '档案机构', retrievalMethods: '现场查阅、复制', materialsStatus: '部分齐全', originalRequired: false }
    });
    this.setData({ form });
  },

  onDescription(e) {
    const description = e.detail.value || '';
    this.setData({ description, charCount: description.length });
  },

  async extract() {
    this.setData({ extracting: true });
    const result = await mock.aiExtract(this.data.description, this.data.form.sceneCode);
    this.setData({ extracting: false });
    if (!result.ok) {
      wx.showModal({ title: '暂不能整理', content: result.message, showCancel: false });
      return;
    }
    this.setData({
      form: Object.assign({}, this.data.form, result.fields),
      pendingFields: result.pendingFields,
      institutionLow: result.pendingFields.includes('institution'),
      serviceTimeLow: result.pendingFields.includes('serviceAt'),
      mode: 'FORM'
    });
    wx.showToast({ title: '请确认橙色字段', icon: 'none' });
  },

  saveDraft() {
    mock.saveDraft(this.data.form).then(() => wx.showToast({ title: '草稿已保存', icon: 'success' }));
  },

  preview() {
    const errors = mock.validateDemand(this.data.form);
    this.setData({ errors });
    if (Object.keys(errors).length) {
      wx.showToast({ title: '请检查必填信息', icon: 'none' });
      return;
    }
    this.setData({ summaryOpen: true });
  },

  closeSummary() {
    this.setData({ summaryOpen: false });
  },

  async submit() {
    this.setData({ submitting: true });
    const result = await mock.submitDemand(Object.assign({}, this.data.form, { aiAssisted: this.data.description.length > 0 }));
    this.setData({ submitting: false });
    if (!result.ok) {
      this.setData({ errors: result.errors || {}, summaryOpen: false });
      wx.showToast({ title: '提交信息需修改', icon: 'none' });
      return;
    }
    wx.redirectTo({ url: '/pages/collaboration/collaboration' });
  }
});
