const { displayNameChar } = require('../../utils/nameInitial');

function nameInitialFromMember(m) {
  if (!m) return '';
  if (m.displayInitial) return String(m.displayInitial);
  return displayNameChar(m.name, {
    generation: m.generation,
    branch: m.branch
  });
}

Component({
  properties: {
    member: { type: Object, value: {} }
  },
  data: {
    initial: ''
  },
  observers: {
    member(m) {
      this.setData({ initial: nameInitialFromMember(m) });
    }
  },
  lifetimes: {
    attached() {
      this.setData({ initial: nameInitialFromMember(this.data.member) });
    }
  },
  methods: {
    onTap() {
      this.triggerEvent('select', { id: this.data.member._id });
    }
  }
});
