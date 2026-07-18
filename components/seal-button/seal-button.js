Component({
  properties: {
    text: { type: String, value: '确定' },
    type: { type: String, value: 'primary' },
    disabled: { type: Boolean, value: false }
  },
  methods: {
    onTap() {
      if (this.data.disabled) return;
      this.triggerEvent('click');
    }
  }
});
