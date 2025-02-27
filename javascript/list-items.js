(function () {
  "use strict";
  window.FourthWall = window.FourthWall || {};

  FourthWall.ListItems = Backbone.Collection.extend({

    initialize: function (models, options) {
      this.repos = options.repos;
      this.repos.on('change', function () {
        this.fetch();
      }, this);
    },

    isMaster: function (x) {
      return x instanceof FourthWall.MasterStatus;
    },

    compare: function (f, a, b) {
      if (f(a) && f(b)) {
        return 0;
      } else if (f(a)) {
        return -1;
      } else if (f(b)) {
        return 1;
      }
    },

    cmp: function (a, b) {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      if (a > b) return -1;
      if (b > a) return 1;
      return 0;
    },

    comparator: function (a, b) {

      let res = this.compare(this.isMaster, a, b);
      if (res != null) {
        return res;
      }

      let timeA = a.get('elapsed_time'),
        timeB = b.get('elapsed_time');

      if (FourthWall.sortPullsByMostRecent) {
        return this.cmp(timeB, timeA);
      } else {
        return this.cmp(timeA, timeB);
      }
    },

    fetch: function () {
      let models = [];
      this.repos.forEach(repo => {
        repo.pulls.forEach(pull => {
          models.push(pull)
        }, this);
        if (repo.master.get('failed')) {
          models.push(repo.master);
        }
      }, this);
      this.reset(models);
    }
  });
}());
