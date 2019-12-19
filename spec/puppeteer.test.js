/* eslint-env jest */

const puppeteer = require('puppeteer')
let browser;
let page;

beforeEach(async (done) => {
  browser = await puppeteer.launch();
  page = await browser.newPage();
  done();
});

afterEach(async (done) => {
  await page.close();
  await browser.close();
  done();
});

it('passes all tests', async (done) => {
  // TODO: make this a generic url to work locally or in Travis
  // await page.goto('file:///Users/alistairlaing/work/fourth-wall/spec/index.html')
  await page.goto('http://localhost:8000/spec/index.html');
  await page.waitForSelector('.jasmine-overall-result.jasmine-bar');
  const result = await page.evaluate(() =>
    document.querySelector('.jasmine-overall-result.jasmine-bar.jasmine-passed, .jasmine-overall-result.jasmine-bar.jasmine-failed').textContent);

  const messageRegex = /(?<passing>\d+) specs?, (?<failures>\d+) failures?/;
  expect(result).toMatch(messageRegex);

  let match = result.match(messageRegex);
  let passing = match.groups.passing;
  let failures = match.groups.failures;

  if (failures === '0') {
    console.log(`Passing ${passing} spec${passing > 1 ? 's' : ''}`);
  } else {
    fail(`${failures} failing spec${failures > 1 ? 's' : ''}`);
  }

  done();
});
