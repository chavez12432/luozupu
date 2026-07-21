/**
 * 用户身份验证与账号绑定云函数
 * actions: getSession | resetMyBinding | verifyName | verifyBirthday | verifyFather | bindPhone | submitAppeal
 */
const cloud = require('wx-server-sdk');
const { withClanSurname } = require('./clanName');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const TICKET_TTL_MS = 30 * 60 * 1000;
const COL_ACCOUNTS = 'user_accounts';
const COL_TICKETS = 'verify_tickets';
const COL_MEMBERS = 'members';
const COL_APPEALS = 'appeals';

function ok(data = {}) {
  return Object.assign({ success: true }, data);
}

function fail(message, extra = {}) {
  return Object.assign({ success: false, message }, extra);
}

/**
 * 验证用全名：须以「罗」开头，并规范为「罗+名」（消除罗罗）
 * 未带姓返回 null
 */
function normalizeFullName(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (!raw.startsWith('罗')) return null;
  const full = withClanSurname(raw);
  return full && full.length > 1 ? full : null;
}

function getLunar(member) {
  return (member && member.birthDate && member.birthDate.lunar) || null;
}

function hasFullLunarBirth(member) {
  const lunar = getLunar(member);
  return !!(lunar && lunar.year && lunar.month && lunar.day);
}

function matchLunarBirth(member, year, month, day) {
  const lunar = getLunar(member);
  if (!lunar) return false;
  return Number(lunar.year) === Number(year)
    && Number(lunar.month) === Number(month)
    && Number(lunar.day) === Number(day);
}

function publicMember(m) {
  const lunar = getLunar(m) || {};
  return {
    _id: m._id,
    name: m.name,
    generation: m.generation,
    branch: m.branch,
    fatherName: m.fatherName || '',
    hasBirth: hasFullLunarBirth(m),
    birthYear: lunar.year || null
  };
}

async function getOpenId() {
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID || '',
    unionid: wxContext.UNIONID || ''
  };
}

async function findAccountByOpenId(openid) {
  if (!openid) return null;
  const res = await db.collection(COL_ACCOUNTS).where({ openid }).limit(1).get();
  return res.data[0] || null;
}

async function getTicket(ticketId, openid) {
  if (!ticketId) return null;
  const res = await db.collection(COL_TICKETS).doc(ticketId).get().catch(() => null);
  if (!res || !res.data) return null;
  const ticket = res.data;
  if (ticket.openid && ticket.openid !== openid) return null;
  if (ticket.expireAt && ticket.expireAt < Date.now()) return null;
  return ticket;
}

async function saveTicket(ticketId, data) {
  const now = Date.now();
  const payload = Object.assign({}, data, {
    updateTime: db.serverDate(),
    expireAt: now + TICKET_TTL_MS
  });
  if (ticketId) {
    await db.collection(COL_TICKETS).doc(ticketId).update({ data: payload });
    return ticketId;
  }
  const addRes = await db.collection(COL_TICKETS).add({
    data: Object.assign({ createTime: db.serverDate() }, payload)
  });
  return addRes._id;
}

async function loadMembersByIds(ids) {
  if (!ids || !ids.length) return [];
  const chunks = [];
  for (let i = 0; i < ids.length; i += 20) {
    chunks.push(ids.slice(i, i + 20));
  }
  const lists = await Promise.all(
    chunks.map(chunk =>
      db.collection(COL_MEMBERS).where({ _id: _.in(chunk) }).limit(100).get()
    )
  );
  const map = Object.create(null);
  lists.forEach(r => r.data.forEach(m => { map[m._id] = m; }));
  return ids.map(id => map[id]).filter(Boolean);
}

