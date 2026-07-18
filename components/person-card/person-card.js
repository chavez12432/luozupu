Component({
  properties: {
    member: { type: Object, value: {} }
  },
  methods: {
    onTap() {
      this.triggerEvent('select', { id: this.data.member._id });
    }
  }
});
