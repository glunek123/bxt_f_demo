// app.js
const store = require('./utils/store.js');

App({
  onLaunch() {
    // 演示 Demo：仅加载本地模拟数据，不连接任何真实后端
    store.loadState();
  },
  globalData: {}
});