async function resolveFatherName(member) {
  if (member.fatherName) return withClanSurname(member.fatherName);
  if (member.fatherId === '' || member.fatherId == null) return '';
  const res = await db.collection(COL_MEMBERS)
    .where({ originalId: _.eq(Number(member.fatherId)) })
    .limit(1)
    .get();
  let father = res.data[0];
  if (!father) {
    const res2 = await db.collection(COL_MEMBERS)
      .where({ originalId: String(member.fatherId) })
      .limit(1)
      .get();
    father = res2.data[0];
  }
  if (!father) {
    const res3 = await db.collection(COL_MEMBERS)
      .where({ memberId: member.fatherId })
      .limit(1)
      .get();
    father = res3.data[0];
  }
  return father ? withClanSurname(father.name) : '';
}

async function getSession() {
  const { openid } = await getOpenId();
  if (!openid) return fail('无法获取微信身份');
  const account = await findAccountByOpenId(openid);
  if (!account) {
    return ok({ verified: false, account: null });
  }

  // 人员库重建后 personId 可能已失效：自动清除陈旧绑定
  if (account.personId) {
    const memberRes = await db.collection(COL_MEMBERS).doc(account.personId).get().catch(() => null);
    if (!memberRes || !memberRes.data) {
      try {
        await db.collection(COL_ACCOUNTS).doc(account._id).remove();
      } catch (e) {
        console.log('remove stale account failed', e.message || e);
      }
      return ok({
        verified: false,
        account: null,
        staleBinding: true,
        message: '原关联成员已不存在，旧绑定已清除，请重新完成身份验证'
      });
    }
  }

  return ok({
    verified: true,
    account: {
      _id: account._id,
      personId: account.personId,
      name: account.name,
      phone: account.phone,
      phoneMasked: maskPhone(account.phone),
      verifyStatus: account.verifyStatus,
      originalId: account.originalId,
      wechatId: account.wechatId || ''
    }
  });
}

/**
 * 清除当前微信的认证绑定，便于人员库重建后重新走验证流程
 */
async function resetMyBinding() {
  const { openid } = await getOpenId();
  if (!openid) return fail('无法获取微信身份');

  const account = await findAccountByOpenId(openid);
  let removedAccount = false;
  let clearedMemberBind = false;

  if (account) {
    // 解除成员上的绑定标记（若有）
    if (account.personId) {
      try {
        await db.collection(COL_MEMBERS).doc(account.personId).update({
          data: {
            boundOpenId: _.remove(),
            boundAccountId: _.remove(),
            boundPhone: _.remove(),
            updatedAt: db.serverDate()
          }
        });
        clearedMemberBind = true;
      } catch (e) {
        // 成员可能已不存在
        console.log('clear member bind skip', e.message || e);
      }
    }
    await db.collection(COL_ACCOUNTS).doc(account._id).remove();
    removedAccount = true;
  }

  // 清理本 openid 下未过期的验证票据（分页）
  let ticketRemoved = 0;
  try {
    for (;;) {
      const { data } = await db.collection(COL_TICKETS)
        .where({ openid })
        .limit(50)
        .get();
      if (!data || !data.length) break;
      await Promise.all(data.map(doc => db.collection(COL_TICKETS).doc(doc._id).remove()));
      ticketRemoved += data.length;
      if (data.length < 50) break;
    }
  } catch (e) {
    console.log('clear tickets skip', e.message || e);
  }

  return ok({
    message: '已清除本微信的认证绑定，请重新验证',
    removedAccount,
    clearedMemberBind,
    ticketRemoved
  });
}

function maskPhone(phone) {
  const p = String(phone || '');
  if (p.length < 7) return p;
  return `${p.slice(0, 3)}****${p.slice(-4)}`;
}

