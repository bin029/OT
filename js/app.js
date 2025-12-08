// PWA应用逻辑
class TimeRecorder {
    constructor() {
        this.clickCount = 0;
        this.records = {}; // 改为对象，按日期分组：{ '2025-12-07': { first: {...}, last: {...} } }
        this.init();
    }

    init() {
        this.button = document.getElementById('clickButton');
        this.clearButton = document.getElementById('clearButton');
        this.clearAllButton = document.getElementById('clearAllButton');
        this.recordsList = document.getElementById('recordsList');
        this.weekOvertimeEl = document.getElementById('weekOvertime');
        this.monthOvertimeEl = document.getElementById('monthOvertime');

        // 绑定事件监听器
        this.button.addEventListener('click', () => this.recordClick());
        this.clearButton.addEventListener('click', () => this.clearTodayRecords());
        this.clearAllButton.addEventListener('click', () => this.clearAllRecords());

        // 加载保存的记录
        this.loadRecords();

        // 注册Service Worker
        this.registerServiceWorker();

        // 更新统计显示
        this.updateStatsDisplay();
    }

    recordClick() {
        this.clickCount++;
        const now = new Date();
        const todayKey = this.getDateKey(now);
        const timestamp = this.formatDateTime(now);

        // 确保今天有记录对象
        if (!this.records[todayKey]) {
            this.records[todayKey] = {};
        }

        // 如果是第一次点击，记录为上班打卡
        if (!this.records[todayKey].first) {
            this.records[todayKey].first = {
                id: Date.now(),
                timestamp: timestamp,
                count: this.clickCount,
                date: now.toISOString(),
                type: 'first'
            };
        } else if (!this.records[todayKey].last) {
            // 如果已经有上班记录且没有下班记录，则这次是下班打卡
            this.records[todayKey].last = {
                id: Date.now(),
                timestamp: timestamp,
                count: this.clickCount,
                date: now.toISOString(),
                type: 'last'
            };
        } else {
            // 如果已经有了完整的上下班记录，则这次点击更新下班时间
            this.records[todayKey].last = {
                id: Date.now(),
                timestamp: timestamp,
                count: this.clickCount,
                date: now.toISOString(),
                type: 'last'
            };
        }

        this.saveRecords();
        this.renderRecords();
        this.updateStatsDisplay();
    }

    // 清除当日打卡记录
    clearTodayRecords() {
        const today = new Date();
        const todayKey = this.getDateKey(today);
        const todayRecords = this.records[todayKey];

        if (!todayRecords) {
            // 今日没有记录，不做任何操作
            return;
        }

        // 如果有下班记录，先清除下班记录
        if (todayRecords.last) {
            delete todayRecords.last;
        } else if (todayRecords.first) {
            // 如果只有上班记录，清除上班记录
            delete todayRecords.first;
            // 如果删除后记录为空，删除整个日期记录
            if (Object.keys(todayRecords).length === 0) {
                delete this.records[todayKey];
            }
        }

        this.saveRecords();
        this.renderRecords();
        this.updateStatsDisplay();
    }

    // 清除全部打卡记录
    clearAllRecords() {
        // 显示确认对话框
        const confirmed = confirm('确定要清除所有打卡记录吗？此操作不可恢复！');
        if (!confirmed) {
            return;
        }

        // 清除所有记录
        this.records = {};
        this.clickCount = 0;

        // 保存空的记录
        this.saveRecords();
        this.renderRecords();
        this.updateStatsDisplay();
    }

    getDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 判断是否为工作日（周一至周五）
    isWorkday(date) {
        const dayOfWeek = date.getDay(); // 0=周日, 1=周一, ..., 6=周六
        return dayOfWeek >= 1 && dayOfWeek <= 5; // 周一到周五
    }

    // 计算时间差（分钟）
    calculateTimeDifference(startTime, endTime) {
        const diffMs = endTime.getTime() - startTime.getTime();
        return Math.round(diffMs / (1000 * 60)); // 转换为分钟
    }

    // 计算加班时间（分钟）
    calculateOvertime(dayRecords, dateKey) {
        const date = new Date(dateKey + 'T00:00:00');
        const dayOfWeek = date.getDay(); // 0=周日, 1=周一, ..., 6=周六

        // 如果没有完整的打卡记录（上班和下班），返回0
        if (!dayRecords.first || !dayRecords.last) {
            return 0;
        }

        const actualStartTime = new Date(dayRecords.first.date);
        const actualEndTime = new Date(dayRecords.last.date);

        // 周末（周六、周日）的计算规则：直接计算下班时间 - 上班时间
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            const weekendWorkMinutes = this.calculateTimeDifference(actualStartTime, actualEndTime);
            return weekendWorkMinutes;
        }

