// PAC 高保真 Demo 的本地状态仓库。
// 这里只保存虚构结构化数据；AI 原始描述、真实身份、真实案情和平台凭据均不持久化。

const STORAGE_KEY = 'lawyer_collab_pac_demo_v2';

function defaultState() {
  return {
    schemaVersion: 2,
    profile: {
      id: 'USER_DEMO_LIN',
      name: '林知远',
      avatar: 'L',
      identity: '执业律师',
      city: '北京',
      years: 8,
      certificationStatus: 'VALID',
      certText: '认证有效',
      phoneMasked: '138****8000'
    },
    receiverSettings: {
      certificationStatus: 'VALID',
      serviceCities: ['上海'],
      scenes: ['FILE_RETRIEVAL', 'LAWYER_MEETING'],
      serviceItems: ['诉讼档案复制', '一般会见'],
      practiceAreas: ['民商事', '劳动争议'],
      availability: '工作日 09:00–18:00',
      receivingEnabled: true,
      wecomCapability: 'READY',
      notificationState: 'AUTHORIZED',
      inboxEnabled: true
    },
    settings: {
      inviteNotify: true,
      matchNotify: true,
      collabNotify: true,
      maskSensitive: true
    },
    notice: {
      version: 'publish-notice-v2',
      acknowledged: false,
      acknowledgedAt: 0
    },
    draft: null,
    demand: null,
    matchRound: null,
    batches: [],
    candidates: [],
    invitations: [],
    currentReceiverInvitationId: '',
    receiverInbox: [
      {
        invitationId: 'INV-INBOX-DEMO-001',
        parentDemandId: 'D-INBOX-DEMO-001',
        receiverId: 'USER_DEMO_LIN',
        status: 'PENDING',
        scene: '异地调档',
        city: '上海',
        institution: '上海市浦东新区档案服务中心（虚构）',
        serviceItem: '诉讼档案复制',
        serviceAtText: '2026-08-12 10:00',
        initiatorName: '赵律师',
        initiatorCertification: '已认证律师',
        initiatorRegion: '北京',
        expiresAt: Date.now() + 15 * 60 * 1000,
        openedAfterLock: false,
        collaborationId: ''
      }
    ],
    reachedReceiverIds: [],
    collaborationAttempt: null,
    order: null,
    join: {
      initiator: 'NOT_OPENED',
      receiver: 'NOT_OPENED'
    },
    groupPool: [
      { id: 'GROUP_DEMO_01', status: 'EMPTY_READY', entryExposed: false, externalMemberCount: 0 },
      { id: 'GROUP_DEMO_02', status: 'EMPTY_READY', entryExposed: false, externalMemberCount: 0 },
      { id: 'GROUP_DEMO_03', status: 'EMPTY_READY', entryExposed: false, externalMemberCount: 0 }
    ],
    activeGroup: null,
    vouchers: [
      {
        id: 'V_PRESET_001',
        type: 'PUBLISH_CONNECTION_1_YUAN',
        amount: 1,
        status: 'AVAILABLE',
        sourceDemandId: 'D-DEMO-HISTORY-001',
        receiverId: 'USER_DEMO_LIN',
        sourceText: '历史邀请锁后补贴',
        expiresAtText: '2026-08-22'
      }
    ],
    pilotInterests: [],
    messages: [],
    feedbacks: [],
    timeline: [],
    riskEvents: [],
    demo: {
      scenario: 'INITIAL',
      groupAvailable: true,
      lastAction: ''
    }
  };
}

let state = defaultState();
let persistTimer = null;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function deepMerge(base, over) {
  if (over === undefined || over === null) return clone(base);
  if (Array.isArray(base) || Array.isArray(over)) return Array.isArray(over) ? clone(over) : clone(base);
  if (typeof base !== 'object' || typeof over !== 'object') return clone(over);
  const out = Object.assign({}, clone(base));
  Object.keys(over).forEach((key) => {
    if (
      over[key] &&
      typeof over[key] === 'object' &&
      !Array.isArray(over[key]) &&
      base &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      out[key] = deepMerge(base[key], over[key]);
    } else {
      out[key] = clone(over[key]);
    }
  });
  return out;
}

function loadState() {
  try {
    const saved = wx.getStorageSync(STORAGE_KEY);
    if (saved && saved.schemaVersion === 2) state = deepMerge(defaultState(), saved);
  } catch (error) {}
  return state;
}

function persist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      wx.setStorage({ key: STORAGE_KEY, data: state });
    } catch (error) {}
  }, 120);
}

function getState() {
  return state;
}

function setState(patch) {
  state = deepMerge(state, patch);
  persist();
  return state;
}

function replaceState(next) {
  state = deepMerge(defaultState(), next || {});
  persist();
  return state;
}

function resetState() {
  state = defaultState();
  try {
    wx.removeStorageSync(STORAGE_KEY);
  } catch (error) {}
  return state;
}

module.exports = {
  STORAGE_KEY,
  defaultState,
  loadState,
  getState,
  setState,
  replaceState,
  resetState
};