async function verifyName(params) {
  const { openid } = await getOpenId();
  if (!openid) return fail('无法获取微信身份');

  const existing = await findAccountByOpenId(openid);
  if (existing) return fail('该微信已绑定族谱账号', { code: 'ALREADY_BOUND' });

  const name = normalizeFullName(params.name);
  if (name === '') return fail('请输入姓名');
  if (name == null) {
    return fail('请输入含「罗」姓的全名，例如：罗青兰', {
      code: 'NEED_FULL_NAME'
    });
  }

  const res = await db.collection(COL_MEMBERS).where({ name }).limit(100).get();
  const matches = res.data || [];

  if (!matches.length) {
    return fail('未找到您的族谱信息。请确认全名是否正确（须含「罗」姓）。', {
      code: 'NOT_FOUND',
      canAppeal: true
    });
  }

  const ticketId = await saveTicket(null, {
    openid,
    candidatePersonIds: matches.map(m => m._id),
    step: 'name'
  });

  return ok({
    ticketId,
    matchCount: matches.length,
    candidates: matches.map(publicMember),
    needBirthday: true
  });
}

async function verifyBirthday(params) {
  const { openid } = await getOpenId();
  if (!openid) return fail('无法获取微信身份');

  const ticket = await getTicket(params.ticketId, openid);
  if (!ticket) return fail('验证已过期，请重新开始', { code: 'TICKET_EXPIRED' });
  if (ticket.step !== 'name' && ticket.step !== 'birthday') {
    return fail('请按顺序完成验证');
  }

  const year = Number(params.year);
  const month = Number(params.month);
  const day = Number(params.day);
  if (!year || !month || !day) return fail('请选择完整农历出生日期');

  const members = await loadMembersByIds(ticket.candidatePersonIds || []);
  const withoutBirth = members.filter(m => !hasFullLunarBirth(m));
  const matched = members.filter(m => matchLunarBirth(m, year, month, day));

  if (!matched.length) {
    return fail('出生信息验证失败。请重新确认。', {
      code: 'BIRTHDAY_MISMATCH',
      canAppeal: true,
      missingBirthCount: withoutBirth.length
    });
  }

  const ticketId = await saveTicket(params.ticketId, {
    openid,
    candidatePersonIds: matched.map(m => m._id),
    step: 'birthday'
  });

  return ok({
    ticketId,
    matchCount: matched.length,
    candidates: matched.map(publicMember),
    needFather: true
  });
}

async function verifyFather(params) {
  const { openid } = await getOpenId();
  if (!openid) return fail('无法获取微信身份');

  const ticket = await getTicket(params.ticketId, openid);
  if (!ticket) return fail('验证已过期，请重新开始', { code: 'TICKET_EXPIRED' });
  if (ticket.step !== 'birthday' && ticket.step !== 'father') {
    return fail('请先完成出生日期验证');
  }

  const fatherName = normalizeFullName(params.fatherName);
  if (fatherName === '') return fail('请输入父亲姓名');
  if (fatherName == null) {
    return fail('请输入父亲含「罗」姓的全名，例如：罗鼓声', {
      code: 'NEED_FULL_NAME'
    });
  }

  const members = await loadMembersByIds(ticket.candidatePersonIds || []);
  const matched = [];
  for (const m of members) {
    const resolved = await resolveFatherName(m);
    if (resolved === fatherName) matched.push(m);
  }

  if (!matched.length) {
    return fail('父亲信息验证失败。', {
      code: 'FATHER_MISMATCH',
      canAppeal: true
    });
  }

  if (matched.length > 1) {
    return fail('仍有多名同名族人，请选择人工申诉由管理员核实。', {
      code: 'STILL_AMBIGUOUS',
      canAppeal: true,
      matchCount: matched.length
    });
  }

  const person = matched[0];
  const bound = await db.collection(COL_ACCOUNTS)
    .where({ personId: person._id })
    .limit(1)
    .get();
  if (bound.data.length) {
    return fail('该族谱成员已绑定其他账号', { code: 'PERSON_BOUND' });
  }

  const ticketId = await saveTicket(params.ticketId, {
    openid,
    candidatePersonIds: [person._id],
    step: 'ready'
  });

  return ok({
    ticketId,
    person: publicMember(person),
    readyToBind: true
  });
}

