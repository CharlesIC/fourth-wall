(function () {
  "use strict";
  window.FourthWall = window.FourthWall || {};


  FourthWall.PullView = Backbone.View.extend({
    tagName: 'li',

    initialize: function () {
      this.model.on('change', this.render, this);
    },

    render: function () {
      this.$el.removeClass();

      if (!this.model.get('user')) {
        // FIXME: Should never get here but does after master was
        // failing
        return;
      }

      this.$el.addClass(this.ageClass(this.model.get('elapsed_time')));

      if (!FourthWall.isUserImportant(this.model.get('user').login)) {
        this.$el.addClass('unimportant-user');
      }

      if (!this.model.collection.important) {
        this.$el.addClass('unimportant-repo');
      }

      if (FourthWall.isPullWip(this.model)) {
        switch (FourthWall.wipHandling) {
          case 'small':
            this.$el.addClass("wip");
            break;
          case 'hide':
            this.$el.hide();
            break;
        }
      }

      let state = this.model.status.get('state');

      let statusString =
        this.model.info.get('mergeable') === false ? '<p class="status not-mergeable">No auto merge</p>' :
          state ? `<p class="status ${state}">Status: ${state}</p>` :
            '<p class="status">No status</p>';

      let assignee = "";
      if (this.model.get('assignee')) {
        assignee = ` under review by ${this.model.get('assignee').login}`;
        this.$el.addClass("under-review");
      }

      this.$el.html([
        `<img class="avatar" src="${this.model.get('user').avatar_url}" />`,
        statusString,
        `<h2 class="repo-name">${this.model.get('repo')}</h2>`,
        `<div class="elapsed-time" data-created-at="${this.model.get('created_at')}">`,
        this.secondsToTime(this.model.get('elapsed_time')),
        '</div>',
        `<p class="pr-url"><a href="${this.model.get('html_url')}">`,
        `<span class="username">${this.model.get('user').login}</span>: `,
        `${this.escape(this.model.get('title'))} (#${this.model.get('number')})`,
        `</a>${assignee}</p>`,
        `<p class="reviews">${this.reviews()}</p>`
      ].join(''));
    },

    escape: function (string) {
      return $('<div>').text(string).html();
    },

    ageClass: function (seconds) {
      let hours = 3600;
      if (seconds > (6 * hours)) {
        return "age-old";
      } else if (seconds > (2 * hours)) {
        return "age-aging";
      } else {
        return "age-fresh";
      }
    },

    reviews: function () {
      let numApprovals = this.model.reviewComment.get('numApprovals') || 0;
      let numChangesRequested = this.model.reviewComment.get('numChangesRequested') || 0;
      let numComments = this.model.comment.get('numComments') || 0 + this.model.reviewComment.get('numComments') || 0;

      return `${numComments ? `<span class="review-marker">&#x1F4AC;${numComments}</span>` : ''}` +
        `${numApprovals ? `<span class="review-marker">&#x2705;${numApprovals}</span>` : ''}` +
        `${numChangesRequested ? `<span class="review-marker">&#x274C;${numChangesRequested}</span>` : ''}`;
    },

    secondsToTime: function (seconds) {
      let days = Math.floor(seconds / 86400);
      let hours = Math.floor((seconds - (days * 86400)) / 3600);
      let minutes = Math.floor((seconds - (days * 86400) - (hours * 3600)) / 60);

      hours = `${hours < 10 ? '0' : ''}${hours}`;
      minutes = `${minutes < 10 ? '0' : ''}${minutes}`;
      days = days > 0 ? `${days}d` : '';

      return `${days} ${hours}h ${minutes}m`;
    }
  });
}());
