Component({
  properties: {
    name: { type: String, value: '' },
    generation: { type: Number, value: 0 },
    active: { type: Boolean, value: false }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap');
    }
  }
});
