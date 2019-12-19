(function () {
  "use strict";
  window.FourthWall = window.FourthWall || {};

  FourthWall.FetchRepos = {};

  FourthWall.FetchRepos.fetchFromEverywhere = function () {
    let promises = [];

    if (FourthWall.fileUrl) {
      promises.push(fetchReposFromFileUrl());
    }

    if (FourthWall.gistId) {
      promises.push(fetchReposFromGist());
    }

    if (FourthWall.hasTeams()) {
      promises.push(fetchReposFromTeams());
    }

    let d = $.Deferred();
    $.when.apply(null, promises).done(function (results) {
      let allRepos = FourthWall.FetchRepos.getUniqueRepos(results)
        .filter(r => !FourthWall.filterRepos.includes(r.repo));
      d.resolve(allRepos);
    });
    return d;
  };

  FourthWall.FetchRepos.getUniqueRepos = function (repos) {
    return Object.values(repos
      .map(r => ({hash: createRepoHash(r), value: r}))
      .reduce((uniqueRepos, repo) => {
        if (repo.hash in uniqueRepos) {
          let important = uniqueRepos[repo.hash].important || repo.value.important;
          let baseUrl = uniqueRepos[repo.hash].baseUrl || repo.value.baseUrl;
          if (important !== undefined) uniqueRepos[repo.hash].important = important;
          if (baseUrl) uniqueRepos[repo.hash].baseUrl = baseUrl;
        } else {
          uniqueRepos[repo.hash] = repo.value;
        }
        return uniqueRepos
      }, {}));
  };

  let createRepoHash = function (repo) {
    return JSON.stringify({
      userName: repo.userName,
      repo: repo.repo,
      baseUrl: repo.baseUrl || FourthWall.gitHubReposBaseUrl
    });
  };

  let fetchReposFromFileUrl = function () {
    // e.g. https://api.github.com/repos/roc/deploy-lag-radiator/contents/repos/performance-platform.json?ref=gh-pages
    return FourthWall.fetchDefer({
      url: FourthWall.fileUrl,
      done: function (result) {
        let repos = [];
        if (result.content) {
          repos = JSON.parse(
            atob(result.content)
          ).map(function (item) {
            // map to ensure gist style keys present
            // we extend the item to ensure any provided baseUrls are kept
            return $.extend(item, {
              'userName': item.owner || item.userName,
              'repo': item.name || item.repo
            });
          });
        }
        return repos;
      }
    });
  };

  let fetchReposFromGist = function () {
    return FourthWall.fetchDefer({
      url: "https://api.github.com/gists/" + FourthWall.gistId,
      done: function (result) {
        let repos = [];
        Object.keys(result.files).forEach(file => {
          let fileData = result.files[file],
            language = fileData.language;
          if (file === "users.json" && fileData.content) {
            FourthWall.importantUsers = $.merge(FourthWall.importantUsers, JSON.parse(fileData.content));
          } else if (language === "CSS") {
            let $custom_css = $('<style>');
            $custom_css.text(fileData.content);
            $('head').append($custom_css);
          } else if (language === 'JavaScript' || language === 'JSON' || !language) {
            repos = JSON.parse(fileData.content);
          }
        });
        return repos;
      }
    });
  };

  let fetchReposFromTeams = function () {
    let promises = [];

    FourthWall.getTeams().forEach(function (team) {
      promises.push(fetchReposFromTeam(team));
    });

    let d = $.Deferred();
    $.when.apply(null, promises).done(function (results) {
      let repos = FourthWall.FetchRepos.getUniqueRepos(results);
      d.resolve(repos);
    });

    return d.promise();
  };

  let fetchReposFromTeam = function (team) {
    let d = $.Deferred();
    fetchTeamId(team).done(function (teamId) {
      FourthWall.fetchDefer({
        url: team.baseUrl + "/teams/" + teamId + "/repos",
        data: {per_page: 100},
        done: function (result) {
          d.resolve(result.map(function (item) {
            return {
              repo: item.name,
              userName: item.owner.login,
              baseUrl: team.baseUrl + "/repos",
              defaultBranch: item.default_branch,
            };
          }));
        }
      });

      FourthWall.fetchDefer({
        url: team.baseUrl + "/teams/" + teamId + "/members",
        done: function (result) {
          result.forEach(function (member) {
            FourthWall.importantUsers.push(member.login)
          });
        }
      });
    });
    return d;
  };

  let fetchTeamId = function (team) {
    return FourthWall.fetchDefer({
      // team.list results are paginated, try and get as many in the first page
      // as possible to map slug-to-id (github max is 100 per-page)
      url: team.baseUrl + '/orgs/' + team.org + '/teams',
      data: {per_page: 100},
      done: function (result) {
        for (let i = 0; i < result.length; i++) {
          if (result[i].slug === team.team) {
            return result[i].id;
          }
        }
        throw "Couldn't map team '" + team.team + "' to an ID"
      }
    });
  };
}());
