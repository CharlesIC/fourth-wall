(function () {
  "use strict";
  window.FourthWall = window.FourthWall || {};

  FourthWall.getQueryVariables = function () {
    FourthWall.queryVariables = FourthWall.queryVariables || FourthWall.parseQueryVariables();
    return FourthWall.queryVariables;
  };

  FourthWall.getQueryVariable = function (name) {
    return FourthWall.getQueryVariables()[name];
  };

  FourthWall._getLocationSearch = function () {
    return window.location.search;
  };

  FourthWall.buildQueryString = function (params) {
    let param_string = $.param(params);
    if (param_string.length > 0) {
      param_string = "?" + param_string;
    }
    return param_string;
  };

  FourthWall.getToken = function (hostname) {
    let token = FourthWall.getQueryVariable(hostname + '_token');
    if (token === undefined && hostname === 'api.github.com') {
      token = FourthWall.getQueryVariable('token');
    }
    return token;
  };

  FourthWall.getTokenFromUrl = function (url) {
    let a = document.createElement('a');
    a.href = url;
    return FourthWall.getToken(a.hostname);
  };

  FourthWall.hasTeams = function () {
    return FourthWall.getTeams().length > 0;
  };

  FourthWall.getTeams = function () {
    let params = FourthWall.getQueryVariables();
    let teams = [];
    Object.keys(params).filter(function (key) {
      let match = key.match(/team$/);
      return match && match[0] === 'team';
    }).forEach(function (key) {
      let hostname = key.match(/^(.*?)_?team$/)[1];
      if (hostname === "") {
        hostname = "api.github.com";
      }
      let teamStrings = params[key];
      if (!(teamStrings instanceof Array)) {
        teamStrings = [teamStrings];
      }
      teamStrings.forEach(function (teamStr) {
        let fullTeamName = teamStr.split('/');
        if (fullTeamName.length !== 2) {
          throw "Team name must contain a slash {org}/{team}";
        }
        teams.push({
          org: fullTeamName[0],
          team: fullTeamName[1],
          hostname: hostname,
          baseUrl: getBaseUrlFromHostname(hostname),
        });
      });
    });
    return teams;
  };

  function getBaseUrlFromHostname(hostname) {
    if (hostname === "api.github.com") {
      return "https://api.github.com";
    } else {
      return "https://" + hostname + "/api/v3";
    }
  }

  FourthWall.parseQueryVariables = function () {
    let search = FourthWall._getLocationSearch();
    return search
      .replace(/(^\?)/, '')
      .replace(/\/$/, '')
      .split("&")
      .reduce(function (params, n) {
        n = n.split("=");
        let arrayKey = /^(.*)\[\]$/.exec(n[0]);
        if (arrayKey) {
          if (params[arrayKey[1]] instanceof Array) {
            params[arrayKey[1]].push(n[1]);
          } else {
            params[arrayKey[1]] = [n[1]];
          }
        } else {
          params[n[0]] = n[1];
        }
        return params;
      }, {});
  };

  FourthWall.fetchDefer = function (options) {
    let d = $.Deferred();
    $.ajax({
      type: "GET",
      beforeSend: setupAuthentication(options.url),
      url: options.url,
      data: options.data
    }).done(function (result) {
      d.resolve(options.done(result));
    }).fail(function (result) {
      console.log(`Failed call to ${options.url} (${result.status})`);
      console.log(result.responseText);
      FourthWall.checkRateLimit(result);
      d.reject();
    });

    return d.promise();
  };

  FourthWall.checkRateLimit = function (result) {
    if (!result.hasOwnProperty('getResponseHeader')) return;
    let rateLimit = result.getResponseHeader('x-ratelimit-limit');
    let rateLimitRemaining = result.getResponseHeader('x-ratelimit-remaining');
    let rateLimitReset = parseInt(result.getResponseHeader('x-ratelimit-reset'));
    let rateLimitResetDate = rateLimitReset ? new Date(rateLimitReset * 1000) : null;
    let rateLimitResetMins = rateLimitResetDate ? Math.floor((rateLimitResetDate - new Date()) / 1000 / 60) : null;
    if (rateLimitRemaining === '0') console.log('Exceeded rate limit.');
    if (rateLimit && rateLimitRemaining && rateLimitReset) {
      console.log(`${rateLimitRemaining} of ${rateLimit} requests remaining. Limit reset in ${rateLimitResetMins} mins (at ${rateLimitResetDate})`);
    }
  };

  FourthWall.overrideFetch = function (url) {
    return Backbone.Model.prototype.fetch.apply(this, [{
      beforeSend: setupAuthentication(url)
    }]);
  };

  let setupAuthentication = function (baseUrl) {
    return function (xhr) {
      let token = FourthWall.getTokenFromUrl(baseUrl);
      if (token !== false && token !== '') {
        xhr.setRequestHeader('Authorization', 'token ' + token);
        xhr.setRequestHeader('Accept', 'application/vnd.github.black-cat-preview+json');
      }
    };
  };

  FourthWall.checkOptionEnabled = function (name, defaultValue) {
    let value = FourthWall.getQueryVariable(name);
    return value ? value === 'true' : defaultValue;
  };

  FourthWall.isUserImportant = function (login) {
    return !FourthWall.filterUsers || !FourthWall.importantUsers.length || FourthWall.importantUsers.includes(login);
  };

  FourthWall.isPullWip = function (pull) {
    return FourthWall.wipStrings.some(s => pull.get('title').toUpperCase().includes(s.toUpperCase()));
  };

  FourthWall.shouldDisplayPull = function (pull, isRepoImportant) {
    return isRepoImportant || FourthWall.isUserImportant(pull.user.login);
  };

  FourthWall.filterUsers = FourthWall.checkOptionEnabled('filterusers', true);
  FourthWall.sortPullsByMostRecent = FourthWall.checkOptionEnabled('recent', true);
  FourthWall.gistId = FourthWall.getQueryVariable('gist');
  FourthWall.fileUrl = FourthWall.getQueryVariable('file');
  FourthWall.wipHandling = (FourthWall.getQueryVariable('wiphandling') || 'small');

  //to deal with fact that query var could be string or array,
  // put query var in array and then flatten it all out
  FourthWall.filterRepos = [FourthWall.getQueryVariable('filterrepo') || []].flat();

  FourthWall.importantUsers = [];
  FourthWall.wipStrings = ['WIP', 'DO NOT MERGE', 'REVIEW ONLY'];
})();
