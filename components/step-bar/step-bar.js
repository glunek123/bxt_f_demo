Component({
  properties: {
    current: { type: Number, value: 0 },
    steps: {
      type: Array,
      value: ['发布', '审核', '匹配', '连接', '协作']
    }
  }
});
