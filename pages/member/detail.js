// pages/member/detail.js
const authGuard = require('../../utils/authGuard');
const memberManageService = require('../../utils/memberManageService');

Page({
  data: {
    member: null,
    nameInitial: '',
    loading: true,
    showPhotoCanvas: false,
    canvasWidth: 360,
    canvasHeight: 640,
    permission: {
      canEdit: false,
      canDelete: false,
      canAddChild: false,
      canAddSpouse: false,
      locked: false,
      lockReason: '',
      relation: 'none'
    }
  },

  async onLoad(options) {
    if (!(await authGuard.requireAuthAsync({ replace: true }))) return;
    this.memberId = options.id;
    this._firstShow = true;
    this.loadMemberDetail(options.id);
  },

  onShow() {
    if (!authGuard.requireAuth({ replace: true })) return;
    if (this._firstShow) {
      this._firstShow = false;
      return;
    }
    if (this.memberId) {
      this.loadMemberDetail(this.memberId);
    }
  },

  async loadMemberDetail(id) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getMemberDetail',
        data: { id }
      });

      if (res.result && res.result.success) {
        const member = this.normalizeSpouseLinks(res.result.data);
        const { displayNameChar } = require('../../utils/nameInitial');
        this.setData({
          member,
          nameInitial: displayNameChar(member && member.name, {
            generation: member && member.generation,
            branch: member && member.branch
          }),
          loading: false
        });
        this.loadPermission(id);
      } else {
        wx.showToast({ title: res.result?.message || '加载失败', icon: 'none' });
        this.setData({ loading: false });
      }
    } catch (err) {
      console.error('加载失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  /** 兼容旧版云函数：补全配偶跳转所需的 linkType / linkId */
  normalizeSpouseLinks(member) {
    if (!member) return member;
    const wives = Array.isArray(member.wives) ? member.wives : [];
    member.wives = wives
      .filter(w => w && w.name && (w.memberDocId || w._id || (w.linkType && w.linkId)))
      .map(w => {
        if (w.linkType && w.linkId) return w;
        if (w.memberDocId) {
          return Object.assign({}, w, { linkType: 'member', linkId: w.memberDocId });
        }
        if (w._id) {
          return Object.assign({}, w, { linkType: 'wife', linkId: w._id });
        }
        return w;
      });
    const husbands = Array.isArray(member.husbands) ? member.husbands : [];
    member.husbands = husbands
      .filter(h => h && h.name && (h.memberDocId || h._id || h.linkId))
      .map(h => {
        if (h.linkType && h.linkId) return h;
        const mid = h.memberDocId || h._id || h.linkId;
        return Object.assign({}, h, {
          memberDocId: mid,
          linkType: 'member',
          linkId: mid
        });
      });
    return member;
  },

  async loadPermission(id) {
    try {
      const res = await memberManageService.getPermission(id);
      if (res.success && res.permission) {
        this.setData({ permission: res.permission });
      }
    } catch (err) {
      console.warn('权限加载失败', err);
    }
  },

  goEdit() {
    if (!this.data.permission.canEdit) {
      wx.showToast({
        title: this.data.permission.lockReason || '无权编辑',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({ url: `/pages/member/edit?id=${this.memberId}` });
  },

  goAddChild() {
    if (!this.data.permission.canAddChild) {
      wx.showToast({
        title: this.data.permission.lockReason || '无权添加子女',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({ url: '/pages/member/add-family?relation=child' });
  },

  goAddSpouse() {
    if (!this.data.permission.canAddSpouse) {
      wx.showToast({
        title: this.data.permission.lockReason || '无权添加配偶',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({ url: '/pages/member/add-family?relation=spouse' });
  },

  confirmDelete() {
    if (!this.data.permission.canDelete) {
      wx.showToast({
        title: this.data.permission.lockReason || '无权删除',
        icon: 'none'
      });
      return;
    }
    const name = (this.data.member && this.data.member.name) || '';
    wx.showModal({
      title: '确认删除',
      content: `确定删除「${name}」？此操作仅适用于未认证的配偶或子女。`,
      success: async (r) => {
        if (!r.confirm) return;
        wx.showLoading({ title: '删除中...' });
        try {
          const res = await memberManageService.deleteMember(this.memberId);
          wx.hideLoading();
          if (!res.success) {
            wx.showToast({ title: res.message || '删除失败', icon: 'none' });
            return;
          }
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 400);
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: err.message || '删除失败', icon: 'none' });
        }
      }
    });
  },

  goToMember(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    if (currentPage && currentPage.route === 'pages/member/detail') {
      wx.redirectTo({ url: '/pages/member/detail?id=' + id });
    } else {
      wx.navigateTo({ url: '/pages/member/detail?id=' + id });
    }
  },

  goToWife(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/wife-detail/wife-detail?id=' + id });
  },

  goToSpouse(e) {
    const memberId = e.currentTarget.dataset.memberId;
    const wifeId = e.currentTarget.dataset.wifeId;
    if (memberId) {
      this.goToMember({ currentTarget: { dataset: { id: memberId } } });
      return;
    }
    if (wifeId) {
      this.goToWife({ currentTarget: { dataset: { id: wifeId } } });
    }
  },

  goBack() {
    wx.navigateBack();
  },

  submitClue() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  onCallPhone(e) {
    const phone = (e.currentTarget.dataset.phone || '').trim();
    if (!phone) return;
    wx.makePhoneCall({ phoneNumber: phone });
  },

  onCopyWechat(e) {
    const wechat = (e.currentTarget.dataset.wechat || '').trim();
    if (!wechat) return;
    wx.setClipboardData({
      data: wechat,
      success: () => wx.showToast({ title: '已复制微信号', icon: 'success' })
    });
  },

  onBindContact(e) {
    if (!this.data.permission.canEdit) {
      wx.showToast({ title: '无权修改', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/member/edit?id=${this.memberId}` });
  },

  onOpenBurialGps() {
    const raw = String((this.data.member && this.data.member.burialGps) || '').trim();
    if (!raw) return;
    const m = raw.match(/(-?\d+\.?\d*)\s*[,，\s]\s*(-?\d+\.?\d*)/);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      wx.openLocation({
        latitude: lat,
        longitude: lng,
        name: (this.data.member && this.data.member.burialPlace) || '墓葬地',
        scale: 16
      });
      return;
    }
    wx.setClipboardData({
      data: raw,
      success: () => wx.showToast({ title: '已复制定位信息', icon: 'success' })
    });
  },

  onPreviewGallery(e) {
    const list = (this.data.member && this.data.member.photoGalleryList) || [];
    if (!list.length) return;
    const index = Number(e.currentTarget.dataset.index) || 0;
    wx.previewImage({
      current: list[index],
      urls: list
    });
  },

  choosePhoto() {
    if (!this.data.permission.canEdit) {
      wx.showToast({
        title: this.data.permission.lockReason || '无权修改相片',
        icon: 'none'
      });
      return;
    }
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file || !file.tempFilePath) return;
        that.cropToNineSixteen(file.tempFilePath);
      }
    });
  },

  cropToNineSixteen(srcPath) {
    const that = this;
    wx.getImageInfo({
      src: srcPath,
      success(info) {
        const targetW = 360;
        const targetH = 640; // 9:16
        const srcW = info.width;
        const srcH = info.height;
        const targetRatio = 9 / 16;
        const srcRatio = srcW / srcH;

        let sx = 0;
        let sy = 0;
        let sw = srcW;
        let sh = srcH;
        if (srcRatio > targetRatio) {
          // 过宽：左右裁
          sw = Math.round(srcH * targetRatio);
          sx = Math.round((srcW - sw) / 2);
        } else {
          // 过高：上下裁
          sh = Math.round(srcW / targetRatio);
          sy = Math.round((srcH - sh) / 2);
        }

        that.setData({ showPhotoCanvas: true, canvasWidth: targetW, canvasHeight: targetH }, () => {
          const ctx = wx.createCanvasContext('photoCropCanvas', that);
          ctx.clearRect(0, 0, targetW, targetH);
          ctx.drawImage(srcPath, sx, sy, sw, sh, 0, 0, targetW, targetH);
          ctx.draw(false, () => {
            setTimeout(() => {
              wx.canvasToTempFilePath({
                canvasId: 'photoCropCanvas',
                x: 0,
                y: 0,
                width: targetW,
                height: targetH,
                destWidth: targetW,
                destHeight: targetH,
                fileType: 'jpg',
                quality: 0.85,
                success: async (out) => {
                  that.setData({ showPhotoCanvas: false });
                  await that.savePhoto(out.tempFilePath);
                },
                fail: (err) => {
                  console.error('导出相片失败', err);
                  that.setData({ showPhotoCanvas: false });
                  that.savePhoto(srcPath);
                }
              }, that);
            }, 80);
          });
        });
      },
      fail() {
        that.savePhoto(srcPath);
      }
    });
  },

  async savePhoto(photoPath) {
    const id = this.memberId || (this.data.member && this.data.member._id);
    if (!id) return;
    if (!this.data.permission.canEdit) {
      wx.showToast({ title: '无权修改相片', icon: 'none' });
      return;
    }

    try {
      const manageRes = await memberManageService.updateMember(id, {
        photo: photoPath,
        avatar: photoPath
      });
      if (manageRes.success) {
        this.setData({ 'member.photo': photoPath });
        wx.showToast({ title: '已更新相片', icon: 'success' });
        return;
      }

      const res = await wx.cloud.callFunction({
        name: 'adminApi',
        data: {
          action: 'updateMemberPhoto',
          id,
          photo: photoPath
        }
      });
      if (res.result && res.result.success) {
        this.setData({ 'member.photo': photoPath });
        wx.showToast({ title: '已更新相片', icon: 'success' });
      } else {
        const localDb = require('../../utils/localDb');
        if (localDb.setLocalPhoto) {
          localDb.setLocalPhoto(id, photoPath);
          this.setData({ 'member.photo': photoPath });
          wx.showToast({ title: '已更新相片', icon: 'success' });
        } else {
          wx.showToast({ title: res.result?.message || '保存失败', icon: 'none' });
        }
      }
    } catch (err) {
      console.error(err);
      try {
        const localDb = require('../../utils/localDb');
        localDb.setLocalPhoto(id, photoPath);
        this.setData({ 'member.photo': photoPath });
        wx.showToast({ title: '已更新相片', icon: 'success' });
      } catch (e2) {
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    }
  }
});
