/**
 * 向开发人员留言（本地 / 云）
 */
const config = require('./config');
const authService = require('./authService');

async function submitMessage(payload) {
  const account = authService.getCachedAccount();
  const data = {
    name: String(payload.name || '').trim(),
    phone: String(payload.phone || '').trim(),
    wechat: String(payload.wechat || '').trim(),
    content: String(payload.content || '').trim(),
    personId: (account && account.personId) || '',
    accountName: (account && account.name) || '',
    status: 'pending',
    createTime: new Date().toISOString()
  };

  if (!data.name || !data.content) {
    return { success: false, message: '请填写姓名和留言内容' };
  }

  if (config.isLocalMode()) {
    const list = wx.getStorageSync('dev_messages') || [];
    list.unshift(Object.assign({ _id: `msg_${Date.now()}` }, data));
    wx.setStorageSync('dev_messages', list);
    return { success: true, message: '留言已提交，开发人员将尽快查看' };
  }

  try {
    const { result } = await wx.cloud.callFunction({
      name: 'authApi',
      data: {
        action: 'submitDevMessage',
        name: data.name,
        phone: data.phone,
        wechat: data.wechat,
        content: data.content,
        personId: data.personId,
        accountName: data.accountName
      }
    });
    return result || { success: false, message: '提交失败' };
  } catch (err) {
    return { success: false, message: err.message || '提交失败' };
  }
}

module.exports = {
  submitMessage
};
