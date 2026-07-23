// PAC Demo 配置。提前量仅为演示配置，不代表正式运营默认值。
module.exports = {
  CANDIDATE_CAP: 12,
  INVITE_TTL_MS: 15 * 1000,
  INVITE_TTL_FORMAL_MINUTES: 15,
  PAYMENT_TTL_MS: 10 * 60 * 1000,
  JOIN_TTL_MS: 30 * 60 * 1000,
  FAST_REMATCH_THRESHOLD_MS: 5 * 60 * 1000,
  DEMAND_VALID_MS: 24 * 60 * 60 * 1000,
  SCENE_LEAD_MINUTES: {
    FILE_RETRIEVAL: 120,
    LAWYER_MEETING: 240
  },
  BATCH_MAPPING: {
    1: [1],
    2: [1, 1],
    3: [1, 1, 1],
    4: [1, 1, 2],
    5: [1, 2, 2],
    6: [1, 2, 3],
    7: [2, 2, 3],
    8: [2, 3, 3],
    9: [2, 3, 4],
    10: [2, 3, 5],
    11: [3, 3, 5],
    12: [3, 4, 5]
  },
  SCENE_TEXT: {
    FILE_RETRIEVAL: '异地调档',
    LAWYER_MEETING: '律师会见',
    COURT_PILOT_INTEREST: '代开庭试点意向'
  }
};
