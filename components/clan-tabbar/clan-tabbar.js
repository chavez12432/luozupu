const nav = require('../../utils/nav');

Component({
  properties: {
    active: {
      type: String,
      value: 'clan' // clan | preface | honor | tree | me
    }
  },
  methods: {
    onTap(e) {
      const key = e.currentTarget.dataset.key;
      if (key === this.data.active) return;
      if (key === 'clan') nav.goToIndex();
      else if (key === 'preface') nav.goToPreface();
      else if (key === 'honor') nav.goToHonor();
      else if (key === 'tree') nav.goToHall();
      else if (key === 'me') nav.goToMe();
    }
  }
});
