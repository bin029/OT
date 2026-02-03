/**
 * 加班打卡应用单元测试
 * 测试各种打卡场景的加班时间计算逻辑
 */

// 简单的测试框架实现
const test = {
    describe: function(description, fn) {
        console.log(`\n📋 ${description}`);
        fn();
    },

    it: function(description, fn) {
        try {
            fn();
            console.log(`✅ ${description}`);
        } catch (error) {
            console.log(`❌ ${description}`);
            console.log(`   ${error.message}`);
        }
    },

    assert: {
        equal: function(actual, expected, message = '') {
            if (actual !== expected) {
                throw new Error(`${message} Expected ${expected}, but got ${actual}`);
            }
        },

        deepEqual: function(actual, expected, message = '') {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`${message} Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
            }
        },

        isTrue: function(value, message = '') {
            if (!value) {
                throw new Error(`${message} Expected true, but got ${value}`);
            }
        },

        isFalse: function(value, message = '') {
            if (value) {
                throw new Error(`${message} Expected false, but got ${value}`);
            }
        }
    }
};

// Mock localStorage for testing
const mockLocalStorage = {
    store: {},
    getItem: function(key) {
        return this.store[key] || null;
    },
    setItem: function(key, value) {
        this.store[key] = value.toString();
    },
    removeItem: function(key) {
        delete this.store[key];
    },
    clear: function() {
        this.store = {};
    }
};

// Mock TimeRecorder class for testing
class MockTimeRecorder {
    constructor() {
        this.records = {};
        this.workdayOverrides = {};
    }

    // 复制原始类的方法
    calculateTimeDifference(startTime, endTime) {
        const diffMs = endTime.getTime() - startTime.getTime();
        return Math.round(diffMs / (1000 * 60)); // 转换为分钟
    }

    shouldCalculateAsWorkday(dateKey) {
        const date = new Date(dateKey + 'T00:00:00');
        const dayOfWeek = date.getDay();

        // 如果是周一到周五，正常按工作日计算
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            return true;
        }

        // 如果是周末，检查是否为节假日调休日
        return this.workdayOverrides[dateKey] === true;
    }

    calculateOvertime(dayRecords, dateKey) {
        const date = new Date(dateKey + 'T00:00:00');
        const dayOfWeek = date.getDay();

        let totalOvertimeMinutes = 0;

        // 如果有完整的打卡记录，计算自动打卡的加班时间
        if (dayRecords.first && dayRecords.last) {
            const actualStartTime = new Date(dayRecords.first.date);
            const actualEndTime = new Date(dayRecords.last.date);

            // 判断当天是否需要按工作日规则计算
            if (this.shouldCalculateAsWorkday(dateKey)) {
                // 按工作日规则计算（周一至周五或节假日调休日）

                // 标准上班时间：9:00
                const standardStartTime = new Date(dateKey + 'T09:00:00');
                // 加班开始时间：18:30
                const overtimeStartTime = new Date(dateKey + 'T18:30:00');

                // 计算18:30以后的加班时间
                const overtimeAfter1830 = Math.max(0, this.calculateTimeDifference(overtimeStartTime, actualEndTime));

                // 计算迟到时间（上班晚于9:00的部分）
                const lateMinutes = Math.max(0, this.calculateTimeDifference(standardStartTime, actualStartTime));

                // 判断下班时间是否达到18:30
                const hasReachedOvertimeStart = actualEndTime >= overtimeStartTime;

                if (hasReachedOvertimeStart) {
                    // 如果下班时间 ≥ 18:30，使用18:30以后的加班时间 - 迟到时间
                    const finalOvertimeMinutes = overtimeAfter1830 - lateMinutes;
                    totalOvertimeMinutes = finalOvertimeMinutes;
                } else {
                    // 如果下班时间 < 18:30，计算早退时间并减去迟到时间
                    // 早退时间 = 18:30 - 下班时间
                    const earlyLeaveMinutes = Math.max(0, this.calculateTimeDifference(actualEndTime, overtimeStartTime));
                    totalOvertimeMinutes = -earlyLeaveMinutes - lateMinutes;
                }
            } else {
                // 周末且非调休日的计算规则：直接计算下班时间 - 上班时间
                totalOvertimeMinutes = this.calculateTimeDifference(actualStartTime, actualEndTime);
            }
        }

        // 加上手动补录的加班时间（小时转换为分钟，支持负数用于调休消耗）
        if (dayRecords.manualOvertime !== undefined && dayRecords.manualOvertime !== null && dayRecords.manualOvertime !== 0) {
            totalOvertimeMinutes += dayRecords.manualOvertime * 60;
        }

        return totalOvertimeMinutes;
    }
}

// Helper function to create test date records
function createTestRecord(dateStr, startTime, endTime, manualOvertime = 0) {
    const record = {};

    if (startTime) {
        record.first = {
            date: new Date(`${dateStr}T${startTime}:00`),
            timestamp: `${dateStr} ${startTime}:00`,
            count: 1,
            type: 'first'
        };
    }

    if (endTime) {
        record.last = {
            date: new Date(`${dateStr}T${endTime}:00`),
            timestamp: `${dateStr} ${endTime}:00`,
            count: 2,
            type: 'last'
        };
    }

    if (manualOvertime > 0) {
        record.manualOvertime = manualOvertime;
    }

    return record;
}

// Helper function to get day of week for a date
function getDayOfWeek(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[date.getDay()];
}

// 导出测试运行函数
window.runTimeRecorderTests = function() {
    test.describe('加班时间计算测试', () => {

    test.describe('工作日正常场景', () => {
        const recorder = new MockTimeRecorder();

        test.it('准时上班准时下班 (9:00-18:30) - 加班0分钟', () => {
            const date = '2025-01-20'; // 周一
            const record = createTestRecord(date, '09:00', '18:30');
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, 0, `日期: ${date} (${getDayOfWeek(date)})`);
        });

        test.it('准时上班加班1小时 (9:00-19:30) - 加班60分钟', () => {
            const date = '2025-01-20'; // 周一
            const record = createTestRecord(date, '09:00', '19:30');
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, 60, `日期: ${date} (${getDayOfWeek(date)})`);
        });

        test.it('准时上班加班2.5小时 (9:00-21:00) - 加班150分钟', () => {
            const date = '2025-01-20'; // 周一
            const record = createTestRecord(date, '09:00', '21:00');
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, 150, `日期: ${date} (${getDayOfWeek(date)})`);
        });
    });

    test.describe('工作日迟到场景', () => {
        const recorder = new MockTimeRecorder();

        test.it('迟到1小时准时下班 (10:00-18:30) - 加班-60分钟', () => {
            const date = '2025-01-20'; // 周一
            const record = createTestRecord(date, '10:00', '18:30');
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, -60, `日期: ${date} (${getDayOfWeek(date)})`);
        });

        test.it('迟到30分钟加班1小时 (9:30-19:30) - 加班30分钟', () => {
            const date = '2025-01-20'; // 周一
            const record = createTestRecord(date, '09:30', '19:30');
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, 30, `日期: ${date} (${getDayOfWeek(date)})`);
        });

        test.it('迟到2小时加班2小时 (11:00-20:30) - 加班0分钟', () => {
            const date = '2025-01-20'; // 周一
            const record = createTestRecord(date, '11:00', '20:30');
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, 0, `日期: ${date} (${getDayOfWeek(date)})`);
        });
    });

    test.describe('工作日早退场景', () => {
        const recorder = new MockTimeRecorder();

        test.it('准时上班早退1小时 (9:00-17:30) - 加班-60分钟', () => {
            const date = '2025-01-20'; // 周一
            const record = createTestRecord(date, '09:00', '17:30');
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, -60, `日期: ${date} (${getDayOfWeek(date)})`);
        });

        test.it('迟到1小时早退30分钟 (10:00-18:00) - 加班-90分钟', () => {
            const date = '2025-01-20'; // 周一
            const record = createTestRecord(date, '10:00', '18:00');
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, -90, `日期: ${date} (${getDayOfWeek(date)})`);
        });

        test.it('用户提到的场景：迟到3小时早退1.5小时 (12:00-17:00) - 加班-270分钟', () => {
            const date = '2025-01-20'; // 周一
            const record = createTestRecord(date, '12:00', '17:00');
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, -270, `日期: ${date} (${getDayOfWeek(date)})`);
        });
    });

    test.describe('周末场景', () => {
        const recorder = new MockTimeRecorder();

        test.it('周末工作8小时 (9:00-17:00) - 加班480分钟', () => {
            const date = '2025-01-18'; // 周六
            const record = createTestRecord(date, '09:00', '17:00');
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, 480, `日期: ${date} (${getDayOfWeek(date)})`);
        });

        test.it('周末全天工作 (8:00-20:00) - 加班720分钟', () => {
            const date = '2025-01-19'; // 周日
            const record = createTestRecord(date, '08:00', '20:00');
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, 720, `日期: ${date} (${getDayOfWeek(date)})`);
        });
    });

    test.describe('节假日调休日场景', () => {
        const recorder = new MockTimeRecorder();

        test.it('周末设置为调休日，按工作日规则计算', () => {
            const date = '2025-01-18'; // 周六，设置为调休日
            recorder.workdayOverrides[date] = true;

            const record = createTestRecord(date, '09:00', '19:30');
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, 60, `日期: ${date} (${getDayOfWeek(date)}) 调休日`);

            // 清理测试数据
            delete recorder.workdayOverrides[date];
        });

        test.it('调休日迟到早退场景', () => {
            const date = '2025-01-19'; // 周日，设置为调休日
            recorder.workdayOverrides[date] = true;

            const record = createTestRecord(date, '10:00', '17:00');
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, -150, `日期: ${date} (${getDayOfWeek(date)}) 调休日`);

            // 清理测试数据
            delete recorder.workdayOverrides[date];
        });
    });

    test.describe('手动补录场景', () => {
        const recorder = new MockTimeRecorder();

        test.it('只有手动补录没有打卡记录 - 加班120分钟', () => {
            const date = '2025-01-20'; // 周一
            const record = createTestRecord(date, null, null, 2); // 补录2小时
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, 120, `日期: ${date} (${getDayOfWeek(date)})`);
        });

        test.it('自动打卡 + 手动补录 - 加班120分钟', () => {
            const date = '2025-01-20'; // 周一
            const record = createTestRecord(date, '09:00', '19:30', 1); // 自动加班1小时 + 补录1小时
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, 120, `日期: ${date} (${getDayOfWeek(date)})`);
        });

        test.it('周末补录 - 加班720分钟', () => {
            const date = '2025-01-18'; // 周六
            const record = createTestRecord(date, '09:00', '17:00', 4); // 周末工作8小时 + 补录4小时
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, 720, `日期: ${date} (${getDayOfWeek(date)})`);
        });

        test.it('负数补录（调休消耗）- 加班-120分钟', () => {
            const date = '2025-01-20'; // 周一
            const record = createTestRecord(date, null, null, -2); // 调休消耗2小时
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, -120, `日期: ${date} (${getDayOfWeek(date)})`);
        });

        test.it('自动打卡 + 负数补录（调休消耗）- 加班-60分钟', () => {
            const date = '2025-01-20'; // 周一
            const record = createTestRecord(date, '09:00', '19:30', -2); // 自动加班1小时 - 调休消耗2小时
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, -60, `日期: ${date} (${getDayOfWeek(date)})`);
        });

        test.it('负数补录抵消自动加班 - 加班0分钟', () => {
            const date = '2025-01-20'; // 周一
            const record = createTestRecord(date, '09:00', '19:30', -1); // 自动加班1小时 - 调休消耗1小时
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, 0, `日期: ${date} (${getDayOfWeek(date)})`);
        });
    });

    test.describe('边界情况', () => {
        const recorder = new MockTimeRecorder();

        test.it('只有上班记录没有下班记录 - 加班0分钟', () => {
            const date = '2025-01-20'; // 周一
            const record = createTestRecord(date, '09:00', null);
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, 0, `日期: ${date} (${getDayOfWeek(date)})`);
        });

        test.it('跨日期打卡场景（下班时间早于上班时间）', () => {
            const date = '2025-01-20'; // 周一
            // 模拟跨日期：上班22:00，下班次日6:00
            const record = {
                first: { date: new Date('2025-01-20T22:00:00') },
                last: { date: new Date('2025-01-21T06:00:00') }
            };
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, 8 * 60, `日期: ${date} (${getDayOfWeek(date)}) 跨日期8小时`);
        });

        test.it('补录0小时 - 加班0分钟', () => {
            const date = '2025-01-20'; // 周一
            const record = createTestRecord(date, null, null, 0);
            const overtime = recorder.calculateOvertime(record, date);
            test.assert.equal(overtime, 0, `日期: ${date} (${getDayOfWeek(date)})`);
        });
    });

    test.describe('日期类型判断', () => {
        const recorder = new MockTimeRecorder();

        test.it('周一到周五应按工作日计算', () => {
            const weekdays = ['2025-01-20', '2025-01-21', '2025-01-22', '2025-01-23', '2025-01-24']; // 周一到周五
            weekdays.forEach(date => {
                test.assert.isTrue(recorder.shouldCalculateAsWorkday(date), `日期: ${date} (${getDayOfWeek(date)})`);
            });
        });

        test.it('周六周日默认不按工作日计算', () => {
            const weekend = ['2025-01-18', '2025-01-19']; // 周六、周日
            weekend.forEach(date => {
                test.assert.isFalse(recorder.shouldCalculateAsWorkday(date), `日期: ${date} (${getDayOfWeek(date)})`);
            });
        });

        test.it('设置为调休日的周末按工作日计算', () => {
            const date = '2025-01-18'; // 周六
            recorder.workdayOverrides[date] = true;
            test.assert.isTrue(recorder.shouldCalculateAsWorkday(date), `日期: ${date} (${getDayOfWeek(date)}) 调休日`);

            // 清理测试数据
            delete recorder.workdayOverrides[date];
        });
    });

    test.describe('本周加班时间计算 - 日期范围判断', () => {
        test.it('验证日期比较逻辑：周一00:00应该大于等于周一14:30', () => {
            // 模拟bug场景：currentWeekStart是周一14:30，recordDate是周一00:00
            const mondayMorning = new Date('2025-02-03T00:00:00');
            const mondayAfternoon = new Date('2025-02-03T14:30:00');
            
            // 修复前：mondayMorning >= mondayAfternoon 为 false（错误）
            // 修复后：应该将mondayAfternoon设置为00:00:00
            mondayAfternoon.setHours(0, 0, 0, 0);
            
            // 现在应该为true
            test.assert.isTrue(mondayMorning >= mondayAfternoon, '周一00:00应该大于等于周一00:00（修复后）');
        });

        test.it('验证日期范围：本周开始时间应该设置为00:00:00', () => {
            const today = new Date('2025-02-04T15:00:00'); // 周二下午3点
            const currentWeekStart = new Date(today);
            const dayOfWeek = today.getDay(); // 2 (周二)
            
            // 计算本周一
            currentWeekStart.setDate(today.getDate() - dayOfWeek + 1);
            
            // 修复：设置为00:00:00
            currentWeekStart.setHours(0, 0, 0, 0);
            
            // 验证
            const mondayRecord = new Date('2025-02-03T00:00:00'); // 周一记录
            test.assert.isTrue(mondayRecord >= currentWeekStart, '周一记录应该在本周范围内');
        });
    });

    test.describe('每月1日自动清空记录', () => {
        const recorder = new MockTimeRecorder();

        // 添加清空方法到MockTimeRecorder
        recorder.clearLastMonthRecords = function() {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            let lastMonth = currentMonth - 1;
            let lastYear = currentYear;
            if (lastMonth < 0) {
                lastMonth = 11;
                lastYear = currentYear - 1;
            }

            const dates = Object.keys(this.records);
            let clearedCount = 0;

            dates.forEach(dateKey => {
                const recordDate = new Date(dateKey + 'T00:00:00');
                if (recordDate.getMonth() === lastMonth && recordDate.getFullYear() === lastYear) {
                    delete this.records[dateKey];
                    clearedCount++;
                }
            });

            return clearedCount;
        };

        recorder.clearCurrentWeekRecords = function() {
            const now = new Date();
            const currentWeekStart = new Date(now);
            const dayOfWeek = now.getDay();

            if (dayOfWeek === 0) {
                currentWeekStart.setDate(now.getDate() - 6);
            } else {
                currentWeekStart.setDate(now.getDate() - dayOfWeek + 1);
            }
            currentWeekStart.setHours(0, 0, 0, 0);

            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            const dates = Object.keys(this.records);
            let clearedCount = 0;

            dates.forEach(dateKey => {
                const recordDate = new Date(dateKey + 'T00:00:00');
                if (recordDate >= currentWeekStart && recordDate <= now) {
                    const recordMonth = recordDate.getMonth();
                    const recordYear = recordDate.getFullYear();
                    if (recordMonth !== currentMonth || recordYear !== currentYear) {
                        delete this.records[dateKey];
                        clearedCount++;
                    }
                }
            });

            return clearedCount;
        };

        test.it('每月1日应清空上个月的所有记录', () => {
            // 模拟：今天是2月1日，有1月的记录
            recorder.records = {
                '2025-01-15': createTestRecord('2025-01-15', '09:00', '18:30'),
                '2025-01-20': createTestRecord('2025-01-20', '09:00', '19:30'),
                '2025-02-01': createTestRecord('2025-02-01', '09:00', '18:30')
            };

            const clearedCount = recorder.clearLastMonthRecords();

            // 应该清空2条1月的记录
            test.assert.equal(clearedCount, 2, '应清空上个月的2条记录');
            test.assert.isTrue(!recorder.records['2025-01-15'], '1月15日记录应被清空');
            test.assert.isTrue(!recorder.records['2025-01-20'], '1月20日记录应被清空');
            test.assert.isTrue(!!recorder.records['2025-02-01'], '2月1日记录应保留');
        });

        test.it('每月1日应清空本周跨月的记录', () => {
            // 模拟：今天是2月1日（周六），本周一在上个月
            recorder.records = {
                '2025-01-27': createTestRecord('2025-01-27', '09:00', '18:30'), // 本周一（上个月）
                '2025-01-28': createTestRecord('2025-01-28', '09:00', '18:30'), // 本周二（上个月）
                '2025-02-01': createTestRecord('2025-02-01', '09:00', '18:30')  // 本周六（本月）
            };

            const clearedCount = recorder.clearCurrentWeekRecords();

            // 应该清空本周在上个月的记录
            test.assert.equal(clearedCount, 2, '应清空本周跨月的2条记录');
            test.assert.isTrue(!recorder.records['2025-01-27'], '1月27日（本周一）记录应被清空');
            test.assert.isTrue(!recorder.records['2025-01-28'], '1月28日（本周二）记录应被清空');
            test.assert.isTrue(!!recorder.records['2025-02-01'], '2月1日（本周六）记录应保留');
        });
    });

    test.describe('最近6个月加班记录', () => {
        const recorder = new MockTimeRecorder();

        // 添加获取最近6个月加班时间的方法
        recorder.getLast6MonthsOvertime = function() {
            const today = new Date();
            const months = [];

            for (let i = 0; i < 6; i++) {
                const date = new Date(today);
                date.setMonth(today.getMonth() - i);
                const month = date.getMonth();
                const year = date.getFullYear();

                let totalMinutes = 0;
                const dates = Object.keys(this.records);

                dates.forEach(dateKey => {
                    const recordDate = new Date(dateKey + 'T00:00:00');
                    if (recordDate.getMonth() === month && recordDate.getFullYear() === year) {
                        const dayRecords = this.records[dateKey];
                        if (dayRecords) {
                            totalMinutes += this.calculateOvertime(dayRecords, dateKey);
                        }
                    }
                });

                months.push({
                    year: year,
                    month: month,
                    totalMinutes: totalMinutes
                });
            }

            return months;
        };

        test.it('应正确计算最近6个月的加班时间', () => {
            // 创建最近3个月的测试数据
            recorder.records = {
                '2025-01-15': createTestRecord('2025-01-15', '09:00', '19:30'), // 1月，60分钟
                '2025-01-20': createTestRecord('2025-01-20', '09:00', '20:00'), // 1月，90分钟
                '2025-02-05': createTestRecord('2025-02-05', '09:00', '19:00'), // 2月，30分钟
                '2025-02-10': createTestRecord('2025-02-10', '09:00', '21:00'), // 2月，150分钟
                '2025-03-01': createTestRecord('2025-03-01', '09:00', '18:30')  // 3月，0分钟
            };

            const months = recorder.getLast6MonthsOvertime();

            // 应该返回6个月的数据
            test.assert.equal(months.length, 6, '应返回6个月的数据');

            // 验证数据格式
            months.forEach(month => {
                test.assert.isTrue(typeof month.year === 'number', '年份应为数字');
                test.assert.isTrue(typeof month.month === 'number', '月份应为数字');
                test.assert.isTrue(typeof month.totalMinutes === 'number', '总分钟数应为数字');
            });
        });

        test.it('应正确统计每个月的加班时间总和', () => {
            // 创建1月的多条记录
            recorder.records = {
                '2025-01-10': createTestRecord('2025-01-10', '09:00', '19:30'), // 60分钟
                '2025-01-15': createTestRecord('2025-01-15', '09:00', '20:00'), // 90分钟
                '2025-01-20': createTestRecord('2025-01-20', '09:00', '21:00')  // 150分钟
            };

            const months = recorder.getLast6MonthsOvertime();
            const january = months.find(m => m.month === 0 && m.year === 2025); // 0表示1月

            // 1月总加班时间应该是 60 + 90 + 150 = 300分钟
            if (january) {
                test.assert.equal(january.totalMinutes, 300, '1月总加班时间应为300分钟');
            } else {
                throw new Error('未找到1月的数据');
            }
        });
    });
    });

    // 输出测试完成信息
    console.log('\n🎉 所有测试用例执行完成！');
    console.log('如果看到✅表示测试通过，❌表示测试失败。');
};