/**
 * 命令行测试运行器
 * 用于在Node.js环境中运行单元测试
 */

// 模拟浏览器环境
global.window = {};
global.document = {
    createElement: () => ({}),
    addEventListener: () => {},
    querySelector: () => null
};
global.navigator = { onLine: true };
global.localStorage = {
    store: {},
    getItem: function(key) { return this.store[key] || null; },
    setItem: function(key, value) { this.store[key] = value.toString(); },
    removeItem: function(key) { delete this.store[key]; },
    clear: function() { this.store = {}; }
};
global.Date = Date;

// 模拟console
const originalConsole = console;
global.console = {
    log: (...args) => originalConsole.log(...args),
    error: (...args) => originalConsole.error(...args),
    warn: (...args) => originalConsole.warn(...args)
};

// 加载并运行测试
try {
    console.log('🚀 开始运行加班打卡应用单元测试...\n');

    // 加载测试文件
    require('./js/timeRecorder.test.js');

    // 运行测试
    if (typeof global.runTimeRecorderTests === 'function') {
        global.runTimeRecorderTests();
    } else {
        console.error('❌ 测试函数未找到');
        process.exit(1);
    }

} catch (error) {
    console.error('❌ 测试执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
}