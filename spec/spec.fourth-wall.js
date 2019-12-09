function setupMoment(date, anObject) {
  spyOn(anObject, "moment");
  anObject.moment.plan = function () {
    let realMoment = anObject.moment.originalValue;
    // set "now" to a fixed date to enable static expectations
    if (!arguments.length) {
      return realMoment(date);
    }
    return realMoment.apply(null, arguments);
  }
}

describe("Fourth Wall", function () {

  describe("parseQueryVariables", function () {
    it("should convert a query string into a params object", function () {
      spyOn(FourthWall, '_getLocationSearch').andReturn("?ref=gh-pages&token=nonsense");
      let query_params = FourthWall.parseQueryVariables();
      expect(query_params).toEqual({'ref': 'gh-pages', 'token': 'nonsense'});
    });
    it("should return current location params object if no query string is provided", function () {
      spyOn(FourthWall, '_getLocationSearch').andReturn('?foo=bar&me=you');
      let query_params = FourthWall.parseQueryVariables();
      expect(query_params).toEqual({foo: 'bar', me: 'you'});
    });
    it("should handle array parameters with [] keys", function () {
      spyOn(FourthWall, '_getLocationSearch').andReturn("?ref=gh-pages&token[]=nonsense&token[]=foo");
      let query_params = FourthWall.parseQueryVariables();
      expect(query_params).toEqual({'ref': 'gh-pages', 'token': ['nonsense', 'foo']});
    });
  });
  describe("getQueryVariable", function () {
    beforeEach(function () {
      FourthWall.queryVariables = null;
    });
    it("should get a query parameter from the provided query string", function () {
      spyOn(FourthWall, '_getLocationSearch').andReturn('?foo=everything');
      let value = FourthWall.getQueryVariable('foo');
      expect(value).toEqual('everything');
    });
    it("should get a query parameter from the current location", function () {
      spyOn(FourthWall, '_getLocationSearch').andReturn('?foo=location');
      let value = FourthWall.getQueryVariable('foo');
      expect(value).toEqual('location');
    });
  });
  describe("buildQueryString", function () {
    it("should convert a query string into a params object", function () {
      let query_string = FourthWall.buildQueryString({'ref': 'gh-pages', 'token': 'nonsense'});
      expect(query_string).toEqual("?ref=gh-pages&token=nonsense");
    });
    it("should handle an empty object", function () {
      let query_string = FourthWall.buildQueryString({});
      expect(query_string).toEqual("");
    });
  });

  describe("getToken", function () {
    beforeEach(function () {
      spyOn(FourthWall, 'getQueryVariable');
      FourthWall.getQueryVariable.plan = function (name) {
        return {
          "api.github.com_token": "com-token",
          "token": "default-token",
          "github.gds_token": "gds-token"
        }[name];
      };
    });

    it("returns correct enterprise token", function () {
      expect(FourthWall.getToken('github.gds')).toEqual("gds-token");
    });

    it("returns correct github.com token", function () {
      expect(FourthWall.getToken('api.github.com')).toEqual("com-token");
    });

    it("falls back to default token for github.com", function () {
      FourthWall.getQueryVariable.plan = function (name) {
        return {
          "token": "default-token",
          "github.gds_token": "gds-token"
        }[name];
      };

      expect(FourthWall.getToken('api.github.com')).toEqual("default-token");
    })
  });

  describe("getTokenFromUrl", function () {
    beforeEach(function () {
      spyOn(FourthWall, 'getToken');
    });

    it("extracts github.com hostname", function () {
      FourthWall.getTokenFromUrl("http://api.github.com/foo/bar");
      expect(FourthWall.getToken).toHaveBeenCalledWith("api.github.com");
    });

    it("extracts enterprise github hostname", function () {
      FourthWall.getTokenFromUrl("http://github.gds/foo/bar");
      expect(FourthWall.getToken).toHaveBeenCalledWith("github.gds");
    });
  });

  describe("getTeams", function () {
    it("should return an array of teams", function () {
      spyOn(FourthWall, "getQueryVariables").andReturn({team: "myorg/myteam"});
      let teams = FourthWall.getTeams();

      let expected = {
        org: "myorg",
        team: "myteam",
        hostname: "api.github.com",
        baseUrl: "https://api.github.com"
      };
      expect(teams.length).toBe(1);
      expect(teams[0]).toEqual(expected);
    });

    it("should return an array with a github enterprise team", function () {
      spyOn(FourthWall, "getQueryVariables").andReturn({"github.gds_team": "myorg/myteam"});
      let teams = FourthWall.getTeams();

      expect(teams.length).toBe(1);
      let expected = {
        org: "myorg",
        team: "myteam",
        hostname: "github.gds",
        baseUrl: "https://github.gds/api/v3"
      };
      expect(teams[0]).toEqual(expected);
    });

    it("should handle multiple teams for a given instance", function () {
      spyOn(FourthWall, "getQueryVariables").andReturn({
        "team": ["org1/team1", "org2/team2"],
        "github.gds_team": ["myorg/myteam", "otherorg/team2"]
      });

      let teams = FourthWall.getTeams();

      expect(teams.length).toBe(4);
      expect(teams[0]).toEqual({
        org: "org1",
        team: "team1",
        hostname: "api.github.com",
        baseUrl: "https://api.github.com"
      });
      expect(teams[1]).toEqual({
        org: "org2",
        team: "team2",
        hostname: "api.github.com",
        baseUrl: "https://api.github.com"
      });
      expect(teams[2]).toEqual({
        org: "myorg",
        team: "myteam",
        hostname: "github.gds",
        baseUrl: "https://github.gds/api/v3"
      });
      expect(teams[3]).toEqual({
        org: "otherorg",
        team: "team2",
        hostname: "github.gds",
        baseUrl: "https://github.gds/api/v3"
      });
    });

    it("should return an empty array if no teams are set", function () {
      spyOn(FourthWall, "getQueryVariables").andReturn({"foo": "bar"});
      let teams = FourthWall.getTeams();
      expect(teams).toEqual([]);
    });
  });

  describe("isPullWip", function () {
    for (const wipString of ["wip", "WIP", "DO NOT MERGE", "Do not Merge"]) {
      it(`should return true if the title contains ${wipString}`, function () {
        let pull = {get: () => `my title ${wipString} for PR`};
        expect(FourthWall.isPullWip(pull)).toEqual(true);
      });
    }

    for (const nonWipString of ["WAP", "DO PLEASE MERGE"]) {
      it(`should return false if the title contains ${nonWipString}`, function () {
        let pull = {get: () => `my title ${nonWipString} for PR`};
        expect(FourthWall.isPullWip(pull)).toEqual(false);
      });
    }
  });

  describe("checkOptionEnabled", function () {
    it("should return true if option set to true in query params", function () {
      spyOn(FourthWall, "getQueryVariable").andReturn("true");
      expect(FourthWall.checkOptionEnabled("test", false)).toEqual(true);
    });

    it("should return false if option set to false in query params", function () {
      spyOn(FourthWall, "getQueryVariable").andReturn('false');
      expect(FourthWall.checkOptionEnabled("test", true)).toEqual(false);
    });

    it("should return default value if option is not set in query params", function () {
      spyOn(FourthWall, "getQueryVariable").andReturn(undefined);
      expect(FourthWall.checkOptionEnabled("test", true)).toEqual(true);
      expect(FourthWall.checkOptionEnabled("test", false)).toEqual(false);
    });
  });

  describe("isUserImportant", function () {
    it("should return true if filterUsers flag not set", function () {
      FourthWall.filterUsers = false;
      FourthWall.importantUsers = ["user"];
      expect(FourthWall.isUserImportant("user")).toEqual(true);
    });

    it("should return true if filterUsers flag is set but no important users have been specified", function () {
      FourthWall.filterUsers = true;
      FourthWall.importantUsers = [];
      expect(FourthWall.isUserImportant("user")).toEqual(true);
    });

    it("should return true if user is in the important users list", function () {
      FourthWall.filterUsers = true;
      FourthWall.importantUsers = ["user"];
      expect(FourthWall.isUserImportant("user")).toEqual(true);
    });

    it("should return false if user is not in the important users list", function () {
      FourthWall.filterUsers = true;
      FourthWall.importantUsers = ["user"];
      expect(FourthWall.isUserImportant("unimportant-user")).toEqual(false);
    });
  });

  describe("shouldDisplayPull", function () {
    it("should display pull if repo is important", function () {
      spyOn(FourthWall, "isUserImportant").andReturn(false);
      let pull = {user: {login: 'user'}};
      expect(FourthWall.shouldDisplayPull(pull, true)).toEqual(true);
    });

    it("should display pull if user is important", function () {
      spyOn(FourthWall, "isUserImportant").andReturn(true);
      let pull = {user: {login: 'user'}};
      expect(FourthWall.shouldDisplayPull(pull, false)).toEqual(true);
    });

    it("should not display pull if repo and user are important", function () {
      spyOn(FourthWall, "isUserImportant").andReturn(false);
      let pull = {user: {login: 'user'}};
      expect(FourthWall.shouldDisplayPull(pull, false)).toEqual(false);
    });
  });

  describe("FetchRepos", function () {
    describe("mergeRepoArrays", function () {
      it("should merge two repo arrays", function () {
        let repos1 = [{userName: "example", repo: "example"}],
          repos2 = [{userName: "example", repo: "another"}];

        let result = FourthWall.FetchRepos.mergeRepoArrays(repos1, repos2);

        let expected = [
          {userName: "example", repo: "example"},
          {userName: "example", repo: "another"},
        ];
        expect(_.isEqual(result, expected)).toEqual(true);
      });

      it("should not duplicate repos", function () {
        let repos1 = [{userName: "example", repo: "example"}],
          repos2 = [{userName: "example", repo: "example"}];

        let result = FourthWall.FetchRepos.mergeRepoArrays(repos1, repos2);

        let expected = [
          {userName: "example", repo: "example"},
        ];
        expect(_.isEqual(result, expected)).toEqual(true);
      });
    });
  });

  describe("Repos", function () {
    describe("schedule", function () {

      let repos;
      beforeEach(function () {
        spyOn(FourthWall, "getQueryVariable");
        spyOn(window, "setInterval");
        spyOn(FourthWall.Repos.prototype, "fetch");
        spyOn(FourthWall.Repos.prototype, "updateList");
        repos = new FourthWall.Repos();
      });

      it("updates the repo list every 15 minutes by default", function () {
        repos.schedule();
        expect(repos.updateList.callCount).toEqual(1);
        expect(setInterval.argsForCall[0][1]).toEqual(900000);
        let callback = setInterval.argsForCall[0][0];
        callback();
        expect(repos.updateList.callCount).toEqual(2);
      });

      it("updates the repo list at a configurable interval", function () {
        FourthWall.getQueryVariable.andReturn(120);
        repos.schedule();
        expect(setInterval.argsForCall[0][1]).toEqual(120000);
        let callback = setInterval.argsForCall[0][0];
        callback();
        expect(repos.updateList).toHaveBeenCalled();
      });

      it("updates the status every 60 seconds by default", function () {
        repos.schedule();
        expect(setInterval.argsForCall[1][1]).toEqual(60000);
        let callback = setInterval.argsForCall[1][0];
        callback();
        expect(repos.fetch).toHaveBeenCalled();
      });

      it("updates the status at a configurable interval", function () {
        FourthWall.getQueryVariable.andReturn(10);
        repos.schedule();
        expect(setInterval.argsForCall[1][1]).toEqual(10000);
        let callback = setInterval.argsForCall[1][0];
        callback();
        expect(repos.fetch).toHaveBeenCalled();
      });
    });
  });

  describe("Repo", function () {
    describe("initialize", function () {
      it("instantiates an internal Master model", function () {
        let repo = new FourthWall.Repo();
        expect(repo.master instanceof FourthWall.MasterStatus).toBe(true);
      });

      it("instantiates an internal list of pull requests", function () {
        let repo = new FourthWall.Repo();
        expect(repo.pulls instanceof FourthWall.Pulls).toBe(true);
      });

      it("triggers a change when the master status changes", function () {
        let repo = new FourthWall.Repo();
        let changed = false;
        repo.on('change', function () {
          changed = true;
        });
        repo.master.set('failed', 'true');
        expect(changed).toBe(true);
      });
    });

    describe("fetch", function () {
      it("fetches new master and pulls data", function () {
        spyOn(FourthWall.MasterStatus.prototype, "fetch");
        spyOn(FourthWall.Pulls.prototype, "fetch");
        let repo = new FourthWall.Repo();
        repo.fetch();
        expect(repo.master.fetch).toHaveBeenCalled();
      });
    });
  });

  describe("Pull", function () {
    describe("initialize", function () {

      let pull;
      beforeEach(function () {
        spyOn(FourthWall.Comment.prototype, "fetch");
        spyOn(FourthWall.ReviewComment.prototype, "fetch");
        spyOn(FourthWall.Status.prototype, "fetch");
        spyOn(FourthWall.Info.prototype, "fetch");
        pull = new FourthWall.Pull({
          head: {sha: 'foo'}
        }, {
          collection: {}
        });
      });

      it("instantiates an internal Comment model", function () {
        expect(pull.comment instanceof FourthWall.Comment).toBe(true);
      });

      it("instantiates an internal ReviewComment model", function () {
        expect(pull.reviewComment instanceof FourthWall.ReviewComment).toBe(true);
      });

      it("triggers a change when the comment changes", function () {
        let changed = false;
        pull.on('change', function () {
          changed = true;
        });
        pull.comment.set('foo', 'bar');
        expect(changed).toBe(true);
      });

      it("triggers a change when the review-comment changes", function () {
        let changed = false;
        pull.on('change', function () {
          changed = true;
        });
        pull.reviewComment.set('foo', 'bar');
        expect(changed).toBe(true);
      });

      it("fetches new comment data when the comment URL changes", function () {
        pull.set('comments_url', 'foo');
        expect(pull.comment.url).toEqual('foo');
        expect(pull.comment.fetch).toHaveBeenCalled();
      });

      it("fetches new review comment data when the review comment URL changes", function () {
        pull.set('url', 'foo');
        expect(pull.reviewComment.url).toEqual('foo/reviews');
        expect(pull.reviewComment.fetch).toHaveBeenCalled();
      });

      it("fetches new comment data when pull data has been fetched", function () {
        pull.fetch();
        expect(pull.comment.fetch).toHaveBeenCalled();
      });

      it("fetches new review comment data when pull data has been fetched", function () {
        pull.fetch();
        expect(pull.reviewComment.fetch).toHaveBeenCalled();
      });

      it("instantiates an internal Status model", function () {
        expect(pull.status instanceof FourthWall.Status).toBe(true);
      });

      it("fetches new status data when the head changes", function () {
        pull.set('head', 'foo');
        expect(pull.status.fetch).toHaveBeenCalled();
      });

      it("triggers a change when the status changes", function () {
        let changed = false;
        pull.on('change', function () {
          changed = true;
        });
        pull.status.set('foo', 'bar');
        expect(changed).toBe(true);
      });
      it("instantiates an internal Info model", function () {
        expect(pull.info instanceof FourthWall.Info).toBe(true);
      });

      it("fetches new info data when the head changes", function () {
        pull.set('head', 'foo');
        expect(pull.info.fetch).toHaveBeenCalled();
      });

      it("triggers a change when the info changes", function () {
        let changed = false;
        pull.on('change', function () {
          changed = true;
        });
        pull.info.set('foo', 'bar');
        expect(changed).toBe(true);
      });
    });

    describe("parse", function () {
      it("calculates seconds since pull request creation date", function () {
        spyOn(FourthWall.Pull.prototype, "elapsedSeconds").andReturn(60);
        spyOn(FourthWall.Comment.prototype, "fetch");
        spyOn(FourthWall.Status.prototype, "fetch");
        let pull = new FourthWall.Pull({
          head: {sha: 'foo'}
        }, {
          collection: {}
        });
        let result = pull.parse({created_at: "2013-09-02T10:00:00+01:00"});
        expect(pull.elapsedSeconds).toHaveBeenCalledWith("2013-09-02T10:00:00+01:00");
        expect(result.elapsed_time).toEqual(60);
      });
    });

    describe("elapsedSeconds", function () {
      it("calculates seconds since creation date", function () {
        setupMoment("2013-09-09T10:01:00+01:00", window)
        spyOn(FourthWall.Comment.prototype, "fetch");
        spyOn(FourthWall.Status.prototype, "fetch");
        let pull = new FourthWall.Pull({
          head: {sha: 'foo'}
        }, {
          collection: {}
        });
        let result = pull.parse({created_at: "2013-09-02T10:00:00+01:00"});
        let fullDay = 24 * 60 * 60;
        let expected = 7 * fullDay + 60;

        expect(result.elapsed_time).toBe(expected);
      });
    });
  });

  describe("Pulls", function () {
    describe("url", function () {
      it("constructs a URL from user name and repo name", function () {
        let pulls = new FourthWall.Pulls([], {
          baseUrl: 'https://api.base.url/repos',
          userName: 'foo',
          repo: 'bar'
        });
        expect(pulls.url()).toEqual('https://api.base.url/repos/foo/bar/pulls');
      });
    });

    describe("parse", function () {
      it("only collects pull requests to display", function () {
        let importantPull = "important-pull";
        let pullData = [importantPull, "unimportant-pull"];
        spyOn(FourthWall, "shouldDisplayPull").andCallFake(pull => pull === importantPull);

        let result = FourthWall.Pulls.prototype.parse(pullData);

        expect(result.length).toEqual(1);
        expect(result[0]).toEqual(importantPull);
      });
    });
  });

  describe("ListItems", function () {
    describe("fetch", function () {
      beforeEach(function () {
        spyOn(FourthWall.Comment.prototype, "fetch");
      });
      const createPull = () => new FourthWall.Pull({head: {sha: "sha"}}, {collection: {}});
      const createRepo = (pull, important) => {
        let repo = new FourthWall.Repo();
        repo.pulls = new FourthWall.Pulls([pull], {
          baseUrl: "baseUrl",
          userName: "userName",
          repo: "repo",
          important: important
        });
        return repo;
      };

      it("collects pull requests from repos", function () {
        let pull1 = createPull(), pull2 = createPull();
        let items = new FourthWall.ListItems([], {
          repos: new FourthWall.Repos([createRepo(pull1, true), createRepo(pull2, false)])
        });

        items.fetch();

        expect(items.repos.length).toEqual(2);
        expect(items.models.length).toEqual(2);
        expect(items.models[0]).toEqual(pull1);
        expect(items.models[1]).toEqual(pull2);
      });
    });
  });

  describe("Status", function () {
    describe("parse", function () {
      it("does nothing when there are no statuses", function () {
        expect(FourthWall.Status.prototype.parse([])).toBeFalsy();
      });

      it("marks as failed when the latest status is not success and not pending", function () {
        let res = FourthWall.Status.prototype.parse([
          {state: 'error'}
        ]);
        expect(res.failed).toBeTruthy();
      });

      it("doesn't mark as failed when the latest status is success or pending", function () {
        let res = FourthWall.Status.prototype.parse([
          {state: 'pending'}
        ]);
        expect(res.failed).toBeFalsy();

        res = FourthWall.Status.prototype.parse([
          {state: 'success'}
        ]);
        expect(res.failed).toBeFalsy();
      });

      it("doesn't mark as failed when a previous status failed", function () {
        let res = FourthWall.Status.prototype.parse([
          {state: 'pending'},
          {state: 'error'}
        ]);
        expect(res.failed).toBeFalsy();
      });
    });
  });
});