async function bindPhone(params) {
  const { openid, unionid } = await getOpenId();
  if (!openid) return fail('无法获取微信身份');

  const existing = await findAccountByOpenId(openid);
  if (existing) {
    return ok({
      alreadyBound: true,
      account: {
        _id: existing._id,
        personId: existing.personId,
        name: existing.name,
        phone: existing.phone,
        phoneMasked: maskPhone(existing.phone),
        verifyStatus: existing.verifyStatus
      }
    });
  }

  const ticket = await getTicket(params.ticketId, openid);
  if (!ticket || ticket.step !== 'ready') {
    return fail('请先完成身份验证', { code: 'NOT_READY' });
  }

  const personId = (ticket.candidatePersonIds || [])[0];
  if (!personId) return fail('候选人无效，请重新验证');

  let phone = '';
  if (params.cloudID) {
    try {
      const phoneRes = await cloud.getPhoneNumber({ cloudID: params.cloudID });
      phone = (phoneRes && phoneRes.phoneInfo && phoneRes.phoneInfo.phoneNumber) || '';
    } catch (err) {
      console.error('getPhoneNumber failed', err);
      return fail('手机号授权失败，请重试');
    }
  } else if (params.phone) {
    // 手填兜底：未开通手机号快速验证 / 用户拒绝授权时使用
    phone = String(params.phone).trim();
  }

  if (!/^1\d{10}$/.test(phone)) {
    return fail('未获取到有效手机号');
  }

  const byPhone = await db.collection(COL_ACCOUNTS).where({ phone }).limit(1).get();
  if (byPhone.data.length) {
    const other = byPhone.data[0];
    const otherMember = other.personId
      ? await db.collection(COL_MEMBERS).doc(other.personId).get().catch(() => null)
      : null;
    if (!otherMember || !otherMember.data) {
      await db.collection(COL_ACCOUNTS).doc(other._id).remove();
    } else {
      return fail('该手机号已绑定其他族谱账号', { code: 'PHONE_BOUND' });
    }
  }

  const byPerson = await db.collection(COL_ACCOUNTS).where({ personId }).limit(1).get();
  if (byPerson.data.length) {
    return fail('该族谱成员已绑定其他账号', { code: 'PERSON_BOUND' });
  }

  const memberRes = await db.collection(COL_MEMBERS).doc(personId).get().catch(() => null);
  const member = memberRes && memberRes.data;
  if (!member) return fail('族谱成员不存在');

  const addRes = await db.collection(COL_ACCOUNTS).add({
    data: {
      personId,
      originalId: member.originalId != null ? member.originalId : null,
      name: member.name,
      phone,
      phoneVerified: true,
      openid,
      unionid: unionid || '',
      verifyStatus: 'verified',
      createTime: db.serverDate()
    }
  });

  await db.collection(COL_TICKETS).doc(params.ticketId).remove().catch(() => {});

  return ok({
    account: {
      _id: addRes._id,
      personId,
      name: member.name,
      phone,
      phoneMasked: maskPhone(phone),
      verifyStatus: 'verified',
      originalId: member.originalId
    }
  });
}

async function submitAppeal(params) {
  const { openid } = await getOpenId();
  const name = String(params.name || '').trim();
  const phone = String(params.phone || '').trim();
  const reason = String(params.reason || '').trim();
  if (!name || !reason) return fail('请填写姓名和申诉理由');

  await db.collection(COL_APPEALS).add({
    data: {
      name,
      phone,
      wechat: String(params.wechat || '').trim(),
      birthHint: String(params.birthHint || '').trim(),
      fatherHint: String(params.fatherHint || '').trim(),
      reason,
      status: 'pending',
      openid: openid || '',
      createTime: db.serverDate()
    }
  });

  return ok({ message: '申诉已提交，管理员将尽快处理' });
}