        // 工作日（周一至周五）的计算规则

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
            // 方案3：如果下班时间 ≥ 18:30，使用18:30以后的加班时间 - 迟到时间
            const finalOvertimeMinutes = overtimeAfter1830 - lateMinutes;
            return finalOvertimeMinutes;
        } else {
            // 方案3：如果下班时间 < 18:30，使用实际工作时长 - 9小时
            const actualWorkMinutes = this.calculateTimeDifference(actualStartTime, actualEndTime);
            const requiredWorkMinutes = 9 * 60; // 9小时 = 540分钟
            const finalOvertimeMinutes = actualWorkMinutes - requiredWorkMinutes;
            return finalOvertimeMinutes;
        }
    }

    // 格式化时间显示（小时:分钟）
    formatTimeDisplay(minutes) {
        const hours = Math.floor(Math.abs(minutes) / 60);
        const mins = Math.abs(minutes) % 60;
        const sign = minutes < 0 ? '-' : '';
        return `${sign}${hours}:${String(mins).padStart(2, '0')}`;
    }

    // 获取今日加班时间
    getTodayOvertime() {
        const today = new Date();
        const todayKey = this.getDateKey(today);
        const dayRecords = this.records[todayKey];
        return dayRecords ? this.calculateOvertime(dayRecords, todayKey) : 0;
    }

    // 获取本周加班时间总和
    getWeekOvertime() {
        const today = new Date();
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(today.getDate() - today.getDay()); // 本周周一

        let totalMinutes = 0;
        const dates = Object.keys(this.records);

        dates.forEach(dateKey => {
            const recordDate = new Date(dateKey + 'T00:00:00');
            // 检查是否在本周内
            if (recordDate >= currentWeekStart && recordDate <= today) {
                const dayRecords = this.records[dateKey];
                if (dayRecords) {
                    totalMinutes += this.calculateOvertime(dayRecords, dateKey);
                }
            }
        });

        return totalMinutes;
    }

    // 获取本月加班时间总和
    getMonthOvertime() {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        let totalMinutes = 0;
        const dates = Object.keys(this.records);

        dates.forEach(dateKey => {
            const recordDate = new Date(dateKey + 'T00:00:00');
            // 检查是否在本月内
            if (recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear) {
                const dayRecords = this.records[dateKey];
                if (dayRecords) {
                    totalMinutes += this.calculateOvertime(dayRecords, dateKey);
                }
            }
        });

        return totalMinutes;
    }

    // 更新统计数据显示
    updateStatsDisplay() {
        const weekOvertime = this.getWeekOvertime();
        const monthOvertime = this.getMonthOvertime();

        this.weekOvertimeEl.textContent = this.formatTimeDisplay(weekOvertime);
        this.weekOvertimeEl.className = `stat-value ${this.getOvertimeClass(weekOvertime)}`;

        this.monthOvertimeEl.textContent = this.formatTimeDisplay(monthOvertime);
        this.monthOvertimeEl.className = `stat-value ${this.getOvertimeClass(monthOvertime)}`;
    }

    // 获取加班时间的CSS类名
    getOvertimeClass(minutes) {
        if (minutes > 0) return 'overtime-positive';
        if (minutes < 0) return 'overtime-negative';
        return 'overtime-zero';
    }

    formatDateTime(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    }

    renderRecords() {
        const today = new Date();
        const todayKey = this.getDateKey(today);
        const todayRecords = this.records[todayKey];

        // 如果今天没有记录
        if (!todayRecords || (!todayRecords.first && !todayRecords.last)) {
            this.recordsList.innerHTML = '<div class="empty-message">今日还没有打卡记录</div>';
            return;
        }

        const overtimeMinutes = this.calculateOvertime(todayRecords, todayKey);
        const overtimeDisplay = this.formatTimeDisplay(overtimeMinutes);

        let html = `<div class="today-records">
            <div class="date-header">今日打卡记录</div>`;

        if (todayRecords.first) {
            html += `<div class="record-item">
                <span class="timestamp">${todayRecords.first.timestamp}</span>
                <span class="count">上班打卡时间</span>
            </div>`;
        }

        if (todayRecords.last && todayRecords.first && todayRecords.first.id !== todayRecords.last.id) {
            html += `<div class="record-item">
                <span class="timestamp">${todayRecords.last.timestamp}</span>
                <span class="count">下班打卡时间</span>
            </div>`;
        }

        // 添加今日加班时间显示
        const overtimeClass = overtimeMinutes > 0 ? 'overtime-positive' : overtimeMinutes < 0 ? 'overtime-negative' : 'overtime-zero';
        html += `<div class="record-item overtime-item">
            <span class="overtime-label">今日加班时间：</span>
            <span class="overtime-value ${overtimeClass}">${overtimeDisplay}</span>
        </div>`;

        html += '</div>';
        this.recordsList.innerHTML = html;
    }

    saveRecords() {
        try {
            localStorage.setItem('timeRecords', JSON.stringify(this.records));
        } catch (error) {
            console.warn('保存记录失败:', error);
        }
    }

    loadRecords() {
        try {
            const saved = localStorage.getItem('timeRecords');
            if (saved) {
                this.records = JSON.parse(saved);
                // 计算总点击次数
                let maxCount = 0;
                Object.values(this.records).forEach(dayRecords => {
                    if (dayRecords.first) maxCount = Math.max(maxCount, dayRecords.first.count);
                    if (dayRecords.last) maxCount = Math.max(maxCount, dayRecords.last.count);
                });
                this.clickCount = maxCount;
                this.renderRecords();
                this.updateStatsDisplay();
            }
        } catch (error) {
            console.warn('加载记录失败:', error);
            this.records = {};
            this.clickCount = 0;
            this.updateStatsDisplay();
        }
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('service-worker.js')
                    .then(registration => {
                        console.log('Service Worker 注册成功:', registration);
                    })
                    .catch(error => {
                        console.log('Service Worker 注册失败:', error);
                    });
            });
        }
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new TimeRecorder();
});
