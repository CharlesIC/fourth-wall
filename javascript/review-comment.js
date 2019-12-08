(function () {
  "use strict";
  window.FourthWall = window.FourthWall || {};

  FourthWall.ReviewComment = Backbone.Model.extend({
    parse: function (response) {
      let numComments = response.length;
      let statuses = this.getStatus(response);

      statuses.numComments = numComments;
      return statuses;
    },

    fetch: function () {
      return FourthWall.overrideFetch.call(this, this.url);
    },

    getStatus: function (comments) {
      let numApprovals = comments.filter(c => c.state === 'APPROVED').length;
      let numChangesRequested = comments.filter(c => c.state === 'CHANGES_REQUESTED').length;
      return {numApprovals: numApprovals, numChangesRequested: numChangesRequested}
    }
  });
}());