async function updatePhone(params) {
  const { openid } = await getOpenId();
  if (!openid) return fail('无法获取微信身份');
  const account = await findAccountByOpenId(openid);
  if (!account) return fail('请先完成身份认证');

  let phone = '';
  if (params.cloudID) {
    try {
      const phoneRes = await cloud.getPhoneNumber({ cloudID: params.cloudID });
      phone = (phoneRes && phoneRes.phoneInfo && phoneRes.phoneInfo.phoneNumber) || '';
    } catch (err) {
      return fail('手机号授权失败，请重试');
    }
  } else if (params.phone) {
    phone = String(params.phone).trim();
  }
  if (!/^1\d{10}$/.test(phone)) return fail('未获取到有效手机号');

  const byPhone = await db.collection(COL_ACCOUNTS).where({ phone }).limit(1).get();
  if (byPhone.data.length && byPhone.data[0]._id !== account._id) {
    return fail('该手机号已绑定其他族谱账号', { code: 'PHONE_BOUND' });
  }

  await db.collection(COL_ACCOUNTS).doc(account._id).update({
    data: { phone, phoneVerified: true }
  });
  // 同步到成员资料展示字段
  if (account.personId) {
    await db.collection(COL_MEMBERS).doc(account.personId).update({
      data: { phone, updatedAt: db.serverDate() }
    }).catch(() => {});
  }

  return ok({
    account: {
      _id: account._id,
      personId: account.personId,
      name: account.name,
      phone,
      phoneMasked: maskPhone(phone),
      verifyStatus: account.verifyStatus,
      wechatId: account.wechatId || ''
    }
  });
}

async function updateWechatId(params) {
  const { openid } = await getOpenId();
  if (!openid) return fail('无法获取微信身份');
  const account = await findAccountByOpenId(openid);
  if (!account) return fail('请先完成身份认证');

  const wechatId = String(params.wechatId || params.wechat || '').trim();
  if (!wechatId) return fail('请填写微信号');

  await db.collection(COL_ACCOUNTS).doc(account._id).update({
    data: { wechatId }
  });
  if (account.personId) {
    await db.collection(COL_MEMBERS).doc(account.personId).update({
      data: { wechat: wechatId, updatedAt: db.serverDate() }
    }).catch(() => {});
  }

  return ok({
    account: {
      _id: account._id,
      personId: account.personId,
      name: account.name,
      phone: account.phone,
      phoneMasked: maskPhone(account.phone),
      verifyStatus: account.verifyStatus,
      wechatId
    }
  });
}

async function submitDevMessage(params) {
  const { openid } = await getOpenId();
  const name = String(params.name || '').trim();
  const content = String(params.content || '').trim();
  if (!name || !content) return fail('请填写姓名和留言内容');

  await db.collection('dev_messages').add({
    data: {
      name,
      phone: String(params.phone || '').trim(),
      wechat: String(params.wechat || '').trim(),
      content,
      personId: String(params.personId || '').trim(),
      accountName: String(params.accountName || '').trim(),
      openid: openid || '',
      status: 'pending',
      createTime: db.serverDate()
    }
  });

  return ok({ message: '留言已提交，开发人员将尽快查看处理' });
}

exports.main = async (event) => {
  const action = event.action;
  const data = event.data || event;

  try {
    switch (action) {
      case 'getSession':
        return await getSession();
      case 'resetMyBinding':
        return await resetMyBinding();
      case 'verifyName':
        return await verifyName(data);
      case 'verifyBirthday':
        return await verifyBirthday(data);
      case 'verifyFather':
        return await verifyFather(data);
      case 'bindPhone':
        return await bindPhone(data);
      case 'updatePhone':
        return await updatePhone(data);
      case 'updateWechatId':
        return await updateWechatId(data);
      case 'submitDevMessage':
        return await submitDevMessage(data);
      case 'submitAppeal':
        return await submitAppeal(data);
      default:
        return fail(`未知操作: ${action}`);
    }
  } catch (err) {
    console.error('authApi error', action, err);
    return fail(err.message || '服务器错误');
  }
};
