const store = require('../../utils/store.js');
const mock = require('../../utils/mock.js');

const SCENARIOS = [
  { code: 'INITIAL', name: '初始空态', desc: '保留一条当前律师站内邀请与历史补贴券' },
  { code: 'SUCCESS', name: '完整成功主流程', desc: '直接进入双方回调确认后的沟通中' },
  { code: 'AUDIT_RETURN', name: '审核退回', desc: '展示待修改原因与重新提交入口' },
  { code: 'NO_GROUP', name: '无健康群', desc: '审核通过但不发邀请，等待空群' },
  { code: 'BATCH_SWITCH', name: '三批切换', desc: '第一批无人接受，进入第二批并沿用同一群' },
  { code: 'NO_MATCH', name: '未匹配', desc: '三批均无有效接受，状态为 NO_MATCH' },
  { code: 'LOCK_LOSS_VOUCHER', name: '锁后补贴券', desc: '当前律师首次查看锁后结果时发券' },
  { code: 'PAYMENT_TIMEOUT', name: '支付超时', desc: '关闭尝试，不自动启动下一批' },
  { code: 'PAYMENT_CONFIRMING', name: '支付确认中', desc: '等待服务端回调或主动查询，禁止重复支付' },
  { code: 'PAYMENT_REFUNDED', name: '支付退款', desc: '展示原路退款或补贴券退回后的终态' },
  { code: 'JOIN_EXCEPTION', name: '入群异常', desc: '入口打开后回调失败，协作群不复用' },
  { code: 'NEGOTIATION_FAILED', name: '沟通未达成', desc: '显示原因和重匹配三选一' }
];

Page({
  data: {
    scenarios: SCENARIOS,
    loadingCode: '',
    advancing: false,
    status: 'EMPTY',
    statusText: '暂无需求',
    state: null,
    activeCandidates: []
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const state = store.getState();
    const status = mock.publicStatus(state);
    const currentBatchNo = state.matchRound ? state.matchRound.currentBatchNo : 0;
    const activeCandidates = (state.candidates || [])
      .filter((item) => item.batchNo === currentBatchNo)
      .map((item) => ({
        name: item.name,
        score: item.score,
        practiceArea: item.practiceArea,
        invitationStatus: item.invitationStatus
      }));
    this.setData({ state, status, statusText: mock.statusText(status), activeCandidates });
  },

  async load(e) {
    const code = e.currentTarget.dataset.code;
    this.setData({ loadingCode: code });
    await mock.loadScenario(code);
    this.setData({ loadingCode: '' });
    this.refresh();
    if (code === 'LOCK_LOSS_VOUCHER') {
      wx.navigateTo({ url: '/pages/invitation/invitation' });
    } else if (code !== 'INITIAL') {
      wx.navigateTo({ url: '/pages/collaboration/collaboration' });
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  async advance() {
    this.setData({ advancing: true });
    await mock.advanceHappyPath();
    this.setData({ advancing: false });
    this.refresh();
    wx.showToast({ title: 'Mock 事件已推进', icon: 'none' });
  },

  openFormal() {
    if (this.data.status === 'EMPTY') {
      wx.switchTab({ url: '/pages/index/index' });
      return;
    }
    wx.navigateTo({ url: '/pages/collaboration/collaboration' });
  },

  async reset() {
    const result = await new Promise((resolve) => wx.showModal({
      title: '重置演示数据',
      content: '恢复为初始虚构数据，不影响任何真实系统。',
      success: resolve
    }));
    if (!result.confirm) return;
    await mock.resetDemoData();
    this.refresh();
  }
});
