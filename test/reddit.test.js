const test = require("node:test");
const assert = require("node:assert/strict");

function loadRedditModule() {
  const modulePath = require.resolve("../src/core/reddit");
  delete require.cache[modulePath];
  return require("../src/core/reddit");
}

function makeThreadPayload(posts) {
  return {
    data: {
      children: posts.map((post) => ({ data: post }))
    }
  };
}

function makeFetchMock(routes) {
  return async function fetchMock(url) {
    const route = routes.find((item) => url.includes(item.match));
    if (!route) {
      throw new Error(`Unexpected URL: ${url}`);
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return route.payload;
      }
    };
  };
}

test("fetchThreads uses explicit subreddit names", async () => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const { fetchThreads } = loadRedditModule();
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      async json() {
        return makeThreadPayload([
          {
            id: "abc123",
            created_utc: nowSeconds,
            title: "Need help choosing SaaS tools",
            selftext: "Any recommendations?",
            ups: 12,
            num_comments: 4,
            permalink: "/r/SaaS/comments/abc123/example"
          }
        ]);
      }
    };
  };

  const threads = await fetchThreads({
    subreddits: ["SaaS"],
    keywords: [],
    daysBack: 7,
    minUpvotes: 0,
    minComments: 0,
    maxThreads: 10
  });

  assert.equal(threads.length, 1);
  assert.equal(threads[0].subreddit, "SaaS");
  assert.ok(calls.some((call) => call.url.includes("/r/SaaS/new.json")));
});

test("fetchThreads discovers subreddits from natural language query", async () => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const { fetchThreads } = loadRedditModule();
  const calls = [];

  global.fetch = makeFetchMock([
    {
      match: "/subreddits/search.json",
      payload: {
        data: {
          children: [
            { data: { display_name: "startups" } },
            { data: { display_name: "Entrepreneur" } }
          ]
        }
      }
    },
    {
      match: "/r/startups/new.json",
      payload: makeThreadPayload([
        {
          id: "post-1",
          created_utc: nowSeconds,
          title: "Best tools for early-stage founders?",
          selftext: "Trying to build outbound process.",
          ups: 10,
          num_comments: 5,
          permalink: "/r/startups/comments/post-1/example"
        }
      ])
    },
    {
      match: "/r/Entrepreneur/new.json",
      payload: makeThreadPayload([
        {
          id: "post-2",
          created_utc: nowSeconds,
          title: "How to find quality leads from communities?",
          selftext: "Looking for repeatable process.",
          ups: 8,
          num_comments: 3,
          permalink: "/r/Entrepreneur/comments/post-2/example"
        }
      ])
    }
  ]);

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return makeFetchMock([
      {
        match: "/subreddits/search.json",
        payload: {
          data: {
            children: [
              { data: { display_name: "startups" } },
              { data: { display_name: "Entrepreneur" } }
            ]
          }
        }
      },
      {
        match: "/r/startups/new.json",
        payload: makeThreadPayload([
          {
            id: "post-1",
            created_utc: nowSeconds,
            title: "Best tools for early-stage founders?",
            selftext: "Trying to build outbound process.",
            ups: 10,
            num_comments: 5,
            permalink: "/r/startups/comments/post-1/example"
          }
        ])
      },
      {
        match: "/r/Entrepreneur/new.json",
        payload: makeThreadPayload([
          {
            id: "post-2",
            created_utc: nowSeconds,
            title: "How to find quality leads from communities?",
            selftext: "Looking for repeatable process.",
            ups: 8,
            num_comments: 3,
            permalink: "/r/Entrepreneur/comments/post-2/example"
          }
        ])
      }
    ])(url, options);
  };

  const threads = await fetchThreads({
    subreddits: ["ai lead generation for founders"],
    subredditQuery: "",
    autoDiscoverSubreddits: true,
    maxDiscoveredSubreddits: 5,
    keywords: [],
    daysBack: 7,
    minUpvotes: 0,
    minComments: 0,
    maxThreads: 10
  });

  assert.equal(threads.length, 2);
  assert.ok(calls.some((call) => call.url.includes("/subreddits/search.json")));
  assert.ok(calls.some((call) => call.url.includes("/r/startups/new.json")));
  assert.ok(calls.some((call) => call.url.includes("/r/Entrepreneur/new.json")));
});

