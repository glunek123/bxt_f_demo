// PAC 高保真 Demo 领域 Mock。
// 页面只能通过这里推进状态；不连接真实后端、支付、企微、通知或 AI。

const store = require('./store.js');
const config = require('./config.js');

const FICTION_NAMES = [
  '陈明', '李珊', '周远', '赵一鸣', '孙浩', '吴婧', '郑凯', '王琳',
  '刘洋', '黄磊', '徐菲', '马俊', '何静', '林涛', '高远', '罗薇',
  '唐宁', '许博', '宋琪', '曹宇', '邓楠', '蒋晨', '韩雪', '冯哲'
];
const PRACTICE_AREAS = ['民商事', '劳动争议', '婚姻家事', '刑事辩护', '行政争议'];
const DLP_PATTERN = /(1[3-9]\d{9}|微信|手机号|身份证|银行卡|完整案号|当事人全名|详细住址)/i;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.min(ms || 0, 100)));
}

function pad(value) {
  return value < 10 ? '0' + value : String(value);
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes())
  ].join('');
}

function parseTime(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const normalized = String(value).replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function makeId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
}

function sceneText(sceneCode) {
  return config.SCENE_TEXT[sceneCode] || sceneCode || '—';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function logTimeline(label, description, type) {
  const state = store.getState();
  const timeline = (state.timeline || []).slice();
  const now = Date.now();
  timeline.push({
    id: makeId('TL'),
    label,
    description: description || '',
    type: type || 'INFO',
    occurredAt: now,
    occurredAtText: formatTime(now)
  });
  store.setState({ timeline });
}

function pushMessage(message) {
  const state = store.getState();
  const messages = (state.messages || []).slice();
  messages.unshift(Object.assign({
    id: makeId('MSG'),
    read: false,
    time: formatTime(Date.now())
  }, message));
  store.setState({ messages });
}

function batchPlanForCount(count) {
  const bounded = Math.max(1, Math.min(config.CANDIDATE_CAP, Number(count) || 1));
  return (config.BATCH_MAPPING[bounded] || []).slice();
}

function distributeCandidates(candidates, plan) {
  let offset = 0;
  return candidates.map((candidate, index) => {
    let batchNo = 1;
    let cursor = 0;
    for (let i = 0; i < plan.length; i += 1) {
      cursor += plan[i];
      if (index < cursor) {
        batchNo = i + 1;
        break;
      }
    }
    offset += 1;
    return Object.assign({}, candidate, { snapshotOrder: offset, batchNo, invitationStatus: 'NOT_SENT' });
  });
}

function generateCandidates(count, excludedReceiverIds) {
  const excluded = new Set(excludedReceiverIds || []);
  const candidates = [];
  FICTION_NAMES.forEach((name, index) => {
    const receiverId = 'RECEIVER_DEMO_' + pad(index + 1);
    if (candidates.length >= count || excluded.has(receiverId)) return;
    candidates.push({
      candidateId: makeId('CAND'),
      receiverId,
      name,
      city: '上海',
      practiceArea: PRACTICE_AREAS[index % PRACTICE_AREAS.length],
      score: 96 - candidates.length * 2,
      scoreDetail: {
        cityAndInstitution: 30,
        sceneExperience: Math.max(15, 25 - candidates.length),
        responseStability: 18,
        availability: 14,
        practiceArea: 9
      }
    });
  });
  const plan = batchPlanForCount(Math.max(1, candidates.length));
  return { candidates: distributeCandidates(candidates, plan), plan };
}

function acknowledgeNotice() {
  const state = store.getState();
  const notice = Object.assign({}, state.notice, {
    acknowledged: true,
    acknowledgedAt: Date.now()
  });
  store.setState({ notice });
  return Promise.resolve({ ok: true, notice });
}

function saveDraft(payload) {
  const safeDraft = clone(payload || {});
  delete safeDraft.rawDescription;
  delete safeDraft.description;
  store.setState({ draft: safeDraft });
  return delay(80).then(() => ({ ok: true, draftId: 'DRAFT_PAC_LOCAL' }));
}

function aiExtract(description, selectedScene) {
  return delay(500).then(() => {
    const text = String(description || '').trim();
    if (text.length < 10 || text.length > 500) {
      return { ok: false, code: 'INVALID_LENGTH', message: '需求描述需为 10—500 字。' };
    }
    if (DLP_PATTERN.test(text)) {
      return {
        ok: false,
        code: 'SENSITIVE_CONTENT',
        message: '检测到联系方式或敏感信息，请删除或脱敏后再整理。'
      };
    }
    const sceneCode = selectedScene === 'LAWYER_MEETING' || /会见|看守所/.test(text)
      ? 'LAWYER_MEETING'
      : 'FILE_RETRIEVAL';
    const serviceAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const deadlineAt = Date.now() + 20 * 60 * 60 * 1000;
    const common = {
      sceneCode,
      city: '上海',
      institution: sceneCode === 'LAWYER_MEETING'
        ? '上海市第二看守所（演示虚构）'
        : '上海市浦东新区档案服务中心（演示虚构）',
      serviceItem: sceneCode === 'LAWYER_MEETING' ? '一般会见' : '诉讼档案复制',
      serviceAt: formatTime(serviceAt),
      matchDeadlineAt: formatTime(deadlineAt),
      urgency: '普通'
    };
    const structuredFields = sceneCode === 'LAWYER_MEETING'
      ? {
          meetingType: '一般会见',
          appointmentStatus: '预约中',
          appointmentAt: '',
          materialsStatus: '部分齐全',
          feedbackItems: ['基本情况', '签署材料'],
          sensitiveCase: false
        }
      : {
          archiveType: '诉讼档案',
          institutionType: '档案机构',
          retrievalMethods: ['现场查阅', '复制'],
          materialsStatus: '部分齐全',
          originalRequired: false,
          arrivalDate: formatTime(serviceAt).slice(0, 10)
        };
    return {
      ok: true,
      fields: Object.assign(common, { structuredFields }),
      pendingFields: ['institution', 'serviceAt'],
      note: 'AI 只生成可编辑候选字段，最终以您确认后的结构化信息为准。'
    };
  });
}

function validateDemand(payload) {
  const errors = {};
  const sceneCode = payload.sceneCode;
  if (!['FILE_RETRIEVAL', 'LAWYER_MEETING'].includes(sceneCode)) {
    errors.sceneCode = '请选择异地调档或律师会见。代开庭仅登记试点意向。';
  }
  if (!payload.city) errors.city = '请选择目标城市。';
  if (!payload.institution) errors.institution = '请选择或填写目标机构。';
  if (!payload.serviceItem) errors.serviceItem = '请选择协作事项。';
  const deadline = parseTime(payload.matchDeadlineAt);
  const serviceAt = parseTime(payload.serviceAt);
  const now = Date.now();
  if (!deadline || deadline <= now) errors.matchDeadlineAt = '停止匹配时间必须晚于当前时间。';
  if (!serviceAt || serviceAt <= now) errors.serviceAt = '期望服务时间必须晚于当前时间。';
  if (deadline && serviceAt && deadline >= serviceAt) {
    errors.matchDeadlineAt = '停止匹配时间必须早于期望服务时间。';
  }
  const leadMinutes = config.SCENE_LEAD_MINUTES[sceneCode] || 0;
  if (deadline && serviceAt && serviceAt - deadline < leadMinutes * 60 * 1000) {
    errors.serviceAt = '服务时间与停止匹配时间之间未满足本场景演示提前量。';
  }
  const supplement = String(payload.supplement || '');
  if (DLP_PATTERN.test(supplement)) errors.supplement = '补充说明包含敏感信息，请删除或脱敏。';
  return errors;
}

function submitDemand(payload) {
  return delay(280).then(() => {
    const errors = validateDemand(payload || {});
    if (Object.keys(errors).length) return { ok: false, errors };
    const state = store.getState();
    if (!state.notice.acknowledged) {
      return { ok: false, errors: { notice: '请先阅读并确认当前版本发布须知。' } };
    }
    const now = Date.now();
    const previous = state.demand;
    const demand = {
      id: previous && payload.fromEdit ? previous.id : makeId('DEMAND'),
      parentDemandId: previous ? previous.parentDemandId || previous.id : '',
      versionNo: previous && payload.fromEdit ? (previous.versionNo || 1) + 1 : 1,
      sceneCode: payload.sceneCode,
      scene: sceneText(payload.sceneCode),
      city: payload.city,
      institution: payload.institution,
      serviceItem: payload.serviceItem,
      practiceArea: payload.practiceArea || '',
      serviceAt: parseTime(payload.serviceAt),
      serviceAtText: formatTime(parseTime(payload.serviceAt)),
      matchDeadlineAt: parseTime(payload.matchDeadlineAt),
      matchDeadlineAtText: formatTime(parseTime(payload.matchDeadlineAt)),
      urgency: payload.urgency || '普通',
      structuredFields: clone(payload.structuredFields || {}),
      supplement: payload.supplement || '',
      aiAssisted: Boolean(payload.aiAssisted),
      status: 'AUDITING',
      auditResult: '',
      auditErrors: [],
      createdAt: now,
      updatedAt: now,
      expiresAt: 0
    };
    store.setState({
      demand,
      draft: null,
      matchRound: null,
      batches: [],
      candidates: [],
      invitations: [],
      collaborationAttempt: null,
      order: null,
      join: { initiator: 'NOT_OPENED', receiver: 'NOT_OPENED' },
      activeGroup: null,
      timeline: []
    });
    logTimeline('需求已提交', '已创建需求版本 V' + demand.versionNo + '，等待机器审核。', 'SUCCESS');
    return { ok: true, demand };
  });
}

function registerPilotInterest(payload) {
  return delay(240).then(() => {
    const state = store.getState();
    const record = {
      id: makeId('PILOT'),
      city: payload.city || '未选择',
      court: payload.court || '待补充',
      contactPreference: payload.contactPreference || '站内消息',
      status: 'REGISTERED',
      createdAtText: formatTime(Date.now())
    };
    const pilotInterests = (state.pilotInterests || []).slice();
    pilotInterests.unshift(record);
    store.setState({ pilotInterests });
    return { ok: true, record };
  });
}

function reserveGroup(round) {
  const state = store.getState();
  if (!state.demo.groupAvailable) {
    const waitingRound = Object.assign({}, round, { status: 'WAITING_GROUP', groupId: '' });
    store.setState({ matchRound: waitingRound, activeGroup: null });
    logTimeline('等待健康协作群', '当前没有可用空群，系统不会发送邀请。', 'WARNING');
    return { ok: false, reason: 'NO_HEALTHY_GROUP' };
  }
  const index = (state.groupPool || []).findIndex((group) => group.status === 'EMPTY_READY');
  if (index < 0) {
    const waitingRound = Object.assign({}, round, { status: 'WAITING_GROUP', groupId: '' });
    store.setState({ matchRound: waitingRound, activeGroup: null });
    logTimeline('等待健康协作群', '群池水位不足，匹配已安全暂停。', 'WARNING');
    return { ok: false, reason: 'NO_HEALTHY_GROUP' };
  }
  const groupPool = state.groupPool.map((group, groupIndex) => (
    groupIndex === index
      ? Object.assign({}, group, { status: 'RESERVED', reservedAt: Date.now(), leaseExpiresAt: Date.now() + 20 * 60 * 1000 })
      : group
  ));
  const activeGroup = clone(groupPool[index]);
  const reservedRound = Object.assign({}, round, { groupId: activeGroup.id, status: 'MATCHING' });
  store.setState({ groupPool, activeGroup, matchRound: reservedRound });
  logTimeline('健康协作群已预占', '匹配轮次已独占一个空群，同轮切批继续沿用。', 'SUCCESS');
  return { ok: true, round: reservedRound, group: activeGroup };
}

function createMatchSnapshot(candidateCount) {
  const state = store.getState();
  const demand = state.demand;
  if (!demand) return Promise.resolve({ ok: false, reason: 'NO_DEMAND' });
  const generated = generateCandidates(
    Math.min(config.CANDIDATE_CAP, Number(candidateCount) || config.CANDIDATE_CAP),
    state.reachedReceiverIds
  );
  if (!generated.candidates.length) {
    const noMatchDemand = Object.assign({}, demand, { status: 'NO_MATCH' });
    store.setState({ demand: noMatchDemand });
    return Promise.resolve({ ok: false, reason: 'NO_CANDIDATE' });
  }
  const now = Date.now();
  const round = {
    id: makeId('ROUND'),
    demandId: demand.id,
    roundNo: state.matchRound ? (state.matchRound.roundNo || 0) + 1 : 1,
    snapshotId: makeId('SNAPSHOT'),
    status: 'PREPARING',
    currentBatchNo: 1,
    batchPlan: generated.plan,
    candidateCount: generated.candidates.length,
    winnerReceiverId: '',
    groupId: '',
    scoreVersion: 'score-demo-v1',
    configVersion: 'match-demo-v2',
    createdAt: now,
    expiresAt: Math.min(now + config.DEMAND_VALID_MS, demand.matchDeadlineAt)
  };
  const batches = generated.plan.map((size, index) => ({
    batchNo: index + 1,
    size,
    status: 'PLANNED',
    expiresAt: 0
  }));
  // 历史邀请保留其终态；新轮次只追加新邀请，绝不“清空后复活”旧邀请。
  store.setState({
    matchRound: round,
    candidates: generated.candidates,
    batches,
    invitations: (state.invitations || []).slice()
  });
  logTimeline('候选快照已冻结', '候选顺序、分数、配置版本和批次计划已冻结。', 'INFO');
  return Promise.resolve({ ok: true, round });
}

function activateBatch(batchNo) {
  const state = store.getState();
  const round = state.matchRound;
  if (!round || round.status === 'WAITING_GROUP' || round.winnerReceiverId) {
    return Promise.resolve({ ok: false, reason: 'ROUND_NOT_ACTIVE' });
  }
  const now = Date.now();
  const expiresAt = Math.min(now + config.INVITE_TTL_MS, round.expiresAt);
  const candidates = state.candidates.map((candidate) => (
    candidate.batchNo === batchNo && candidate.invitationStatus === 'NOT_SENT'
      ? Object.assign({}, candidate, { invitationStatus: 'PENDING' })
      : candidate
  ));
  const newInvitations = candidates
    .filter((candidate) => candidate.batchNo === batchNo && candidate.invitationStatus === 'PENDING')
    .map((candidate) => ({
      invitationId: makeId('INVITATION'),
      demandId: round.demandId,
      candidateId: candidate.candidateId,
      receiverId: candidate.receiverId,
      batchNo,
      status: 'PENDING',
      expiresAt,
      ownerCurrentUser: false,
      openedAfterLock: false
    }));
  const invitations = (state.invitations || []).concat(newInvitations);
  const batches = state.batches.map((batch) => (
    batch.batchNo === batchNo ? Object.assign({}, batch, { status: 'ACTIVE', expiresAt }) : batch
  ));
  const reachedReceiverIds = Array.from(new Set(
    (state.reachedReceiverIds || []).concat(newInvitations.map((invitation) => invitation.receiverId))
  ));
  const nextRound = Object.assign({}, round, { status: 'MATCHING', currentBatchNo: batchNo });
  const demand = Object.assign({}, state.demand, { status: 'MATCHING' });
  store.setState({ candidates, invitations, batches, reachedReceiverIds, matchRound: nextRound, demand });
  logTimeline('第 ' + batchNo + ' 批邀请已发送', '本批 ' + newInvitations.length + ' 位律师，演示倒计时 15 秒。', 'INFO');
  return Promise.resolve({ ok: true, expiresAt });
}

async function startMatching(candidateCount) {
  const snapshot = await createMatchSnapshot(candidateCount);
  if (!snapshot.ok) return snapshot;
  const reserved = reserveGroup(store.getState().matchRound);
  if (!reserved.ok) return reserved;
  return activateBatch(1);
}

function runAudit(mode) {
  return delay(240).then(async () => {
    const state = store.getState();
    const demand = state.demand;
    if (!demand) return { ok: false, reason: 'NO_DEMAND' };
    if (demand.matchDeadlineAt <= Date.now()) {
      const expired = Object.assign({}, demand, { status: 'EXPIRED', auditResult: 'EXPIRED' });
      store.setState({ demand: expired });
      logTimeline('需求已过期', '审核完成时已超过停止匹配时间。', 'ERROR');
      return { ok: true, status: 'EXPIRED' };
    }
    if (mode === 'MANUAL_REVIEW') {
      const manual = Object.assign({}, demand, { status: 'MANUAL_REVIEW', auditResult: 'MANUAL_REVIEW' });
      store.setState({ demand: manual });
      logTimeline('进入人工审核', '机器无法自动判定，等待专员处理。', 'WARNING');
      return { ok: true, status: 'MANUAL_REVIEW' };
    }
    if (mode === 'NEED_EDIT') {
      const returned = Object.assign({}, demand, {
        status: 'NEED_EDIT',
        auditResult: 'NEED_EDIT',
        auditErrors: [{ field: 'institution', message: '机构名称需要选择标准结果或标记待核验。' }]
      });
      store.setState({ demand: returned });
      logTimeline('审核退回修改', '已定位到目标机构字段。', 'WARNING');
      return { ok: true, status: 'NEED_EDIT' };
    }
    if (mode === 'REJECT') {
      const rejected = Object.assign({}, demand, { status: 'CLOSED', auditResult: 'REJECT' });
      store.setState({ demand: rejected });
      logTimeline('需求无法发布', '内容不符合当前可发布范围。', 'ERROR');
      return { ok: true, status: 'CLOSED' };
    }
    const ready = Object.assign({}, demand, {
      status: 'READY',
      auditResult: 'PASS',
      auditErrors: [],
      auditPassedAt: Date.now(),
      expiresAt: Math.min(Date.now() + config.DEMAND_VALID_MS, demand.matchDeadlineAt)
    });
    store.setState({ demand: ready });
    logTimeline('机器审核通过', '需求已进入匹配准备。', 'SUCCESS');
    await startMatching(12);
    return { ok: true, status: store.getState().demand.status };
  });
}

function advanceOrCloseBatch(finalStatus) {
  const state = store.getState();
  const round = state.matchRound;
  if (!round || round.winnerReceiverId) return Promise.resolve({ ok: false });
  const current = round.currentBatchNo;
  const batches = state.batches.map((batch) => (
    batch.batchNo === current ? Object.assign({}, batch, { status: finalStatus }) : batch
  ));
  store.setState({ batches });
  const nextBatchNo = current + 1;
  if (nextBatchNo <= round.batchPlan.length && Date.now() < round.expiresAt) {
    const switching = Object.assign({}, round, { status: 'BATCH_SWITCHING' });
    store.setState({ matchRound: switching });
    logTimeline('正在扩大匹配范围', '上一批已结束，系统自动启动下一批。', 'INFO');
    return activateBatch(nextBatchNo);
  }
  const noMatchRound = Object.assign({}, round, { status: 'NO_MATCH' });
  const demand = Object.assign({}, state.demand, { status: 'NO_MATCH' });
  store.setState({ matchRound: noMatchRound, demand });
  logTimeline('本轮未匹配成功', '三批均无人接受，结果为未匹配，不等同于截止时间过期。', 'WARNING');
  pushMessage({
    type: '匹配',
    typeKey: 'nomatch',
    title: '本轮暂未匹配到律师',
    summary: '可修改需求、联系运营或结束需求。',
    page: '/pages/collaboration/collaboration'
  });
  return Promise.resolve({ ok: true, status: 'NO_MATCH' });
}

function declineCurrentBatch() {
  return delay(160).then(() => {
    const state = store.getState();
    const round = state.matchRound;
    if (!round) return { ok: false };
    const batchNo = round.currentBatchNo;
    const candidates = state.candidates.map((candidate) => (
      candidate.batchNo === batchNo && candidate.invitationStatus === 'PENDING'
        ? Object.assign({}, candidate, { invitationStatus: 'REJECTED' })
        : candidate
    ));
    const invitations = state.invitations.map((invitation) => (
      invitation.batchNo === batchNo && invitation.status === 'PENDING'
        ? Object.assign({}, invitation, { status: 'REJECTED' })
        : invitation
    ));
    store.setState({ candidates, invitations });
    return advanceOrCloseBatch('ALL_REJECTED');
  });
}

function timeoutCurrentBatch() {
  return delay(160).then(() => {
    const state = store.getState();
    const round = state.matchRound;
    if (!round) return { ok: false };
    const batchNo = round.currentBatchNo;
    const candidates = state.candidates.map((candidate) => (
      candidate.batchNo === batchNo && candidate.invitationStatus === 'PENDING'
        ? Object.assign({}, candidate, { invitationStatus: 'TIMEOUT_REJECTED' })
        : candidate
    ));
    const invitations = state.invitations.map((invitation) => (
      invitation.batchNo === batchNo && invitation.status === 'PENDING'
        ? Object.assign({}, invitation, { status: 'TIMEOUT_REJECTED' })
        : invitation
    ));
    store.setState({ candidates, invitations });
    return advanceOrCloseBatch('TIMED_OUT');
  });
}

function availableVoucher() {
  return (store.getState().vouchers || []).find((voucher) => voucher.status === 'AVAILABLE') || null;
}

function issueLockLossVoucher(parentDemandId, receiverId) {
  const state = store.getState();
  const type = 'PUBLISH_CONNECTION_1_YUAN';
  const existing = (state.vouchers || []).find((voucher) => (
    voucher.sourceDemandId === parentDemandId &&
    voucher.receiverId === receiverId &&
    voucher.type === type
  ));
  if (existing) return existing;
  const voucher = {
    id: makeId('VOUCHER'),
    type,
    amount: 1,
    status: 'AVAILABLE',
    sourceDemandId: parentDemandId,
    receiverId,
    sourceText: '邀请锁后补贴',
    expiresAtText: formatTime(Date.now() + 30 * 24 * 60 * 60 * 1000).slice(0, 10)
  };
  const vouchers = (state.vouchers || []).concat([voucher]);
  store.setState({ vouchers });
  pushMessage({
    type: '补贴',
    typeKey: 'voucher',
    title: '1 元补贴券已发放',
    summary: '该邀请已由其他律师接洽，补贴券可用于您下一次发布后的连接费。',
    page: '/pages/vouchers/index'
  });
  return voucher;
}

function lockWinner(invitationId) {
  const state = store.getState();
  const round = state.matchRound;
  const invitation = state.invitations.find((item) => item.invitationId === invitationId);
  if (!round || !invitation) return { result: 'NOT_FOUND' };
  if (round.winnerReceiverId) {
    if (invitation.status === 'PENDING') {
      const invitations = state.invitations.map((item) => (
        item.invitationId === invitationId ? Object.assign({}, item, { status: 'INVALIDATED_BY_LOCK' }) : item
      ));
      store.setState({ invitations });
      if (invitation.ownerCurrentUser && Date.now() < invitation.expiresAt) {
        issueLockLossVoucher(invitation.demandId, invitation.receiverId);
      }
    }
    return { result: 'LOCKED_BY_OTHER' };
  }
  if (invitation.status !== 'PENDING' || Date.now() >= invitation.expiresAt) {
    return { result: invitation.status === 'PENDING' ? 'TIMEOUT_REJECTED' : invitation.status };
  }
  const winner = state.candidates.find((candidate) => candidate.candidateId === invitation.candidateId);
  const invitations = state.invitations.map((item) => {
    if (item.invitationId === invitationId) return Object.assign({}, item, { status: 'ACCEPTED' });
    if (item.status === 'PENDING') return Object.assign({}, item, { status: 'INVALIDATED_BY_LOCK' });
    return item;
  });
  const candidates = state.candidates.map((candidate) => {
    if (candidate.candidateId === invitation.candidateId) return Object.assign({}, candidate, { invitationStatus: 'ACCEPTED' });
    if (candidate.invitationStatus === 'PENDING') return Object.assign({}, candidate, { invitationStatus: 'INVALIDATED_BY_LOCK' });
    if (candidate.invitationStatus === 'NOT_SENT') return Object.assign({}, candidate, { invitationStatus: 'CANCELLED_BY_LOCK' });
    return candidate;
  });
  const batches = state.batches.map((batch) => {
    if (batch.batchNo === round.currentBatchNo) return Object.assign({}, batch, { status: 'LOCKED_SUCCESS' });
    if (batch.status === 'PLANNED') return Object.assign({}, batch, { status: 'CANCELLED' });
    return batch;
  });
  const collaborationAttempt = {
    id: makeId('COLLAB'),
    demandId: round.demandId,
    receiverId: invitation.receiverId,
    receiverName: winner ? winner.name : '接收律师',
    status: 'WAIT_PAY',
    createdAt: Date.now(),
    bothJoinedAt: 0,
    closedAt: 0,
    failureReason: ''
  };
  const order = {
    id: makeId('ORDER'),
    collaborationId: collaborationAttempt.id,
    originalAmount: 1,
    discountAmount: 0,
    payableAmount: 1,
    status: 'UNPAID',
    method: '',
    expiresAt: Date.now() + config.PAYMENT_TTL_MS,
    createdAt: Date.now()
  };
  const matchRound = Object.assign({}, round, {
    status: 'LOCKED',
    winnerReceiverId: invitation.receiverId,
    collaborationId: collaborationAttempt.id
  });
  const demand = Object.assign({}, state.demand, { status: 'LOCKED' });
  store.setState({ invitations, candidates, batches, collaborationAttempt, order, matchRound, demand });
  logTimeline('接收律师已锁定', '首位有效接受者获得本次协作资格；赢家不发放补贴券。', 'SUCCESS');
  pushMessage({
    type: '连接',
    typeKey: 'accept',
    title: '已匹配到接收律师',
    summary: '请在 10 分钟内完成 1 元连接信息服务费确认。',
    page: '/pages/collaboration/collaboration'
  });
  return { result: 'ACCEPTED', collaborationId: collaborationAttempt.id };
}

function receiverAcceptInvitation(invitationId) {
  return delay(200).then(() => {
    const state = store.getState();
    const inbox = (state.receiverInbox || []).find((item) => item.invitationId === invitationId);
    if (inbox) {
      if (state.receiverSettings.certificationStatus !== 'VALID' || !state.receiverSettings.receivingEnabled) {
        return {
          result: 'QUALIFICATION_ERROR',
          message: state.receiverSettings.certificationStatus !== 'VALID'
            ? '当前律师认证状态不可接收邀请。'
            : '接收邀请总开关已关闭。'
        };
      }
      if (Date.now() >= inbox.expiresAt && inbox.status === 'PENDING') {
        const receiverInbox = state.receiverInbox.map((item) => (
          item.invitationId === invitationId ? Object.assign({}, item, { status: 'TIMEOUT_REJECTED' }) : item
        ));
        store.setState({ receiverInbox });
        return { result: 'TIMEOUT_REJECTED' };
      }
      if (inbox.status === 'INVALIDATED_BY_LOCK') {
        issueLockLossVoucher(inbox.parentDemandId, inbox.receiverId);
        return { result: 'LOCKED_BY_OTHER' };
      }
      if (inbox.status !== 'PENDING') return { result: inbox.status };
      const collaborationId = makeId('RECEIVED_COLLAB');
      const receiverInbox = state.receiverInbox.map((item) => (
        item.invitationId === invitationId
          ? Object.assign({}, item, { status: 'ACCEPTED', collaborationId })
          : item
      ));
      store.setState({ receiverInbox });
      return { result: 'ACCEPTED', collaborationId };
    }
    return lockWinner(invitationId);
  });
}

function receiverDeclineInvitation(invitationId, reason) {
  return delay(160).then(() => {
    const state = store.getState();
    if ((state.receiverInbox || []).some((item) => item.invitationId === invitationId)) {
      const receiverInbox = state.receiverInbox.map((item) => (
        item.invitationId === invitationId && item.status === 'PENDING'
          ? Object.assign({}, item, { status: 'REJECTED', rejectReason: reason || '暂不接收' })
          : item
      ));
      store.setState({ receiverInbox });
      return { result: 'REJECTED' };
    }
    const invitation = state.invitations.find((item) => item.invitationId === invitationId);
    if (!invitation || invitation.status !== 'PENDING') return { result: invitation ? invitation.status : 'NOT_FOUND' };
    const invitations = state.invitations.map((item) => (
      item.invitationId === invitationId ? Object.assign({}, item, { status: 'REJECTED' }) : item
    ));
    const candidates = state.candidates.map((candidate) => (
      candidate.candidateId === invitation.candidateId
        ? Object.assign({}, candidate, { invitationStatus: 'REJECTED' })
        : candidate
    ));
    store.setState({ invitations, candidates });
    const stillPending = candidates.some((candidate) => (
      candidate.batchNo === state.matchRound.currentBatchNo && candidate.invitationStatus === 'PENDING'
    ));
    if (!stillPending) advanceOrCloseBatch('ALL_REJECTED');
    return { result: 'REJECTED' };
  });
}

function openReceiverInvitation(invitationId) {
  const state = store.getState();
  const invitation = (state.receiverInbox || []).find((item) => item.invitationId === invitationId);
  if (!invitation) return Promise.resolve({ ok: false });
  let voucher = null;
  if (invitation.status === 'INVALIDATED_BY_LOCK' && Date.now() < invitation.expiresAt) {
    voucher = issueLockLossVoucher(invitation.parentDemandId, invitation.receiverId);
    const receiverInbox = state.receiverInbox.map((item) => (
      item.invitationId === invitationId ? Object.assign({}, item, { openedAfterLock: true }) : item
    ));
    store.setState({ receiverInbox, currentReceiverInvitationId: invitationId });
  } else {
    store.setState({ currentReceiverInvitationId: invitationId });
  }
  return Promise.resolve({ ok: true, voucher });
}

function getReceiverInvitations() {
  return (store.getState().receiverInbox || []).slice();
}

function simulateReceiverAccept() {
  const state = store.getState();
  const round = state.matchRound;
  if (!round) return Promise.resolve({ result: 'NO_ACTIVE_ROUND' });
  const invitation = state.invitations
    .filter((item) => item.batchNo === round.currentBatchNo && item.status === 'PENDING')
    .sort((a, b) => {
      const ca = state.candidates.find((candidate) => candidate.candidateId === a.candidateId);
      const cb = state.candidates.find((candidate) => candidate.candidateId === b.candidateId);
      return (cb ? cb.score : 0) - (ca ? ca.score : 0);
    })[0];
  return invitation ? receiverAcceptInvitation(invitation.invitationId) : Promise.resolve({ result: 'NO_PENDING_INVITATION' });
}

function payConnection(options) {
  return delay(320).then(() => {
    const state = store.getState();
    const attempt = state.collaborationAttempt;
    const order = state.order;
    if (!attempt || !order || attempt.status !== 'WAIT_PAY') return { ok: false, reason: 'NOT_PAYABLE' };
    if (Date.now() >= order.expiresAt) return paymentTimeout();
    const selected = options && options.useVoucher ? availableVoucher() : null;
    if (options && options.confirmingOnly) {
      const confirmingOrder = Object.assign({}, order, {
        status: 'CONFIRMING',
        method: '微信支付（Mock 查询中）'
      });
      const confirmingAttempt = Object.assign({}, attempt, { status: 'PAYMENT_CONFIRMING' });
      store.setState({ order: confirmingOrder, collaborationAttempt: confirmingAttempt });
      logTimeline('支付结果确认中', '正式流程以服务端回调或主动查询结果为准。', 'INFO');
      return { ok: true, status: 'CONFIRMING' };
    }
    let vouchers = state.vouchers;
    let nextOrder;
    if (selected) {
      vouchers = state.vouchers.map((voucher) => (
        voucher.id === selected.id ? Object.assign({}, voucher, { status: 'USED', usedAtText: formatTime(Date.now()) }) : voucher
      ));
      nextOrder = Object.assign({}, order, {
        discountAmount: 1,
        payableAmount: 0,
        status: 'PAID_BY_VOUCHER',
        method: '内部零支付订单',
        paidAt: Date.now(),
        voucherId: selected.id
      });
    } else {
      nextOrder = Object.assign({}, order, {
        discountAmount: 0,
        payableAmount: 1,
        status: 'PAID',
        method: '微信支付（Mock 成功）',
        paidAt: Date.now(),
        channelTransactionId: makeId('MOCK_TX')
      });
    }
    const collaborationAttempt = Object.assign({}, attempt, { status: 'WAIT_JOIN', joinDeadlineAt: Date.now() + config.JOIN_TTL_MS });
    store.setState({ order: nextOrder, vouchers, collaborationAttempt });
    logTimeline(
      '连接费已确认',
      nextOrder.status === 'PAID_BY_VOUCHER'
        ? '1 元补贴券已原子核销，未调用微信支付。'
        : 'Mock 支付成功，正式结果应以服务端回调或查询为准。',
      'SUCCESS'
    );
    return {
      ok: true,
      zero: nextOrder.payableAmount === 0,
      payable: nextOrder.payableAmount,
      status: nextOrder.status
    };
  });
}

function refundPayment() {
  const state = store.getState();
  if (!state.order || !['PAID', 'PAID_BY_VOUCHER'].includes(state.order.status) || !state.collaborationAttempt) {
    return Promise.resolve({ ok: false });
  }
  const order = Object.assign({}, state.order, {
    status: 'REFUNDED',
    refundedAt: Date.now(),
    refundMethod: state.order.status === 'PAID_BY_VOUCHER' ? '补贴券退回（Mock）' : '原路退款（Mock）'
  });
  const vouchers = state.order.voucherId
    ? state.vouchers.map((voucher) => voucher.id === state.order.voucherId ? Object.assign({}, voucher, { status: 'AVAILABLE', usedAtText: '' }) : voucher)
    : state.vouchers;
  const collaborationAttempt = Object.assign({}, state.collaborationAttempt, {
    status: 'PAYMENT_REFUNDED',
    closedAt: Date.now()
  });
  store.setState({ order, vouchers, collaborationAttempt });
  logTimeline('连接费已退款', order.refundMethod + '；当前协作尝试已关闭。', 'WARNING');
  return Promise.resolve({ ok: true, status: 'PAYMENT_REFUNDED' });
}

function paymentTimeout() {
  const state = store.getState();
  if (!state.order || !state.collaborationAttempt) return Promise.resolve({ ok: false });
  const order = Object.assign({}, state.order, { status: 'CLOSED', closedAt: Date.now() });
  const collaborationAttempt = Object.assign({}, state.collaborationAttempt, { status: 'PAYMENT_TIMEOUT', closedAt: Date.now() });
  const demand = Object.assign({}, state.demand, { status: 'LOCKED' });
  store.setState({ order, collaborationAttempt, demand });
  logTimeline('支付窗口已结束', '当前接收资格已解除；系统不会自动启动下一批。', 'ERROR');
  return Promise.resolve({ ok: true, status: 'PAYMENT_TIMEOUT' });
}

function openJoinEntry(role) {
  return delay(180).then(() => {
    const state = store.getState();
    if (!state.collaborationAttempt || state.collaborationAttempt.status !== 'WAIT_JOIN') {
      return { ok: false, reason: 'NOT_WAITING_JOIN' };
    }
    const join = Object.assign({}, state.join, { [role]: 'ENTRY_OPENED' });
    const activeGroup = Object.assign({}, state.activeGroup || {}, { entryExposed: true });
    const groupPool = state.groupPool.map((group) => (
      group.id === activeGroup.id ? Object.assign({}, group, { entryExposed: true }) : group
    ));
    store.setState({ join, activeGroup, groupPool });
    logTimeline(role === 'initiator' ? '发起方已打开入群入口' : '接收方已打开入群入口', '打开入口不等于实际入群，等待企微回调或查询对账。', 'INFO');
    return { ok: true, status: 'ENTRY_OPENED' };
  });
}

function reconcileJoin(role, success) {
  return delay(200).then(() => {
    const state = store.getState();
    const join = Object.assign({}, state.join, { [role]: success === false ? 'FAILED' : 'JOINED' });
    let collaborationAttempt = state.collaborationAttempt;
    let activeGroup = state.activeGroup;
    if (join.initiator === 'JOINED' && join.receiver === 'JOINED') {
      collaborationAttempt = Object.assign({}, collaborationAttempt, {
        status: 'COMMUNICATING',
        bothJoinedAt: Date.now()
      });
      activeGroup = Object.assign({}, activeGroup || {}, { status: 'ACTIVE', externalMemberCount: 2 });
      logTimeline('双方实际入群已确认', '企微回调/查询对账确认双方均已入群，进入沟通中。', 'SUCCESS');
    } else if (success === false) {
      collaborationAttempt = Object.assign({}, collaborationAttempt, { status: 'JOIN_EXCEPTION' });
      logTimeline('入群状态异常', '需要重新获取入口或联系运营核验。', 'ERROR');
    } else {
      logTimeline(role === 'initiator' ? '发起方已确认入群' : '接收方已确认入群', '等待另一方实际入群。', 'INFO');
    }
    const groupPool = state.groupPool.map((group) => (
      activeGroup && group.id === activeGroup.id ? clone(activeGroup) : group
    ));
    store.setState({ join, collaborationAttempt, activeGroup, groupPool });
    return { ok: true, both: join.initiator === 'JOINED' && join.receiver === 'JOINED' };
  });
}

function closeCollaborationRecord() {
  return delay(180).then(() => {
    const state = store.getState();
    const attempt = state.collaborationAttempt;
    if (!attempt || attempt.status !== 'COMMUNICATING') return { ok: false };
    const collaborationAttempt = Object.assign({}, attempt, { status: 'CLOSED_CONNECTED', closedAt: Date.now() });
    const demand = Object.assign({}, state.demand, { status: 'CLOSED' });
    const activeGroup = Object.assign({}, state.activeGroup || {}, { status: 'ARCHIVING' });
    const groupPool = state.groupPool.map((group) => (
      group.id === activeGroup.id ? clone(activeGroup) : group
    ));
    store.setState({ collaborationAttempt, demand, activeGroup, groupPool });
    logTimeline('协作记录已结束', '仅表示平台连接记录结束，不代表平台确认法律服务已经履行。', 'SUCCESS');
    return { ok: true, status: 'CLOSED_CONNECTED' };
  });
}

function reportNegotiationFailed(reason) {
  return delay(180).then(() => {
    const state = store.getState();
    const attempt = state.collaborationAttempt;
    if (!attempt || attempt.status !== 'COMMUNICATING') return { ok: false };
    const now = Date.now();
    const collaborationAttempt = Object.assign({}, attempt, {
      status: 'NEGOTIATION_FAILED',
      failureReason: reason || '其他',
      closedAt: now
    });
    const activeGroup = Object.assign({}, state.activeGroup || {}, { status: 'ARCHIVING' });
    const groupPool = state.groupPool.map((group) => (
      group.id === activeGroup.id ? clone(activeGroup) : group
    ));
    const riskEvents = (state.riskEvents || []).slice();
    if (attempt.bothJoinedAt && now - attempt.bothJoinedAt < config.FAST_REMATCH_THRESHOLD_MS) {
      riskEvents.push({
        id: makeId('RISK'),
        type: 'FAST_REMATCH',
        reason: reason || '其他',
        createdAtText: formatTime(now)
      });
    }
    store.setState({ collaborationAttempt, activeGroup, groupPool, riskEvents });
    logTimeline('沟通未达成', '原因：' + (reason || '其他') + '。请选择重新匹配、修改协作内容或结束需求。', 'WARNING');
    return { ok: true, riskCreated: riskEvents.length > (state.riskEvents || []).length };
  });
}

function retireActiveGroup() {
  const state = store.getState();
  if (!state.activeGroup) return;
  const retired = Object.assign({}, state.activeGroup, { status: 'RETIRED' });
  const groupPool = state.groupPool.map((group) => (
    group.id === retired.id ? retired : group
  ));
  store.setState({ activeGroup: retired, groupPool });
}

async function rematch() {
  const state = store.getState();
  if (!state.demand || !state.collaborationAttempt || !['NEGOTIATION_FAILED', 'PAYMENT_TIMEOUT', 'JOIN_EXCEPTION'].includes(state.collaborationAttempt.status)) {
    return { ok: false, reason: 'REMATCH_NOT_ALLOWED' };
  }
  retireActiveGroup();
  const previousRoundNo = state.matchRound ? state.matchRound.roundNo : 0;
  const demand = Object.assign({}, state.demand, { status: 'READY' });
  store.setState({
    demand,
    matchRound: previousRoundNo ? Object.assign({}, state.matchRound, { roundNo: previousRoundNo }) : null,
    collaborationAttempt: null,
    order: null,
    join: { initiator: 'NOT_OPENED', receiver: 'NOT_OPENED' },
    activeGroup: null
  });
  logTimeline('创建新一轮匹配', '旧邀请保持终态；排除全部历史已触达律师并预占新群。', 'INFO');
  return startMatching(12);
}

function expireDemand() {
  const state = store.getState();
  if (!state.demand) return Promise.resolve({ ok: false });
  const demand = Object.assign({}, state.demand, { status: 'EXPIRED' });
  const matchRound = state.matchRound ? Object.assign({}, state.matchRound, { status: 'EXPIRED' }) : null;
  const invitations = state.invitations.map((invitation) => (
    invitation.status === 'PENDING' ? Object.assign({}, invitation, { status: 'CANCELLED_BY_DEMAND' }) : invitation
  ));
  store.setState({ demand, matchRound, invitations });
  logTimeline('需求已过期', '已超过停止匹配时间，系统停止发送和接受邀请。', 'ERROR');
  return Promise.resolve({ ok: true, status: 'EXPIRED' });
}

function closeDemand(reason) {
  const state = store.getState();
  if (!state.demand) return Promise.resolve({ ok: false });
  const demand = Object.assign({}, state.demand, { status: 'CLOSED', closeReason: reason || '用户结束需求' });
  const matchRound = state.matchRound && !['NO_MATCH', 'EXPIRED', 'CLOSED'].includes(state.matchRound.status)
    ? Object.assign({}, state.matchRound, { status: 'CLOSED' })
    : state.matchRound;
  const invitations = state.invitations.map((invitation) => (
    invitation.status === 'PENDING' ? Object.assign({}, invitation, { status: 'CANCELLED_BY_DEMAND' }) : invitation
  ));
  const collaborationAttempt = state.collaborationAttempt && state.collaborationAttempt.status !== 'CLOSED_CONNECTED'
    ? Object.assign({}, state.collaborationAttempt, { status: 'CLOSED', closedAt: Date.now() })
    : state.collaborationAttempt;
  store.setState({ demand, matchRound, invitations, collaborationAttempt });
  logTimeline('需求已结束', reason || '用户主动结束本次需求。', 'INFO');
  return Promise.resolve({ ok: true, status: 'CLOSED' });
}

function publicStatus(stateInput) {
  const state = stateInput || store.getState();
  const demand = state.demand;
  const round = state.matchRound;
  const attempt = state.collaborationAttempt;
  if (!demand) return 'EMPTY';
  if (['AUDITING', 'NEED_EDIT', 'MANUAL_REVIEW', 'EXPIRED', 'NO_MATCH'].includes(demand.status)) return demand.status;
  if (round && round.status === 'WAITING_GROUP') return 'MATCH_PREPARING';
  if (round && ['MATCHING', 'BATCH_SWITCHING', 'PREPARING'].includes(round.status)) return 'MATCHING';
  if (attempt) return attempt.status;
  if (demand.status === 'CLOSED') return 'CLOSED';
  return demand.status;
}

function getCollaborationView() {
  const state = store.getState();
  const status = publicStatus(state);
  const round = state.matchRound;
  const activeBatch = round
    ? state.batches.find((batch) => batch.batchNo === round.currentBatchNo)
    : null;
  const voucher = availableVoucher();
  return {
    status,
    demand: state.demand,
    round,
    activeBatch,
    collaborationAttempt: state.collaborationAttempt,
    order: state.order,
    join: clone(state.join),
    activeGroup: state.activeGroup,
    timeline: (state.timeline || []).slice().reverse(),
    availableVoucher: voucher,
    riskEvents: state.riskEvents || []
  };
}

function seedDemandForScenario() {
  const now = Date.now();
  return submitDemand({
    sceneCode: 'FILE_RETRIEVAL',
    city: '上海',
    institution: '上海市浦东新区档案服务中心（演示虚构）',
    serviceItem: '诉讼档案复制',
    practiceArea: '民商事',
    serviceAt: formatTime(now + 7 * 24 * 60 * 60 * 1000),
    matchDeadlineAt: formatTime(now + 20 * 60 * 60 * 1000),
    urgency: '普通',
    structuredFields: {
      archiveType: '诉讼档案',
      institutionType: '档案机构',
      retrievalMethods: ['现场查阅', '复制'],
      materialsStatus: '部分齐全',
      originalRequired: false
    },
    supplement: '请协助复制公开可调取的诉讼档案材料。',
    aiAssisted: true
  });
}

async function loadScenario(code) {
  store.resetState();
  await acknowledgeNotice();
  store.setState({ demo: { scenario: code, groupAvailable: code !== 'NO_GROUP', lastAction: '已载入场景' } });
  if (code === 'INITIAL') return { ok: true };
  if (code === 'LOCK_LOSS_VOUCHER') {
    const state = store.getState();
    const receiverInbox = state.receiverInbox.map((item, index) => (
      index === 0
        ? Object.assign({}, item, {
            status: 'INVALIDATED_BY_LOCK',
            expiresAt: Date.now() + 15 * 60 * 1000,
            openedAfterLock: false
          })
        : item
    ));
    const vouchers = state.vouchers.filter((voucher) => voucher.sourceDemandId !== 'D-INBOX-DEMO-001');
    store.setState({ receiverInbox, vouchers, currentReceiverInvitationId: receiverInbox[0].invitationId });
    return { ok: true, route: '/pages/invitation/invitation' };
  }
  await seedDemandForScenario();
  if (code === 'AUDIT_RETURN') {
    await runAudit('NEED_EDIT');
    return { ok: true };
  }
  await runAudit('PASS');
  if (code === 'NO_GROUP') return { ok: true };
  if (code === 'BATCH_SWITCH') {
    await declineCurrentBatch();
    return { ok: true };
  }
  if (code === 'NO_MATCH') {
    while (store.getState().matchRound && store.getState().matchRound.status === 'MATCHING') {
      await declineCurrentBatch();
    }
    return { ok: true };
  }
  await simulateReceiverAccept();
  if (code === 'PAYMENT_TIMEOUT') {
    await paymentTimeout();
    return { ok: true };
  }
  if (code === 'PAYMENT_CONFIRMING') {
    await payConnection({ confirmingOnly: true });
    return { ok: true };
  }
  await payConnection({ useVoucher: true });
  if (code === 'PAYMENT_REFUNDED') {
    await refundPayment();
    return { ok: true };
  }
  if (code === 'JOIN_EXCEPTION') {
    await openJoinEntry('initiator');
    await reconcileJoin('initiator', false);
    return { ok: true };
  }
  await openJoinEntry('initiator');
  await reconcileJoin('initiator', true);
  await openJoinEntry('receiver');
  await reconcileJoin('receiver', true);
  if (code === 'NEGOTIATION_FAILED') {
    await reportNegotiationFailed('时间无法协调');
  }
  return { ok: true };
}

async function advanceHappyPath() {
  const state = store.getState();
  const status = publicStatus(state);
  if (status === 'EMPTY' || status === 'CLOSED') {
    await loadScenario('INITIAL');
    await seedDemandForScenario();
    return { ok: true, status: 'AUDITING' };
  }
  if (status === 'AUDITING' || status === 'MANUAL_REVIEW') {
    await runAudit('PASS');
  } else if (status === 'MATCH_PREPARING') {
    store.setState({ demo: Object.assign({}, state.demo, { groupAvailable: true }) });
    const reserved = reserveGroup(store.getState().matchRound);
    if (reserved.ok) await activateBatch(1);
  } else if (status === 'MATCHING') {
    await simulateReceiverAccept();
  } else if (status === 'WAIT_PAY') {
    await payConnection({ useVoucher: true });
  } else if (status === 'WAIT_JOIN') {
    const join = store.getState().join;
    if (join.initiator === 'NOT_OPENED') await openJoinEntry('initiator');
    else if (join.initiator !== 'JOINED') await reconcileJoin('initiator', true);
    else if (join.receiver === 'NOT_OPENED') await openJoinEntry('receiver');
    else if (join.receiver !== 'JOINED') await reconcileJoin('receiver', true);
  } else if (status === 'COMMUNICATING') {
    await closeCollaborationRecord();
  }
  return { ok: true, status: publicStatus(store.getState()) };
}

function getProfile() {
  const state = store.getState();
  return Promise.resolve(Object.assign({}, state.profile, {
    stats: {
      published: state.demand ? 1 : 0,
      received: (state.receiverInbox || []).length,
      communicating: state.collaborationAttempt && state.collaborationAttempt.status === 'COMMUNICATING' ? 1 : 0,
      vouchers: (state.vouchers || []).filter((voucher) => voucher.status === 'AVAILABLE').length
    },
    unread: (state.messages || []).filter((message) => !message.read).length
  }));
}

function getReceiverSettings() {
  return Promise.resolve(clone(store.getState().receiverSettings));
}

function updateReceiverSettings(patch) {
  const settings = Object.assign({}, store.getState().receiverSettings, patch || {});
  settings.inboxEnabled = true;
  store.setState({ receiverSettings: settings });
  return delay(100).then(() => ({ ok: true, settings }));
}

function updateSettings(settings) {
  store.setState({ settings: Object.assign({}, store.getState().settings, settings || {}) });
  return delay(80).then(() => ({ ok: true }));
}

function submitFeedback(payload) {
  const state = store.getState();
  const feedback = Object.assign({
    id: makeId('FB_PAC'),
    createdAtText: formatTime(Date.now())
  }, payload || {});
  const feedbacks = (state.feedbacks || []).slice();
  feedbacks.unshift(feedback);
  store.setState({ feedbacks });
  return delay(160).then(() => ({ ok: true, fbId: feedback.id }));
}

function getMessages() {
  const state = store.getState();
  if ((state.messages || []).length) return Promise.resolve(state.messages);
  const messages = [
    {
      id: 'MSG_DEMO_01',
      type: '邀请',
      typeKey: 'invite',
      title: '您有一条待处理邀请',
      summary: '请在有效期内查看脱敏摘要并决定是否接受。',
      time: '2026-07-23 10:26',
      read: false,
      page: '/pages/invitation/invitation'
    },
    {
      id: 'MSG_DEMO_02',
      type: '说明',
      typeKey: 'audit',
      title: 'PAC Demo 使用虚构数据',
      summary: '当前不连接真实后端、支付、企微或通知服务。',
      time: '2026-07-23 09:00',
      read: true,
      page: '/pages/about/index'
    }
  ];
  store.setState({ messages });
  return Promise.resolve(messages);
}

function markMessageRead(id) {
  const messages = store.getState().messages.map((message) => (
    message.id === id ? Object.assign({}, message, { read: true }) : message
  ));
  store.setState({ messages });
  return Promise.resolve({ ok: true });
}

function markAllMessagesRead() {
  store.setState({ messages: store.getState().messages.map((message) => Object.assign({}, message, { read: true })) });
  return Promise.resolve({ ok: true });
}

function getVouchers() {
  return Promise.resolve((store.getState().vouchers || []).map((voucher) => ({
    id: voucher.id,
    name: '1 元补贴券',
    desc: '抵扣下一次发布后的 1 元连接信息服务费',
    bindDemand: voucher.sourceDemandId,
    bindLawyer: voucher.receiverId === 'USER_DEMO_LIN' ? '林知远' : '虚构律师',
    validTo: voucher.expiresAtText,
    status: voucher.status === 'AVAILABLE' ? '可用' : voucher.status === 'USED' ? '已使用' : '已过期',
    sourceText: voucher.sourceText
  })));
}

function getOrders() {
  const state = store.getState();
  const orders = [];
  if (state.order) {
    orders.push({
      id: state.order.id,
      demand: state.demand ? state.demand.scene + ' / ' + state.demand.city : '当前需求',
      connectFee: state.order.originalAmount,
      couponCut: state.order.discountAmount,
      paid: state.order.status === 'PAID' || state.order.status === 'PAID_BY_VOUCHER' ? state.order.payableAmount : 0,
      method: state.order.method || '—',
      status: state.order.status === 'PAID_BY_VOUCHER'
        ? '券抵扣(零支付)'
        : state.order.status === 'PAID'
          ? '已支付'
          : state.order.status === 'CONFIRMING'
            ? '确认中'
            : state.order.status === 'REFUNDED'
              ? '已退款'
          : state.order.status === 'CLOSED'
            ? '已关闭'
            : '待支付',
      createdAt: formatTime(state.order.createdAt)
    });
  }
  orders.push({
    id: 'ORDER_DEMO_HISTORY_01',
    demand: '律师会见 / 广州（演示）',
    connectFee: 1,
    couponCut: 0,
    paid: 1,
    method: '微信支付（Mock）',
    status: '已支付',
    createdAt: '2026-07-20 14:10'
  });
  return Promise.resolve(orders);
}

function getCollabList() {
  const state = store.getState();
  const initiator = [];
  if (state.demand) {
    initiator.push({
      id: state.demand.id,
      role: 'initiator',
      scene: state.demand.scene,
      city: state.demand.city,
      institution: state.demand.institution,
      expectTime: state.demand.serviceAtText,
      statusText: statusText(publicStatus(state)),
      current: true,
      nextAction: nextActionText(publicStatus(state))
    });
  }
  initiator.push({
    id: 'D_HISTORY_01',
    role: 'initiator',
    scene: '律师会见',
    city: '广州',
    institution: '广州市第三看守所（演示虚构）',
    expectTime: '2026-07-18 10:00',
    statusText: '已结束',
    nextAction: '查看记录'
  });
  const receiver = (state.receiverInbox || []).map((invitation) => ({
    id: invitation.invitationId,
    role: 'receiver',
    scene: invitation.scene,
    city: invitation.city,
    institution: invitation.institution,
    expectTime: invitation.serviceAtText,
    statusText: invitationStatusText(invitation.status),
    nextAction: invitation.status === 'PENDING' ? '处理邀请' : '查看结果'
  }));
  return Promise.resolve({ initiator, receiver });
}

function statusText(status) {
  return ({
    EMPTY: '暂无需求',
    AUDITING: '审核中',
    MANUAL_REVIEW: '人工审核中',
    NEED_EDIT: '待修改',
    MATCH_PREPARING: '匹配准备中',
    MATCHING: '匹配中',
    WAIT_PAY: '已匹配待支付',
    PAYMENT_CONFIRMING: '支付确认中',
    PAYMENT_TIMEOUT: '支付超时',
    PAYMENT_REFUNDED: '已退款',
    WAIT_JOIN: '待入群',
    JOIN_EXCEPTION: '入群异常',
    COMMUNICATING: '沟通中',
    NEGOTIATION_FAILED: '沟通未达成',
    NO_MATCH: '未匹配',
    EXPIRED: '已过期',
    CLOSED_CONNECTED: '已结束',
    CLOSED: '已结束'
  })[status] || status;
}

function nextActionText(status) {
  return ({
    AUDITING: '查看审核',
    MANUAL_REVIEW: '查看审核',
    NEED_EDIT: '修改需求',
    MATCH_PREPARING: '查看进度',
    MATCHING: '查看进度',
    WAIT_PAY: '去支付',
    PAYMENT_CONFIRMING: '等待支付结果',
    PAYMENT_TIMEOUT: '选择下一步',
    PAYMENT_REFUNDED: '查看退款结果',
    WAIT_JOIN: '去加入协作群',
    JOIN_EXCEPTION: '处理入群异常',
    COMMUNICATING: '进入详情',
    NEGOTIATION_FAILED: '选择下一步',
    NO_MATCH: '修改需求',
    EXPIRED: '复制后发布',
    CLOSED_CONNECTED: '查看记录',
    CLOSED: '查看记录'
  })[status] || '查看详情';
}

function invitationStatusText(status) {
  return ({
    PENDING: '待处理',
    ACCEPTED: '已接受',
    REJECTED: '已拒绝',
    TIMEOUT_REJECTED: '已超时',
    INVALIDATED_BY_LOCK: '已由其他律师接洽',
    CANCELLED_BY_VERSION: '需求已更新',
    CANCELLED_BY_DEMAND: '需求已结束',
    QUALIFICATION_BLOCKED: '资格异常'
  })[status] || status;
}

function resetDemoData() {
  store.resetState();
  return delay(100).then(() => ({ ok: true }));
}

// 兼容旧页面调用；这些页面会重定向到 P02。
function machineAuditChecks(demand) {
  const errors = validateDemand({
    sceneCode: demand && demand.sceneCode,
    city: demand && demand.city,
    institution: demand && demand.institution,
    serviceItem: demand && demand.serviceItem,
    matchDeadlineAt: demand && demand.matchDeadlineAt,
    serviceAt: demand && demand.serviceAt
  });
  return {
    sensitiveOk: true,
    timeValid: !errors.matchDeadlineAt && !errors.serviceAt,
    expired: Boolean(demand && demand.matchDeadlineAt <= Date.now())
  };
}

module.exports = {
  formatTime,
  sceneText,
  batchPlanForCount,
  acknowledgeNotice,
  saveDraft,
  aiExtract,
  validateDemand,
  submitDemand,
  registerPilotInterest,
  runAudit,
  createMatchSnapshot,
  startMatching,
  activateBatch,
  declineCurrentBatch,
  timeoutCurrentBatch,
  receiverAcceptInvitation,
  receiverDeclineInvitation,
  openReceiverInvitation,
  getReceiverInvitations,
  simulateReceiverAccept,
  payConnection,
  refundPayment,
  paymentTimeout,
  openJoinEntry,
  reconcileJoin,
  closeCollaborationRecord,
  reportNegotiationFailed,
  rematch,
  expireDemand,
  closeDemand,
  publicStatus,
  getCollaborationView,
  loadScenario,
  advanceHappyPath,
  getProfile,
  getReceiverSettings,
  updateReceiverSettings,
  updateSettings,
  submitFeedback,
  getMessages,
  markMessageRead,
  markAllMessagesRead,
  getVouchers,
  getOrders,
  getCollabList,
  statusText,
  invitationStatusText,
  nextActionText,
  resetDemoData,
  machineAuditChecks,
  // 旧调用兼容别名
  getMatchRound: () => Promise.resolve(store.getState().matchRound),
  switchToNextBatch: () => declineCurrentBatch(),
  acceptInvitation: (candidateId) => {
    const invitation = store.getState().invitations.find((item) => item.candidateId === candidateId && item.status === 'PENDING');
    return invitation ? receiverAcceptInvitation(invitation.invitationId) : Promise.resolve({ result: 'NOT_FOUND' });
  },
  rejectCurrentBatch: () => declineCurrentBatch(),
  getIncomingInvitations: getReceiverInvitations,
  acceptIncoming: receiverAcceptInvitation,
  rejectIncoming: receiverDeclineInvitation,
  confirmJoined: (role) => reconcileJoin(role, true),
  notifyNoMatch: () => ({ ok: true })
};
