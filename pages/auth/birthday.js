const authService = require('../../utils/authService');

const DAY_LABELS = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
];

Page({
  data: {
    ticketId: '',
    matchCount: 0,
    years: [],
    yearIndex: 0,
    months: [],
    monthIndex: 0,
    days: [],
    dayIndex: 0,
    error: '',
    canAppeal: false,
    loading: false
  },

  onLoad(options) {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = 1912; y <= currentYear; y++) years.push(y);

    const months = [];
    for (let m = 1; m <= 12; m++) {
      months.push({ value: m, label: `${m}月` });
    }

    const days = DAY_LABELS.map((label, i) => ({ value: i + 1, label }));

    // 默认选中较常见的中年区间
    const defaultYear = 1960;
    let yearIndex = years.indexOf(defaultYear);
    if (yearIndex < 0) yearIndex = years.length - 1;

    this.setData({
      ticketId: decodeURIComponent(options.ticketId || ''),
      matchCount: Number(options.matchCount || 0),
      years,
      yearIndex,
      months,
      monthIndex: 0,
      days,
      dayIndex: 0
    });
  },

  onYearChange(e) {
    this.setData({ yearIndex: Number(e.detail.value), error: '', canAppeal: false });
  },

  onMonthChange(e) {
    this.setData({ monthIndex: Number(e.detail.value), error: '', canAppeal: false });
  },

  onDayChange(e) {
    this.setData({ dayIndex: Number(e.detail.value), error: '', canAppeal: false });
  },

  async submit() {
    if (this.data.loading) return;
    const { ticketId, years, yearIndex, months, monthIndex, days, dayIndex } = this.data;
    if (!ticketId) {
      this.setData({ error: '验证会话无效，请重新开始' });
      return;
    }

    this.setData({ loading: true, error: '', canAppeal: false });
    wx.showLoading({ title: '验证中...' });

    try {
      const res = await authService.verifyBirthday(
        ticketId,
        years[yearIndex],
        months[monthIndex].value,
        days[dayIndex].value
      );
      wx.hideLoading();
      this.setData({ loading: false });

      if (!res.success) {
        this.setData({
          error: res.message || '验证失败',
          canAppeal: !!res.canAppeal
        });
        return;
      }

      wx.navigateTo({
        url: `/pages/auth/father?ticketId=${encodeURIComponent(res.ticketId)}`
      });
    } catch (err) {
      wx.hideLoading();
      this.setData({ loading: false, error: err.message || '网络错误' });
    }
  },

  goAppeal() {
    wx.navigateTo({ url: '/pages/auth/appeal' });
  }
});
