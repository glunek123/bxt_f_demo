const assert = require('assert');

global.wx = {
  getStorageSync() { return null; },
  setStorage() {},
  removeStorageSync() {}
};

const store = require('../utils/store.js');
const mock = require('../utils/mock.js');

async function run() {
  assert.deepStrictEqual(mock.batchPlanForCount(1), [1]);
  assert.deepStrictEqual(mock.batchPlanForCount(2), [1, 1]);
  assert.deepStrictEqual(mock.batchPlanForCount(5), [1, 2, 2]);
  assert.deepStrictEqual(mock.batchPlanForCount(8), [2, 3, 3]);
  assert.deepStrictEqual(mock.batchPlanForCount(12), [3, 4, 5]);

  await mock.loadScenario('NO_GROUP');
  assert.strictEqual(mock.publicStatus(), 'MATCH_PREPARING');
  assert.strictEqual(store.getState().invitations.length, 0, '无健康群时不得发送邀请');

  await mock.loadScenario('BATCH_SWITCH');
  let state = store.getState();
  assert.strictEqual(state.matchRound.currentBatchNo, 2);
  assert.deepStrictEqual(state.matchRound.batchPlan, [3, 4, 5]);
  assert.strictEqual(state.batches[0].status, 'ALL_REJECTED');
  assert.strictEqual(state.activeGroup.id, state.matchRound.groupId, '同轮切批必须沿用预占群');
  const rejectedInvitationIds = state.invitations.filter((item) => item.status === 'REJECTED').map((item) => item.invitationId);
  await mock.simulateReceiverAccept();
  state = store.getState();
  assert.ok(rejectedInvitationIds.every((id) => state.invitations.find((item) => item.invitationId === id).status === 'REJECTED'), '锁定不得改写已拒绝终态');

  await mock.loadScenario('NO_MATCH');
  state = store.getState();
  assert.strictEqual(mock.publicStatus(), 'NO_MATCH');
  assert.strictEqual(state.demand.status, 'NO_MATCH');
  assert.notStrictEqual(state.demand.status, 'EXPIRED');

  await mock.loadScenario('PAYMENT_TIMEOUT');
  state = store.getState();
  const timeoutBatch = state.matchRound.currentBatchNo;
  assert.strictEqual(mock.publicStatus(), 'PAYMENT_TIMEOUT');
  assert.strictEqual(state.order.status, 'CLOSED');
  assert.strictEqual(state.matchRound.currentBatchNo, timeoutBatch, '支付超时不得自动切批');

  await mock.loadScenario('PAYMENT_CONFIRMING');
  state = store.getState();
  assert.strictEqual(mock.publicStatus(), 'PAYMENT_CONFIRMING');
  assert.strictEqual(state.order.status, 'CONFIRMING');

  await mock.loadScenario('PAYMENT_REFUNDED');
  state = store.getState();
  assert.strictEqual(mock.publicStatus(), 'PAYMENT_REFUNDED');
  assert.strictEqual(state.order.status, 'REFUNDED');

  await mock.loadScenario('SUCCESS');
  state = store.getState();
  assert.strictEqual(mock.publicStatus(), 'COMMUNICATING');
  assert.strictEqual(state.join.initiator, 'JOINED');
  assert.strictEqual(state.join.receiver, 'JOINED');
  assert.strictEqual(state.order.status, 'PAID_BY_VOUCHER');
  assert.strictEqual(state.order.payableAmount, 0);
  assert.ok(!state.order.channelTransactionId, '零支付订单不得调用微信支付或生成渠道交易号');
  assert.ok(!state.vouchers.some((voucher) => voucher.sourceDemandId === state.demand.id), '赢家不得获得补贴券');
  await mock.closeCollaborationRecord();
  assert.strictEqual(mock.publicStatus(), 'CLOSED_CONNECTED');

  await mock.loadScenario('JOIN_EXCEPTION');
  state = store.getState();
  assert.strictEqual(mock.publicStatus(), 'JOIN_EXCEPTION');
  assert.strictEqual(state.join.initiator, 'FAILED');
  assert.notStrictEqual(state.join.initiator, 'JOINED', '入口打开不得直接视为入群');

  await mock.loadScenario('LOCK_LOSS_VOUCHER');
  const invitation = store.getState().receiverInbox[0];
  await mock.openReceiverInvitation(invitation.invitationId);
  await mock.openReceiverInvitation(invitation.invitationId);
  state = store.getState();
  const lockLossVouchers = state.vouchers.filter((voucher) => (
    voucher.sourceDemandId === invitation.parentDemandId &&
    voucher.receiverId === invitation.receiverId &&
    voucher.type === 'PUBLISH_CONNECTION_1_YUAN'
  ));
  assert.strictEqual(lockLossVouchers.length, 1, '锁后失败补贴券不得重复发放');

  await mock.loadScenario('INITIAL');
  state = store.getState();
  store.setState({ receiverSettings: Object.assign({}, state.receiverSettings, { receivingEnabled: false }) });
  const blockedInvite = store.getState().receiverInbox[0];
  const blockedResult = await mock.receiverAcceptInvitation(blockedInvite.invitationId);
  assert.strictEqual(blockedResult.result, 'QUALIFICATION_ERROR');
  assert.strictEqual(store.getState().receiverInbox[0].status, 'PENDING', '资格异常不得伪造接受结果');

  await mock.loadScenario('INITIAL');
  const demandBeforePilot = store.getState().demand;
  const voucherCountBeforePilot = store.getState().vouchers.length;
  await mock.registerPilotInterest({ city: '上海', court: '演示法院' });
  state = store.getState();
  assert.strictEqual(state.demand, demandBeforePilot, '代开庭试点不得创建需求');
  assert.strictEqual(state.matchRound, null, '代开庭试点不得创建匹配轮次');
  assert.strictEqual(state.order, null, '代开庭试点不得创建订单');
  assert.strictEqual(state.vouchers.length, voucherCountBeforePilot, '代开庭试点不得发券');
  assert.strictEqual(state.pilotInterests.length, 1);

  await mock.loadScenario('NEGOTIATION_FAILED');
  const oldState = store.getState();
  const oldRoundId = oldState.matchRound.id;
  const oldGroupId = oldState.activeGroup.id;
  const reached = oldState.reachedReceiverIds.slice();
  const oldInvitationStates = oldState.invitations.map((invitation) => ({
    id: invitation.invitationId,
    status: invitation.status
  }));
  const rematchResult = await mock.rematch();
  state = store.getState();
  assert.strictEqual(rematchResult.ok, true);
  assert.notStrictEqual(state.matchRound.id, oldRoundId, '重匹配必须创建新轮次');
  assert.notStrictEqual(state.activeGroup.id, oldGroupId, '重匹配必须使用新群');
  assert.ok(reached.every((id) => !state.candidates.some((candidate) => candidate.receiverId === id)), '重匹配必须排除历史触达人');
  assert.ok(oldInvitationStates.every((invitation) => {
    const preserved = state.invitations.find((item) => item.invitationId === invitation.id);
    return preserved && preserved.status === invitation.status && preserved.status !== 'PENDING';
  }), '旧邀请必须保留原终态且不得恢复');

  await mock.loadScenario('NEGOTIATION_FAILED');
  await mock.closeDemand('测试结束需求');
  assert.strictEqual(mock.publicStatus(), 'CLOSED', '失败后选择结束需求必须进入关闭终态');

  process.stdout.write('PAC mock flow regression: PASS\n');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
