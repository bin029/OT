// PWA应用逻辑
class TimeRecorder {
    constructor() {
        this.clickCount = 0;
        this.records = {}; // 改为对象，按日期分组：{ '2025-12-07': { first: {...}, last: {...} } }
        this.workdayOverrides = {}; // 节假日调休日：{ '2025-12-07': true } 表示该日按工作日计算
        this.init();
    }

    init() {
        this.button = document.getElementById('clickButton');
        this.clearButton = document.getElementById('clearButton');
        this.clearAllButton = document.getElementById('clearAllButton');
        this.manualOvertimeButton = document.getElementById('manualOvertimeButton');
        this.manualOvertimeModal = document.getElementById('manualOvertimeModal');
        this.manualOvertimeForm = document.getElementById('manualOvertimeForm');
        this.closeModalButton = document.getElementById('closeModalButton');
        this.cancelManualOvertime = document.getElementById('cancelManualOvertime');
        this.recordsList = document.getElementById('recordsList');
        this.monthRecordsList = document.getElementById('monthRecordsList');
        this.weekOvertimeEl = document.getElementById('weekOvertime');
        this.monthOvertimeEl = document.getElementById('monthOvertime');

        // 绑定事件监听器
        this.button.addEventListener('click', () => this.recordClick());
        this.clearButton.addEventListener('click', () => this.clearTodayRecords());
        this.clearAllButton.addEventListener('click', () => this.clearAllRecords());
        this.manualOvertimeButton.addEventListener('click', () => this.showManualOvertimeModal());
        this.closeModalButton.addEventListener('click', () => this.hideManualOvertimeModal());
        this.cancelManualOvertime.addEventListener('click', () => this.hideManualOvertimeModal());
        this.manualOvertimeForm.addEventListener('submit', (e) => this.handleManualOvertimeSubmit(e));

        // 委托事件监听器处理删除补录记录按钮
        this.monthRecordsList.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-manual-btn')) {
                const dateStr = e.target.getAttribute('data-date');
                this.deleteManualOvertime(dateStr);
            }
        });

        // 绑定标签页事件
        this.initTabs();

        // 启动数字时钟
        this.startDigitalClock();

        // 加载保存的记录
        this.loadRecords();
        this.loadWorkdayOverrides();

        // 检查是否需要自动同步节假日数据
        this.checkAutoSyncHolidays();

        // 注册Service Worker
        this.registerServiceWorker();

        // 更新统计显示
        this.updateStatsDisplay();
    }

    // 启动数字时钟
    startDigitalClock() {
        this.timeDisplay = document.getElementById('currentTime');
        this.dateDisplay = document.getElementById('currentDate');

        // 立即更新一次
        this.updateDigitalClock();

        // 每秒更新一次
        setInterval(() => {
            this.updateDigitalClock();
        }, 1000);
    }

    // 更新数字时钟显示
    updateDigitalClock() {
        const now = new Date();

        // 更新时间
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const timeString = `${hours}:${minutes}:${seconds}`;

        // 更新日期
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const weekdayName = this.getWeekdayName(now);
        const dateString = `${year}-${month}-${day} ${weekdayName}`;

        // 更新显示
        if (this.timeDisplay) {
            this.timeDisplay.textContent = timeString;
        }
        if (this.dateDisplay) {
            this.dateDisplay.textContent = dateString;
        }
    }

    // 初始化标签页功能
    initTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    }

    // 切换标签页
    switchTab(tabName) {
        // 更新按钮状态
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabPanes = document.querySelectorAll('.tab-pane');

        tabButtons.forEach(button => {
            if (button.getAttribute('data-tab') === tabName) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        // 更新内容区域
        tabPanes.forEach(pane => {
            if (pane.id === tabName + 'Tab') {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });

        // 如果切换到月度详情，更新月度数据
        if (tabName === 'month') {
            this.renderMonthDetails();
        }
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

        // 如果当前在月度详情标签页，也更新月度详情
        const activeTab = document.querySelector('.tab-pane.active');
        if (activeTab && activeTab.id === 'monthTab') {
            this.renderMonthDetails();
        }
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

        // 如果当前在月度详情标签页，也更新月度详情
        const activeTab = document.querySelector('.tab-pane.active');
        if (activeTab && activeTab.id === 'monthTab') {
            this.renderMonthDetails();
        }
    }

    // 清除全部打卡记录
    clearAllRecords() {
        console.log('=== 开始清除全部记录 ===');

        // 显示确认对话框
        const confirmed = window.confirm ? window.confirm('确定要清除所有打卡记录吗？此操作不可恢复！') : true;
        console.log('用户确认结果:', confirmed);

        if (!confirmed) {
            console.log('用户取消了清除操作');
            return;
        }

        console.log('开始清除数据...');

        // 清除所有记录
        this.records = {};
        this.clickCount = 0;

        console.log('数据已清除，records:', this.records);
        console.log('clickCount:', this.clickCount);

        // 强制保存空的记录到localStorage
        try {
            localStorage.setItem('timeRecords', JSON.stringify(this.records));
            console.log('数据已保存到LocalStorage');
        } catch (error) {
            console.error('保存空数据失败:', error);
        }

        // 强制更新界面
        this.renderRecords();
        this.updateStatsDisplay();

        // 如果当前在月度详情标签页，也更新月度详情
        const activeTab = document.querySelector('.tab-pane.active');
        if (activeTab && activeTab.id === 'monthTab') {
            this.renderMonthDetails();
        }

        console.log('=== 清除全部记录完成 ===');

        // 显示成功提示
        alert('所有打卡记录已清除！');
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

    // 判断某天是否需要按工作日规则计算（包括节假日调休）
    shouldCalculateAsWorkday(dateKey) {
        const date = new Date(dateKey + 'T00:00:00');
        const dayOfWeek = date.getDay();

        // 如果是周一到周五，正常按工作日计算
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            return true;
        }

        // 如果是周末（周六、周日），检查是否为节假日调休日
        return this.workdayOverrides[dateKey] === true;
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

        // 加上手动补录的加班时间（小时转换为分钟）
        if (dayRecords.manualOvertime && dayRecords.manualOvertime > 0) {
            totalOvertimeMinutes += dayRecords.manualOvertime * 60;
        }

        return totalOvertimeMinutes;
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
        const dayOfWeek = today.getDay();

        // 正确计算本周的周一日期
        if (dayOfWeek === 0) { // 周日
            currentWeekStart.setDate(today.getDate() - 6); // 上周一
        } else {
            currentWeekStart.setDate(today.getDate() - dayOfWeek + 1); // 本周一
        }

        // 将本周开始时间设置为00:00:00，确保包含当天的所有记录
        currentWeekStart.setHours(0, 0, 0, 0);

        // 将今天的时间设置为23:59:59，确保包含今天的记录
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        let totalMinutes = 0;
        const dates = Object.keys(this.records);

        dates.forEach(dateKey => {
            const recordDate = new Date(dateKey + 'T00:00:00');
            // 检查是否在本周内（使用正确的时间范围）
            if (recordDate >= currentWeekStart && recordDate <= todayEnd) {
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

    // 渲染月度详情
    renderMonthDetails() {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        const monthRecords = [];
        const dates = Object.keys(this.records);

        // 收集本月的所有记录
        dates.forEach(dateKey => {
            const recordDate = new Date(dateKey + 'T00:00:00');
            if (recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear) {
                const dayRecords = this.records[dateKey];
                if (dayRecords) {
                    const overtimeMinutes = this.calculateOvertime(dayRecords, dateKey);
                    const hasRecords = !!(dayRecords.first || dayRecords.last);
                    const hasManualOvertime = !!(dayRecords.manualOvertime && dayRecords.manualOvertime > 0);

                    if (overtimeMinutes !== 0 || hasRecords || hasManualOvertime) { // 显示有任何记录的日期
                        monthRecords.push({
                            date: dateKey,
                            dateObj: recordDate,
                            overtimeMinutes: overtimeMinutes,
                            hasRecords: hasRecords,
                            manualOvertime: dayRecords.manualOvertime || 0
                        });
                    }
                }
            }
        });

        // 按日期排序（最新的在前面）
        monthRecords.sort((a, b) => b.dateObj - a.dateObj);

        if (monthRecords.length === 0) {
            this.monthRecordsList.innerHTML = '<div class="empty-message">本月暂无加班记录</div>';
            return;
        }

        // 生成月度详情HTML
        const monthDetailsHtml = monthRecords.map(record => {
            const dateStr = record.date;
            const weekdayName = this.getWeekdayName(record.dateObj);
            const overtimeDisplay = this.formatTimeDisplay(record.overtimeMinutes);
            const overtimeClass = this.getOvertimeClass(record.overtimeMinutes);

            // 检查是否为调休日
            const isWorkdayOverride = this.workdayOverrides[dateStr];
            const dateLabel = isWorkdayOverride ? `${dateStr} ${weekdayName} (调休)` : `${dateStr} ${weekdayName}`;

            let detailHtml = `
                <div class="month-record-item">
                    <div class="month-record-date">${dateLabel}</div>
                    <div class="month-record-overtime ${overtimeClass}">${overtimeDisplay}</div>`;

            // 如果有手动补录记录，显示详细信息
            if (record.manualOvertime > 0) {
                const manualMinutes = record.manualOvertime * 60;
                const manualDisplay = this.formatTimeDisplay(manualMinutes);
                detailHtml += `
                    <div class="month-record-manual">
                        <span class="manual-label">补录：</span>
                        <span class="manual-value">${record.manualOvertime}小时 (${manualDisplay})</span>
                        <button class="delete-manual-btn" data-date="${dateStr}" title="删除补录记录">×</button>
                    </div>`;
            }

            detailHtml += `</div>`;
            return detailHtml;
        }).join('');

        // 计算月度总计
        const totalOvertime = monthRecords.reduce((sum, record) => sum + record.overtimeMinutes, 0);
        const totalDisplay = this.formatTimeDisplay(totalOvertime);
        const totalClass = this.getOvertimeClass(totalOvertime);

        const summaryHtml = `
            <div class="month-summary">
                <h4>月度总计</h4>
                <div class="month-total ${totalClass}">${totalDisplay}</div>
            </div>
        `;

        this.monthRecordsList.innerHTML = monthDetailsHtml + summaryHtml;
    }

    // 获取中文星期几
    getWeekdayName(date) {
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return weekdays[date.getDay()];
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

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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

    saveWorkdayOverrides() {
        try {
            localStorage.setItem('workdayOverrides', JSON.stringify(this.workdayOverrides));
        } catch (error) {
            console.warn('保存节假日设置失败:', error);
        }
    }

    loadWorkdayOverrides() {
        try {
            const saved = localStorage.getItem('workdayOverrides');
            if (saved) {
                this.workdayOverrides = JSON.parse(saved);
            }
        } catch (error) {
            console.warn('加载节假日设置失败:', error);
            this.workdayOverrides = {};
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

    // 显示补录加班模态框
    showManualOvertimeModal() {
        // 设置默认日期为今天
        const today = new Date();
        const todayStr = this.getDateKey(today);
        document.getElementById('overtimeDate').value = todayStr;
        document.getElementById('overtimeHours').value = '';

        // 显示模态框
        this.manualOvertimeModal.classList.add('active');
    }

    // 隐藏补录加班模态框
    hideManualOvertimeModal() {
        this.manualOvertimeModal.classList.remove('active');
        // 清除表单
        this.manualOvertimeForm.reset();
    }

    // 处理补录加班表单提交
    handleManualOvertimeSubmit(event) {
        event.preventDefault();

        const dateInput = document.getElementById('overtimeDate');
        const hoursInput = document.getElementById('overtimeHours');

        const dateStr = dateInput.value;
        const hours = parseFloat(hoursInput.value);

        // 验证输入
        if (!this.validateManualOvertimeInput(dateStr, hours)) {
            return;
        }

        // 保存补录数据
        this.saveManualOvertime(dateStr, hours);

        // 隐藏模态框
        this.hideManualOvertimeModal();

        // 更新显示
        this.updateStatsDisplay();
        this.renderRecords();

        // 如果当前在月度详情标签页，也更新月度详情
        const activeTab = document.querySelector('.tab-pane.active');
        if (activeTab && activeTab.id === 'monthTab') {
            this.renderMonthDetails();
        }

        // 显示成功提示
        alert('补录加班时间成功！');
    }

    // 验证补录输入数据
    validateManualOvertimeInput(dateStr, hours) {
        // 检查日期格式
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            alert('请输入有效的日期格式（YYYY-MM-DD）');
            return false;
        }

        // 检查日期是否为有效日期
        const date = new Date(dateStr + 'T00:00:00');
        if (isNaN(date.getTime())) {
            alert('请输入有效的日期');
            return false;
        }

        // 检查小时数
        if (isNaN(hours) || hours < 0 || hours > 24) {
            alert('请输入有效的加班小时数（0-24之间）');
            return false;
        }

        return true;
    }

    // 保存手动补录的加班时间
    saveManualOvertime(dateStr, hours) {
        // 确保日期记录存在
        if (!this.records[dateStr]) {
            this.records[dateStr] = {};
        }

        // 保存手动补录的小时数
        this.records[dateStr].manualOvertime = hours;

        // 保存到localStorage
        this.saveRecords();
    }

    // 删除手动补录的加班时间
    deleteManualOvertime(dateStr) {
        if (!this.records[dateStr]) {
            return;
        }

        // 确认删除
        const confirmed = window.confirm ? window.confirm('确定要删除这个日期的补录加班记录吗？') : true;

        if (!confirmed) {
            return;
        }

        // 删除手动补录记录
        delete this.records[dateStr].manualOvertime;

        // 如果该日期没有任何记录，删除整个日期记录
        if (Object.keys(this.records[dateStr]).length === 0) {
            delete this.records[dateStr];
        }

        // 保存更改
        this.saveRecords();

        // 更新显示
        this.updateStatsDisplay();
        this.renderRecords();
        this.renderMonthDetails();

        // 显示成功提示
        alert('补录记录已删除！');
    }


    // 从API同步节假日数据
    async syncHolidaysFromAPI() {
        const currentYear = new Date().getFullYear();

        // 检查缓存
        const cacheKey = `holidays_cache_${currentYear}`;
        const cachedData = localStorage.getItem(cacheKey);

        if (cachedData) {
            try {
                const cache = JSON.parse(cachedData);
                // 直接使用缓存数据（没有有效期限制）
                this.processHolidayData(cache.data);
                return;
            } catch (error) {
                console.warn('解析节假日缓存数据失败:', error);
                // 缓存数据损坏，继续同步
            }
        }

        // 显示加载状态
        const originalText = this.syncHolidaysButton.textContent;
        this.syncHolidaysButton.textContent = '同步中...';
        this.syncHolidaysButton.disabled = true;

        try {
            // 检查网络连接
            if (!navigator.onLine) {
                console.warn('网络连接不可用，跳过节假日数据同步');
                return;
            }

            // 调用节假日API
            const response = await fetch(`https://api.apihubs.cn/holiday/get?year=${currentYear}`, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.code === 0 && data.data) {
                // 缓存数据
                const cacheData = {
                    timestamp: new Date().toISOString(),
                    lastSyncMonth: new Date().getMonth(),
                    data: data.data
                };
                localStorage.setItem(cacheKey, JSON.stringify(cacheData));

                // 处理节假日数据
                this.processHolidayData(data.data);

                console.log('节假日数据同步成功，设置了调休日:', Object.keys(this.workdayOverrides).length);
            } else {
                throw new Error(data.msg || '获取节假日数据失败');
            }

        } catch (error) {
            console.error('同步节假日数据失败:', error);
            // 静默失败，不影响用户体验
        }
    }

    // 检查是否需要自动同步节假日数据
    checkAutoSyncHolidays() {
        const currentYear = new Date().getFullYear();
        const cacheKey = `holidays_cache_${currentYear}`;
        const cachedData = localStorage.getItem(cacheKey);
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentDay = now.getDate();

        // 检查是否为每月1日
        const isFirstDayOfMonth = currentDay === 1;

        if (!cachedData) {
            // 没有缓存数据，首次使用时自动同步
            console.log('首次使用，自动同步节假日数据...');
            this.syncHolidaysFromAPI().catch(error => {
                console.warn('自动同步节假日数据失败:', error);
                // 不显示错误提示，避免影响用户体验
            });
            return;
        }

        try {
            const cache = JSON.parse(cachedData);

            // 检查是否需要每月1日同步
            if (isFirstDayOfMonth) {
                const lastSyncMonth = cache.lastSyncMonth || -1;
                // 如果是新的月份，重新同步
                if (lastSyncMonth !== currentMonth) {
                    console.log('每月1日，自动同步节假日数据更新...');
                    this.syncHolidaysFromAPI().catch(error => {
                        console.warn('每月1日自动同步节假日数据失败:', error);
                    });
                }
            }
        } catch (error) {
            console.warn('检查节假日缓存失败:', error);
            // 如果缓存数据损坏，重新同步
            this.syncHolidaysFromAPI().catch(error => {
                console.warn('重新同步节假日数据失败:', error);
            });
        }
    }

    // 处理节假日API返回的数据
    processHolidayData(holidayData) {
        let updatedCount = 0;

        // 遍历所有日期，找出调休日（周末需要上班的日子）
        Object.keys(holidayData).forEach(dateStr => {
            const dayInfo = holidayData[dateStr];
            const date = new Date(dateStr + 'T00:00:00');
            const dayOfWeek = date.getDay();

            // 如果是周末且为工作日（调休日），设置为调休日
            if ((dayOfWeek === 0 || dayOfWeek === 6) && dayInfo.work === true) {
                if (!this.workdayOverrides[dateStr]) {
                    this.workdayOverrides[dateStr] = true;
                    updatedCount++;
                }
            }
        });

        if (updatedCount > 0) {
            this.saveWorkdayOverrides();
            this.updateStatsDisplay();

            // 如果当前在月度详情标签页，也更新月度详情
            const activeTab = document.querySelector('.tab-pane.active');
            if (activeTab && activeTab.id === 'monthTab') {
                this.renderMonthDetails();
            }
        }
    }

}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new TimeRecorder();
});
