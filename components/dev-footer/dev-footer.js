Component({
  properties: {
    compact: {
      type: Boolean,
      value: false
    }
  },
  methods: {
    goLeaveMessage() {
      wx.navigateTo({ url: '/pages/message/leave' });
    }
  }
});
