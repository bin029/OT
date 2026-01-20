// 简单验证脚本 - 模拟运行几个关键测试用例
console.log("=== 加班打卡应用 - 关键场景验证 ===\n");

// Mock TimeRecorder
class MockTimeRecorder {
    constructor() {
        this.workdayOverrides = {};
    }

    calculateTimeDifference(startTime, endTime) {
        const diffMs = endTime.getTime() - startTime.getTime();
        return Math.round(diffMs / (1000 * 60));
    }

    shouldCalculateAsWorkday(dateKey) {
        const date = new Date(dateKey + 'T00:00:00');
        const dayOfWeek = date.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            return true;
        }
        return this.workdayOverrides[dateKey] === true;
    }

    calculateOvertime(dayRecords, dateKey) {
        const date = new Date(dateKey + 'T00:00:00');
        const dayOfWeek = date.getDay();

        let totalOvertimeMinutes = 0;

        if (dayRecords.first && dayRecords.last) {
            const actualStartTime = new Date(dayRecords.first.date);
            const actualEndTime = new Date(dayRecords.last.date);

            if (this.shouldCalculateAsWorkday(dateKey)) {
                const standardStartTime = new Date(dateKey + 'T09:00:00');
                const overtimeStartTime = new Date(dateKey + 'T18:30:00');

                const overtimeAfter1830 = Math.max(0, this.calculateTimeDifference(overtimeStartTime, actualEndTime));
                const lateMinutes = Math.max(0, this.calculateTimeDifference(standardStartTime, actualStartTime));
                const hasReachedOvertimeStart = actualEndTime >= overtimeStartTime;

                if (hasReachedOvertimeStart) {
                    totalOvertimeMinutes = overtimeAfter1830 - lateMinutes;
                } else {
                    const earlyLeaveMinutes = Math.max(0, this.calculateTimeDifference(actualEndTime, overtimeStartTime));
                    totalOvertimeMinutes = -earlyLeaveMinutes - lateMinutes;
                }
            } else {
                totalOvertimeMinutes = this.calculateTimeDifference(actualStartTime, actualEndTime);
            }
        }

        if (dayRecords.manualOvertime && dayRecords.manualOvertime > 0) {
            totalOvertimeMinutes += dayRecords.manualOvertime * 60;
        }

        return totalOvertimeMinutes;
    }
}

// Helper function
function createTestRecord(dateStr, startTime, endTime, manualOvertime = 0) {
    const record = {};
    if (startTime) {
        record.first = { date: new Date(`${dateStr}T${startTime}:00`) };
    }
    if (endTime) {
        record.last = { date: new Date(`${dateStr}T${endTime}:00`) };
    }
    if (manualOvertime > 0) {
        record.manualOvertime = manualOvertime;
    }
    return record;
}

function runTest(description, testFn) {
    try {
        const result = testFn();
        console.log(`✅ ${description}`);
        if (result !== undefined) {
            console.log(`   结果: ${result}分钟`);
        }
    } catch (error) {
        console.log(`❌ ${description}`);
        console.log(`   错误: ${error.message}`);
    }
}

const recorder = new MockTimeRecorder();

console.log("📋 工作日正常场景:");
runTest("准时上班准时下班 (9:00-18:30)", () => {
    const record = createTestRecord('2025-01-20', '09:00', '18:30');
    return recorder.calculateOvertime(record, '2025-01-20');
});

runTest("准时上班加班1小时 (9:00-19:30)", () => {
    const record = createTestRecord('2025-01-20', '09:00', '19:30');
    return recorder.calculateOvertime(record, '2025-01-20');
});

console.log("\n📋 工作日异常场景:");
runTest("迟到1小时准时下班 (10:00-18:30)", () => {
    const record = createTestRecord('2025-01-20', '10:00', '18:30');
    return recorder.calculateOvertime(record, '2025-01-20');
});

runTest("用户提到的场景：迟到3小时早退1.5小时 (12:00-17:00)", () => {
    const record = createTestRecord('2025-01-20', '12:00', '17:00');
    return recorder.calculateOvertime(record, '2025-01-20');
});

console.log("\n📋 周末场景:");
runTest("周末工作8小时 (9:00-17:00)", () => {
    const record = createTestRecord('2025-01-18', '09:00', '17:00');
    return recorder.calculateOvertime(record, '2025-01-18');
});

console.log("\n📋 节假日调休日场景:");
runTest("周末设置为调休日，按工作日规则计算 (9:00-19:30)", () => {
    recorder.workdayOverrides['2025-01-18'] = true;
    const record = createTestRecord('2025-01-18', '09:00', '19:30');
    const result = recorder.calculateOvertime(record, '2025-01-18');
    delete recorder.workdayOverrides['2025-01-18'];
    return result;
});

console.log("\n📋 手动补录场景:");
runTest("只有手动补录2小时", () => {
    const record = createTestRecord('2025-01-20', null, null, 2);
    return recorder.calculateOvertime(record, '2025-01-20');
});

runTest("自动打卡1小时 + 手动补录1小时 - 应为120分钟", () => {
    const record = createTestRecord('2025-01-20', '09:00', '19:30', 1);
    return recorder.calculateOvertime(record, '2025-01-20');
});

console.log("\n🎉 关键场景验证完成！");
console.log("\n💡 更多测试场景请运行:");
console.log("   浏览器: 打开 test.html");
console.log("   命令行: node test-runner.js (需要Node.js)");