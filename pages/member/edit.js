const authGuard = require('../../utils/authGuard');
const authService = require('../../utils/authService');
const memberManageService = require('../../utils/memberManageService');
const localDb = require('../../utils/localDb');
const config = require('../../utils/config');
const { isModernMember } = require('../../utils/memberEra');
const { fromGregorian, fromLunar, preloadLunarLib } = require('../../utils/dateConvert');
const {
  formatModernLunarLine,
  formatModernGregorianLine
} = require('../../utils/memberEra');
const { MAX_MULTI } = require('../../utils/familyPermission');

Page({
  data: {
    targetId: '',
    isModern: true,
    isSelf: false,
    genders: ['男', '女'],
    genderIndex: 0,
    calendarTypes: [
      { value: 'lunar', label: '农历（默认）' },
      { value: 'gregorian', label: '公历' }
    ],
    calendarIndex: 0,
    form: {
      name: '',
      residence: '',
      burialPlace: '',
      remark: '',
      phone: '',
      wechat: '',
      lYear: '',
      lMonth: '',
      lDay: '',
      gYear: '',
      gMonth: '',
      gDay: ''
    },
    education: [],
    honors: [],
    positions: [],
    workplaces: [],
    birthPreviewLunar: '',
    birthPreviewGregorian: '',
    loading: false
  },

  async onLoad(options) {
    await preloadLunarLib();
    if (!authGuard.requireAuth({ replace: true })) return;
    const targetId = options.id;
    if (!targetId) {
      wx.showToast({ title: '缺少成员ID', icon: 'none' });
      return;
    }

    const permRes = await memberManageService.getPermission(targetId);
    if (!permRes.success || !permRes.permission || !permRes.permission.canEdit) {
      wx.showModal({
        title: '无法编辑',
        content: (permRes.permission && permRes.permission.lockReason) || permRes.message || '无权修改',
        showCancel: false,
        success: () => wx.navigateBack()
      });
      return;
    }
    // 云函数已解析出的真实文档 _id（优先）
    const preferredId = permRes.targetId || targetId;

    let member = null;
    if (config.isLocalMode()) {
      localDb.init();
      member = localDb.findById('members', preferredId) || localDb.findById('members', targetId);
    } else {
      try {
        const db = wx.cloud.database();
        const doc = await db.collection('members').doc(preferredId).get();
        member = doc.data;
        if (member && !member._id) member._id = preferredId;
      } catch (e) {
        try {
          const db = wx.cloud.database();
          const q = await db.collection('members').where({
            originalId: targetId
          }).limit(1).get();
          member = (q.data && q.data[0]) || null;
        } catch (e2) {
          member = null;
        }
      }
    }

    if (!member) {
      wx.showToast({ title: '成员不存在', icon: 'none' });
      return;
    }
    // 后续保存一律用云文档 _id
    const resolvedId = member._id || preferredId || targetId;

    const account = authService.getCachedAccount();
    const isSelf = !!(account && (
      account.personId === resolvedId ||
      account.personId === targetId ||
      account.personId === member.originalId ||
      account.personId === member.memberId
    ));
    const isModern = isModernMember(member);
    const lunar = (member.birthDate && member.birthDate.lunar) || {};
    const greg = (member.birthDate && member.birthDate.gregorian) || {};

    const education = (member.education || []).map(e => ({
      degree: typeof e === 'string' ? e : (e.degree || ''),
      school: typeof e === 'string' ? '' : (e.school || ''),
      year: typeof e === 'string' ? '' : (e.year != null ? String(e.year) : '')
    }));
    const honors = (member.honors || []).map(h => ({
      title: typeof h === 'string' ? h : (h.title || h.name || '')
    }));
    const positions = (member.positions || []).map(p => ({
      title: typeof p === 'string' ? p : (p.title || '')
    }));
    const workplaces = (member.workplaces || []).map(w => ({
      name: typeof w === 'string' ? w : (w.name || w.organization || ''),
      title: typeof w === 'string' ? '' : (w.title || '')
    }));

    this.setData({
      targetId: resolvedId,
      isModern,
      isSelf,
      genderIndex: member.gender === '女' ? 1 : 0,
      calendarIndex: 0,
      form: {
        name: member.name || '',
        residence: member.residence || '',
        burialPlace: member.burialPlace || '',
        remark: member.remark || '',
        phone: member.phone || '',
        wechat: member.wechat || '',
        lYear: lunar.year || '',
        lMonth: lunar.month || '',
        lDay: lunar.day || '',
        gYear: greg.year || '',
        gMonth: greg.month || '',
        gDay: greg.day || ''
      },
      education,
      honors,
      positions,
      workplaces
    }, () => this.refreshBirthPreview());
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onGenderChange(e) {
    this.setData({ genderIndex: Number(e.detail.value) });
  },

  onCalendarChange(e) {
    this.setData({ calendarIndex: Number(e.detail.value) }, () => this.refreshBirthPreview());
  },

  onBirthInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value }, () => this.refreshBirthPreview());
  },

  refreshBirthPreview() {
    const { form, calendarIndex, calendarTypes } = this.data;
    const type = calendarTypes[calendarIndex].value;
    let full = null;
    if (type === 'lunar' && form.lYear && form.lMonth && form.lDay) {
      full = fromLunar(form.lYear, form.lMonth, form.lDay, false);
    } else if (type === 'gregorian' && form.gYear && form.gMonth && form.gDay) {
      full = fromGregorian(form.gYear, form.gMonth, form.gDay);
    }
    if (!full) {
      this.setData({ birthPreviewLunar: '', birthPreviewGregorian: '' });
      return;
    }
    // 同步另一侧输入框（互转成功才覆盖；兜底结构可能只有一侧）
    const lunar = full.lunar || {};
    const gregorian = full.gregorian || {};
    const patch = {
      birthPreviewLunar: formatModernLunarLine(full) || '',
      birthPreviewGregorian: formatModernGregorianLine(full) || ''
    };
    if (lunar.year && lunar.month && lunar.day) {
      patch['form.lYear'] = lunar.year;
      patch['form.lMonth'] = lunar.month;
      patch['form.lDay'] = lunar.day;
    }
    if (gregorian.year && gregorian.month && gregorian.day) {
      patch['form.gYear'] = gregorian.year;
      patch['form.gMonth'] = gregorian.month;
      patch['form.gDay'] = gregorian.day;
    }
    this.setData(patch);
  },

  addMulti(e) {
    const list = e.currentTarget.dataset.list;
    const arr = (this.data[list] || []).slice();
    if (arr.length >= MAX_MULTI) {
      wx.showToast({ title: `最多${MAX_MULTI}条`, icon: 'none' });
      return;
    }
    if (list === 'education') arr.push({ degree: '', school: '', year: '' });
    else if (list === 'workplaces') arr.push({ name: '', title: '' });
    else arr.push({ title: '' });
    this.setData({ [list]: arr });
  },

  removeMulti(e) {
    const { list, index } = e.currentTarget.dataset;
    const arr = (this.data[list] || []).slice();
    arr.splice(Number(index), 1);
    this.setData({ [list]: arr });
  },

  onMultiInput(e) {
    const { list, index, key } = e.currentTarget.dataset;
    this.setData({ [`${list}[${index}].${key}`]: e.detail.value });
  },

  goRebind() {
    wx.navigateTo({ url: '/pages/account/rebind' });
  },

  buildBirthDate() {
    const { form, calendarIndex, calendarTypes } = this.data;
    const type = calendarTypes[calendarIndex].value;
    if (type === 'lunar' && form.lYear && form.lMonth && form.lDay) {
      return fromLunar(form.lYear, form.lMonth, form.lDay, false);
    }
    if (type === 'gregorian' && form.gYear && form.gMonth && form.gDay) {
      return fromGregorian(form.gYear, form.gMonth, form.gDay);
    }
    return null;
  },

  hasBirthInput() {
    const { form, calendarIndex, calendarTypes } = this.data;
    const type = calendarTypes[calendarIndex].value;
    if (type === 'lunar') return !!(form.lYear && form.lMonth && form.lDay);
    return !!(form.gYear && form.gMonth && form.gDay);
  },

  async submit() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    wx.showLoading({ title: '保存中...' });
    try {
      await preloadLunarLib();
      const form = this.data.form;
      const birthDate = this.buildBirthDate();
      if (this.hasBirthInput() && !birthDate) {
        wx.hideLoading();
        this.setData({ loading: false });
        wx.showModal({
          title: '生日无效',
          content: '请检查年月日是否填写正确',
          showCancel: false
        });
        return;
      }
      const patch = {
        name: form.name,
        gender: this.data.genders[this.data.genderIndex],
        remark: form.remark,
        education: this.data.education,
        honors: this.data.honors,
        positions: this.data.positions
      };
      if (birthDate) patch.birthDate = birthDate;

      if (this.data.isModern) {
        patch.residence = form.residence;
        patch.phone = form.phone;
        patch.wechat = form.wechat;
        patch.workplaces = this.data.workplaces;
        patch.burialPlace = '';
      } else {
        patch.burialPlace = form.burialPlace;
        patch.residence = '';
      }

      const res = await memberManageService.updateMember(this.data.targetId, patch);
      wx.hideLoading();
      this.setData({ loading: false });
      if (!res.success) {
        wx.showModal({
          title: '保存失败',
          content: res.message || '请确认已部署云函数 memberManageApi',
          showCancel: false
        });
        return;
      }
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 400);
    } catch (err) {
      wx.hideLoading();
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    }
  }
});
