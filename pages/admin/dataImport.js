// 管理员数据导入页面
const app = getApp();
const authGuard = require('../../utils/authGuard');

Page({
  data: {
    importing: false,
    progress: 0,
    status: '',
    imported: 0,
    total: 0,
    errors: []
  },

  onShow() {
    authGuard.requireAuth({ replace: true });
  },

  // 选择文件并导入
  chooseFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (res) => {
        const filePath = res.tempFiles[0].path;
        this.readAndImport(filePath);
      }
    });
  },

  // 读取并导入数据
  readAndImport(filePath) {
    const fs = wx.getFileSystemManager();
    
    fs.readFile({
      filePath: filePath,
      encoding: 'utf8',
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          this.startImport(data);
        } catch (e) {
          wx.showToast({
            title: 'JSON解析失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '读取文件失败',
          icon: 'none'
        });
      }
    });
  },

  // 开始导入
  async startImport(personsData) {
    if (!personsData || !personsData.rows) {
      wx.showToast({
        title: '数据格式错误',
        icon: 'none'
      });
      return;
    }

    // 转换数据
    const convertedData = this.convertData(personsData);
    
    this.setData({
      importing: true,
      progress: 0,
      status: '导入中...',
      imported: 0,
      total: convertedData.length,
      errors: []
    });

    try {
      // 分批导入，每批50条（避免超时）
      const batchSize = 50;
      let imported = 0;
      const errors = [];
      let currentIndex = 0;

      while (currentIndex < convertedData.length) {
        try {
          const result = await wx.cloud.callFunction({
            name: 'batchImportMembers',
            data: {
              members: convertedData,
              startIndex: currentIndex,
              batchSize: batchSize
            }
          });

          if (result.result) {
            imported += result.result.imported || 0;
            if (result.result.errors && result.result.errors.length > 0) {
              errors.push(...result.result.errors);
            }
            
            // 更新当前索引
            currentIndex = result.result.processed || (currentIndex + batchSize);
            
            // 更新进度
            const progress = Math.round((currentIndex / convertedData.length) * 100);
            this.setData({
              progress: progress,
              imported: imported,
              status: `已导入 ${currentIndex} / ${convertedData.length} 条...`
            });

            // 如果还有数据，继续下一批
            if (!result.result.hasMore) {
              break;
            }
          } else {
            throw new Error('云函数返回结果为空');
          }
        } catch (err) {
          console.error(`索引 ${currentIndex} 导入失败:`, err);
          errors.push({ 
            index: currentIndex, 
            error: err.message || '导入失败' 
          });
          // 跳过失败的批次，继续下一批
          currentIndex += batchSize;
        }
      }

      this.setData({
        importing: false,
        progress: 100,
        status: errors.length === 0 ? '导入成功' : `导入完成，失败${errors.length}条`,
        errors: errors
      });

      wx.showToast({
        title: `成功导入${imported}条`,
        icon: 'success'
      });

    } catch (err) {
      console.error('导入失败:', err);
      this.setData({
        importing: false,
        status: '导入失败: ' + err.message
      });
      wx.showToast({
        title: '导入失败',
        icon: 'none'
      });
    }
  },

  // 转换数据格式
  convertData(personsData) {
    const rows = personsData.rows;
    const members = [];

    for (const row of rows) {
      try {
        const member = {
          memberId: `M${String(row[0]).padStart(6, '0')}`,
          originalId: row[0],
          name: row[2],
          generation: row[14] || 1,
          branch: this.convertBranch(row[13]),
          gender: this.convertGender(row[3]),
          birthDate: this.buildDateObject(row[4]),
          deathDate: this.buildDateObject(row[5]),
          lifespan: this.calculateLifespan(row[4], row[5]),
          fatherId: row[19] || '',
          motherId: row[20] || '',
          birthplace: row[6] || '',
          residence: row[7] || '',
          phone: row[22] || '',
          education: this.parseEducation(row[9]),
          positions: this.parseOccupation(row[8]),
          honors: this.parseAchievements(row[11]),
          avatar: row[12] || '',
          photoGallery: row[12] ? [row[12]] : [],
          remark: row[10] || '',
          hasBrokenLineage: false,
          brokenLineageNote: ''
        };

        members.push(member);
      } catch (e) {
        console.error('转换数据失败:', e, row);
      }
    }

    return members;
  },

  // 转换分堂名称
  convertBranch(branchName) {
    if (!branchName) return '中和堂';
    const map = {
      '中和堂': '中和堂',
      '明儒堂': '明儒堂',
      '德裕堂': '德裕堂',
      '忠爱堂': '忠爱堂',
      '忠受堂': '忠爱堂'
    };
    return map[branchName] || branchName;
  },

  // 转换性别
  convertGender(gender) {
    if (!gender) return '男';
    const map = {
      'male': '男',
      'female': '女',
      '男': '男',
      '女': '女'
    };
    return map[gender.toLowerCase()] || '男';
  },

  // 构建日期对象
  buildDateObject(dateStr) {
    if (!dateStr || dateStr === 'null') {
      return {
        lunar: { year: null, month: null, day: null, isLeap: false },
        gregorian: { year: null, month: null, day: null },
        ganzhi: '',
        zodiac: '',
        dynasty: '',
        eraName: '',
        eraYear: null,
        converted: false
      };
    }

    const parts = dateStr.split('-');
    if (parts.length !== 3) {
      return {
        lunar: { year: null, month: null, day: null, isLeap: false },
        gregorian: { year: null, month: null, day: null },
        ganzhi: '',
        zodiac: '',
        dynasty: '',
        eraName: '',
        eraYear: null,
        converted: false
      };
    }

    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);

    return {
      lunar: { year, month, day, isLeap: false },
      gregorian: { year, month, day },
      ganzhi: this.calculateGanzhi(year),
      zodiac: this.calculateZodiac(year),
      dynasty: this.getDynasty(year),
      eraName: '',
      eraYear: null,
      converted: true
    };
  },

  // 计算干支
  calculateGanzhi(year) {
    const tiangan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    const dizhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const ganIndex = (year - 4) % 10;
    const zhiIndex = (year - 4) % 12;
    return tiangan[ganIndex] + dizhi[zhiIndex] + '年';
  },

  // 计算生肖
  calculateZodiac(year) {
    const zodiacAnimals = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
    const zhiIndex = (year - 4) % 12;
    return zodiacAnimals[zhiIndex];
  },

  // 获取朝代
  getDynasty(year) {
    if (year >= 1949) return '中华人民共和国';
    if (year >= 1912) return '民国';
    if (year >= 1644) return '清';
    if (year >= 1368) return '明';
    if (year >= 1271) return '元';
    if (year >= 960) return '宋';
    return '未知';
  },

  // 计算寿命
  calculateLifespan(birthDate, deathDate) {
    if (!birthDate || !deathDate || deathDate === 'null') return null;
    
    const birthYear = parseInt(birthDate.split('-')[0]);
    const deathYear = parseInt(deathDate.split('-')[0]);
    
    if (birthYear && deathYear) {
      return deathYear - birthYear;
    }
    return null;
  },

  // 解析学历
  parseEducation(eduStr) {
    if (!eduStr) return [];
    const education = [];
    const degreeKeywords = ['博士', '硕士', '本科', '大专', '中专', '高中', '初中', '小学', '进士', '举人', '秀才'];
    
    for (const degree of degreeKeywords) {
      if (eduStr.includes(degree)) {
        education.push({
          degree: degree,
          school: '',
          major: '',
          year: null,
          isDefault: education.length === 0
        });
      }
    }
    return education;
  },

  // 解析职位
  parseOccupation(occStr) {
    if (!occStr) return [];
    const positions = [];
    const parts = occStr.split(/[;；\n]/);
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) {
        positions.push({
          title: trimmed,
          organization: '',
          level: '',
          isCurrent: false,
          isDefault: positions.length === 0
        });
      }
    }
    return positions;
  },

  // 解析成就
  parseAchievements(achStr) {
    if (!achStr) return [];
    const honors = [];
    const honorKeywords = ['荣誉称号', '勋章', '军人', '烈士', '表彰'];
    
    for (const keyword of honorKeywords) {
      if (achStr.includes(keyword)) {
        honors.push({
          type: keyword,
          title: achStr.substring(0, 50),
          level: '',
          year: null,
          description: achStr
        });
        break;
      }
    }
    return honors;
  },

  // 清空数据库
  async clearDatabase() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有族人数据吗？此操作不可恢复！',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '清空中...' });
            
            const db = wx.cloud.database();
            const { data } = await db.collection('members').get();
            
            for (const doc of data) {
              await db.collection('members').doc(doc._id).remove();
            }
            
            wx.hideLoading();
            wx.showToast({
              title: '清空完成',
              icon: 'success'
            });
          } catch (err) {
            wx.hideLoading();
            wx.showToast({
              title: '清空失败',
              icon: 'none'
            });
          }
        }
      }
    });
  }
});
