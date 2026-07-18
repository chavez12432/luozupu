// 族人详细信息数据（从当今族人撷英和人文芳名录提取）
// 格式：memberId -> 详细信息

const memberDetails = {
  // ===== 明儒堂 =====
  '相文': {
    gender: '男',
    education: ['大学（永新师范）', '吉安教育学院', '江西省委党校理论班'],
    positions: [
      { title: '团委书记', organization: '洋门中学', isCurrent: false },
      { title: '副主任科员', organization: '中共吉安地委宣传部', isCurrent: false },
      { title: '主任科员、办公室主任', organization: '中共吉安市委宣传部', isCurrent: false },
      { title: '副调研员（副县级）', organization: '中共江西省委宣传部', isCurrent: true }
    ],
    honors: ['优秀公务员', '优秀共产党员'],
    residence: '江西省南昌市'
  },
  '传芳': {
    gender: '男',
    education: [],
    positions: [
      { title: '二排排长、连党支部委员', organization: '福州军区独立师三营十一连', isCurrent: false },
      { title: '副连长', organization: '福州军区独立师三营十一连', isCurrent: false },
      { title: '连长、党支部书记', organization: '福州军区独立师三营十一连', isCurrent: false },
      { title: '营长、营党支部书记', organization: '福州军区独立二师六团', isCurrent: false },
      { title: '经理、党支部书记', organization: '江西樟树市农业生产资料公司', isCurrent: false }
    ],
    honors: ['五好战士', '多次部队奖励'],
    residence: '江西省樟树市'
  },
  '国才': {
    gender: '男',
    education: ['高洲初小', '上城高小', '安福初中', '永新师范', '在职函授大专'],
    positions: [
      { title: '教师', organization: '上城小学', isCurrent: false },
      { title: '班长', organization: '部队', isCurrent: false },
      { title: '排长', organization: '部队', isCurrent: false },
      { title: '连队政治指导员', organization: '部队', isCurrent: false },
      { title: '秘书、军区首长秘书、军直政治工作处处长（正团级）', organization: '部队', isCurrent: false },
      { title: '党委书记兼校长（正县级）', organization: '江西省轻工业厅直属技工学校', isCurrent: false }
    ],
    honors: ['优秀教师', '多次部队嘉奖'],
    residence: '江西省南昌市'
  },
  '德才': {
    gender: '男',
    education: ['永新师范', '江西大学中文系（自学考试大专）', '中央党校函授法律系（大学）'],
    positions: [
      { title: '教师', organization: '洋门乡上街小学', isCurrent: false },
      { title: '教师', organization: '洋门中学', isCurrent: false },
      { title: '教师', organization: '彭坊中学', isCurrent: false },
      { title: '工会主席', organization: '洋门中学', isCurrent: false },
      { title: '政教处主任', organization: '洋门中学', isCurrent: false },
      { title: '科员', organization: '中共安福县委组织部', isCurrent: false },
      { title: '副科级组织员', organization: '中共安福县委组织部', isCurrent: false },
      { title: '组织部副部长兼农村基层组织建设办公室主任', organization: '中共安福县委组织部', isCurrent: false },
      { title: '县直机关工委副书记', organization: '中共安福县委', isCurrent: false },
      { title: '镇党委书记、人大主席', organization: '洲湖镇', isCurrent: true }
    ],
    honors: ['中共安福县委委员', '中国共产党江西省第十二次代表大会代表'],
    residence: '江西省安福县'
  },
  '庆良': {
    gender: '男',
    education: ['高洲初级小学', '上城小学', '安福初级中学', '吉安师范', '深圳大学行政管理（自学）'],
    positions: [
      { title: '教导主任', organization: '吉安市禾埠小学', isCurrent: false },
      { title: '校革命委员会副主任', organization: '禾埠共产主义劳动大学', isCurrent: false },
      { title: '校长', organization: '禾埠中学', isCurrent: false },
      { title: '辅导区主任', organization: '禾埠辅导区', isCurrent: false },
      { title: '主办干事、组织员办公室主任、组织部副部长', organization: '中共吉安市委组织部', isCurrent: false },
      { title: '县委常委、组织部部长', organization: '中共峡江县委', isCurrent: false },
      { title: '副县级调研员', organization: '吉安市', isCurrent: false }
    ],
    honors: ['吉安市先进工作者', '吉安市教育系统标兵', '吉安市优秀党员', '吉安市优秀党务工作者', '江西省优秀党务工作者', '《江西党建》优秀通讯员'],
    residence: '江西省吉安市'
  },
  '志坚': {
    gender: '男',
    education: ['吉安二中', '江西工学院无线电专业（工学学士）', '澳大利亚堪培拉大学MBA（硕士）'],
    positions: [
      { title: '微波站筹建', organization: '吉安地区邮电局', isCurrent: false },
      { title: '运维部副主任（主持工作）', organization: '吉安地区邮电局', isCurrent: false },
      { title: '电信局局长', organization: '峡江县', isCurrent: false },
      { title: '党委委员、市场部主任', organization: '吉安地区移动通信公司', isCurrent: false },
      { title: '副总经理（主持工作）', organization: '中国联通吉安分公司', isCurrent: false },
      { title: '总经理', organization: '中国联通吉安分公司', isCurrent: false },
      { title: '总经理', organization: '中国联通赣州分公司', isCurrent: true }
    ],
    honors: ['全区优秀共青团员', '长途来话接通率竞赛优秀个人', '优秀共产党员', '创新成果优秀奖', '江西省用户满意活动卓越领导者', '合理化建议先进个人', '赣州市第十三届十大杰出青年', '赣州市五一劳动奖章'],
    residence: '江西省赣州市'
  },
  '冬香': {
    gender: '男',
    education: ['中专'],
    positions: [
      { title: '教师', organization: '安福县城关中学', isCurrent: true }
    ],
    residence: '江西省安福县'
  },
  '建新': {
    gender: '男',
    education: ['大学'],
    positions: [
      { title: '副总经理', organization: '深圳博民科技有限公司', isCurrent: true }
    ],
    residence: '广东省深圳市'
  },
  '娇云': {
    gender: '女',
    education: ['大学'],
    positions: [
      { title: '中学一级教师', organization: '安福县城关中学', isCurrent: true }
    ],
    residence: '江西省安福县'
  },
  '阳先': {
    gender: '男',
    education: ['本科'],
    positions: [
      { title: '员工', organization: '广东海大集团', isCurrent: true }
    ],
    residence: '广东省'
  },
  '顶飞': {
    gender: '男',
    education: ['硕士'],
    positions: [
      { title: '研究生', organization: '北京科技大学', isCurrent: true }
    ],
    residence: '北京市'
  },
  '强飞': {
    gender: '男',
    education: ['大学'],
    positions: [
      { title: '教师', organization: '江西师范大学', isCurrent: true }
    ],
    residence: '江西省南昌市'
  },
  '少林': {
    gender: '男',
    education: ['大专'],
    positions: [
      { title: '职员', organization: '安福县交通局运管所', isCurrent: true }
    ],
    residence: '江西省安福县'
  },
  '聪': {
    gender: '男',
    education: ['大专'],
    positions: [
      { title: '职员', organization: '昆明石屏县烟草公司', isCurrent: true }
    ],
    residence: '云南省昆明市'
  },
  '毅': {
    gender: '男',
    education: ['大专'],
    positions: [
      { title: '警官', organization: '高安市公安局', isCurrent: true }
    ],
    residence: '江西省高安市'
  },
  '群': {
    gender: '女',
    education: ['大专'],
    positions: [
      { title: '业务员', organization: '深圳房地产公司', isCurrent: true }
    ],
    residence: '广东省深圳市'
  },
  '双群': {
    gender: '女',
    education: ['大专'],
    positions: [
      { title: '员工', organization: '深圳中日合资企业', isCurrent: true }
    ],
    residence: '广东省深圳市'
  },
  '艳群': {
    gender: '女',
    education: ['大专'],
    positions: [
      { title: '员工', organization: '深圳中日合资企业', isCurrent: true }
    ],
    residence: '广东省深圳市'
  },
  '明华': {
    gender: '男',
    education: ['大专'],
    positions: [
      { title: '员工', organization: '深圳', isCurrent: true }
    ],
    residence: '广东省深圳市'
  },
  '夏弦': {
    gender: '男',
    education: ['大专'],
    positions: [],
    residence: ''
  },
  '荣': {
    gender: '男',
    education: ['大专'],
    positions: [
      { title: '员工', organization: '深圳', isCurrent: true }
    ],
    residence: '广东省深圳市'
  },
  
  // ===== 德裕堂 =====
  '池美': {
    gender: '男',
    education: ['大专'],
    positions: [
      { title: '主治医师、院长', organization: '原陈山谷源山林场职工医院', isCurrent: false }
    ],
    honors: [],
    residence: '江西省'
  },
  '现才': {
    gender: '男',
    education: ['大学'],
    positions: [
      { title: '所长', organization: '钱山派出所', isCurrent: true }
    ],
    residence: '江西省安福县'
  },
  '京华': {
    gender: '女',
    education: ['大学'],
    positions: [
      { title: '中级技师、经营级干部', organization: '北京海军机关', isCurrent: true }
    ],
    residence: '北京市'
  },
  '京丽': {
    gender: '女',
    education: ['大学'],
    positions: [
      { title: '中级讲师', organization: '江西省轻工技校', isCurrent: true }
    ],
    residence: '江西省'
  },
  '志兵': {
    gender: '男',
    education: ['大学'],
    positions: [
      { title: '副调研员', organization: '吉安市委机关办公室', isCurrent: true }
    ],
    residence: '江西省吉安市'
  },
  '志青': {
    gender: '女',
    education: ['函大'],
    positions: [
      { title: '助理会计师', organization: '吉州区安全生产监督局', isCurrent: true }
    ],
    residence: '江西省吉安市'
  },
  '志芳': {
    gender: '女',
    education: ['学士'],
    positions: [
      { title: '会计师、公务员', organization: '吉安市财政局', isCurrent: true }
    ],
    residence: '江西省吉安市'
  },
  '凤英': {
    gender: '女',
    education: ['中专'],
    positions: [
      { title: '主任科员', organization: '原吉州区工商局', isCurrent: false }
    ],
    residence: '江西省吉安市'
  },
  '志萍': {
    gender: '女',
    education: ['大专'],
    positions: [],
    residence: ''
  },
  '胜良': {
    gender: '男',
    education: ['大学'],
    positions: [
      { title: '员工', organization: '深圳富士康集团', isCurrent: true }
    ],
    residence: '广东省深圳市'
  },
  '玲': {
    gender: '女',
    education: ['大专'],
    positions: [
      { title: '教师', organization: '金田中心小学', isCurrent: true }
    ],
    residence: '江西省'
  },
  '微': {
    gender: '女',
    education: ['大专'],
    positions: [
      { title: '员工', organization: '深圳', isCurrent: true }
    ],
    residence: '广东省深圳市'
  },
  '钟良': {
    gender: '男',
    education: [],
    positions: [
      { title: '学生', organization: '北京地质学院', isCurrent: true }
    ],
    residence: '北京市'
  },
  '志丽': {
    gender: '女',
    education: [],
    positions: [
      { title: '学生', organization: '井冈山大学', isCurrent: true }
    ],
    residence: '江西省'
  },
  '吴首': {
    gender: '男',
    education: [],
    positions: [
      { title: '留学生', organization: '澳大利亚新兰威尔士大学', isCurrent: true }
    ],
    residence: '澳大利亚'
  },
  '储才': {
    gender: '男',
    education: ['函大'],
    positions: [],
    residence: ''
  },
  '晓燕': {
    gender: '女',
    education: ['中专'],
    positions: [
      { title: '员工', organization: '鹰潭市供电公司', isCurrent: true }
    ],
    residence: '江西省鹰潭市'
  },
  '晓红': {
    gender: '女',
    education: ['中专'],
    positions: [],
    residence: ''
  },
  
  // ===== 忠爱堂 =====
  '建明': {
    gender: '男',
    education: ['大学'],
    positions: [
      { title: '教师', organization: '广州大学', isCurrent: true }
    ],
    residence: '广东省广州市'
  },
  '青': {
    gender: '男',
    education: ['函大'],
    positions: [
      { title: '员工', organization: '樟树市农资公司', isCurrent: true }
    ],
    residence: '江西省樟树市'
  },
  '莉': {
    gender: '女',
    education: ['函大'],
    positions: [
      { title: '员工', organization: '樟树市农资公司', isCurrent: true }
    ],
    residence: '江西省樟树市'
  },
  '慧兰': {
    gender: '女',
    education: ['大学'],
    positions: [
      { title: '员工', organization: '南昌铁路局', isCurrent: true }
    ],
    residence: '江西省南昌市'
  },
  '林': {
    gender: '男',
    education: ['中师'],
    positions: [
      { title: '军人', organization: '部队', isCurrent: true }
    ],
    honors: ['现役军人'],
    residence: ''
  },
  '飞': {
    gender: '女',
    education: [],
    positions: [
      { title: '学生', organization: '西安', isCurrent: true }
    ],
    residence: '陕西省西安市'
  },
  '琴': {
    gender: '女',
    education: [],
    positions: [
      { title: '学生', organization: '省财经大学', isCurrent: true }
    ],
    residence: '江西省'
  },
  '娟': {
    gender: '女',
    education: ['中专'],
    positions: [],
    residence: ''
  },
  '娟娟': {
    gender: '女',
    education: [],
    positions: [
      { title: '学生', organization: '西安长安大学', isCurrent: true }
    ],
    residence: '陕西省西安市'
  }
};

// 导出数据
module.exports = memberDetails;
