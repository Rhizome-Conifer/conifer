"use strict";

const fetch = require('node-fetch');
const querystring = require('querystring');
const fs = require('fs');

const Redis = require('ioredis');

const puppeteer = require('puppeteer-core');
const dns = require('dns').promises;

const browserHost = process.env.BROWSER_HOST || 'localhost';
const proxyHost = process.env.PROXY_HOST;

const crawlId = process.env.AUTO_ID;
const reqid = process.env.REQ_ID;

const screenshotAPI = process.env.SCREENSHOT_API_URL;
const textAPI = process.env.EXTRACTED_RAW_DOM_API_URL;


// ===========================================================================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ===========================================================================
async function connect() {
  const { address: hostname } = await dns.lookup(browserHost);

  let browser = null;
  const browserURL = `http://${hostname}:9222`;
  const defaultViewport = null;
  const params = {browserURL, defaultViewport};

  console.log(params);

  while (!browser) {
    try {
      browser = await puppeteer.connect(params);
    } catch (e) {
      console.log(e);
      console.log('Waiting for browser...');
      await sleep(500);
    }
  }

  return browser;
}


// ===========================================================================
async function getBrowserIP(redis) {
  try {
    let reqdata = await redis.get(`req:${reqid}`);
    reqdata = JSON.parse(reqdata);
    return reqdata.resp.containers.browser.ip;
  } catch(e) {
    console.log(e);
    return "";
  }
}


// ===========================================================================
async function main() {
  const browser = await connect();

  const redis = new Redis(process.env.REDIS_URL);

  const pages = await browser.pages();

  const page = pages.length ? pages[0] : await browser.newPage();

  const client = await page.target().createCDPSession();

  let nextData = null;

  const browserIP = await getBrowserIP(redis);
  const browserKey = `up:${browserIP}`;

  //console.log(await redis.hgetall(`a:${crawlId}:info`));
  const sessionProps = await redis.hgetall(browserKey);
  console.log(sessionProps);

  const user = sessionProps.user;
  const collection = sessionProps.coll_name;

  while (nextData = await redis.rpop(`a:${crawlId}:q`)) {
    try {
      console.log(nextData);
      const { url, depth, timestamp, title, pid } = JSON.parse(nextData);

      if (timestamp) {
        await redis.hset(browserKey, 'timestamp', timestamp);
        console.log(await redis.hgetall(browserKey));
      }

      if (timestamp) {
        console.log('timestamp: ' + timestamp);
        await page.goto(`http://webrecorder.proxy/${user}/${collection}/${timestamp}/${url}`);
      } else {
        await page.goto(url);
      }

      await putScreenshot(page, url);

      await putText(client, url, timestamp, title, pid);
    } catch (e) {
      console.log(e);
    }
  }

  const time = new Date().getTime() / 1000;
  await redis.lpush(`a:${crawlId}:br:done`, JSON.stringify({id: reqid, time}));

  console.log('done!');
}


// ===========================================================================
async function putScreenshot(page, url) {
  try {
    if (!screenshotAPI) {
      return;
    }

    await page.screenshot({'path': '/tmp/screenshot.png', omitBackground: true});

    const buff = await fs.promises.readFile('/tmp/screenshot.png');

    const params = {url, reqid, type: 'screenshot'};

    await putCustomRecord(screenshotAPI, params, 'image/png', buff);
  } catch (e) {
    console.log(e);
  }
}


// ===========================================================================
async function putText(client, url, timestamp, title, pid) {
  try {
    if (!textAPI) {
      return;
    }

    const result = await client.send("DOM.getDocument", {"depth": -1, "pierce": true});

    //console.log(result);

    //await putCustomRecord(textAPI, url, 'application/json', JSON.stringify(result));
    title = title || "";
    timestamp = timestamp || "";

    const params = {url, title, timestamp, pid, "hasScreenshot": screenshotAPI ? "1" : "0", reqid, type: 'text'};
    await putCustomRecord(textAPI, params, 'text/plain', parseTextFromDom(result));
  } catch (e) {
    console.log(e);
  }
}


// ===========================================================================
async function putCustomRecord(putUrl, params, contentType, buff) {
  try {
    //const putUrl = `http:\/\/${proxyHost}:8080/api/custom/capture?${querystring.stringify({"url": url})}`;
    putUrl += "?" + querystring.stringify(params);

    let res = await fetch(putUrl, { method: 'PUT', body: buff, headers: { 'Content-Type': contentType } });
    res = await res.json();
    console.log(res);
  } catch (e)  {
    console.log(e);
  }
}


// ===========================================================================
function parseTextFromDom(dom) {
  const accum = [];
  const metadata = {};

  parseText(dom.root, metadata, accum);

  return accum.join('\n');
}


// ===========================================================================
function parseText(node, metadata, accum) {
  const SKIPPED_NODES = ["head", "script", "style", "header", "footer", "banner-div", "noscript"];
  const EMPTY_LIST = [];
  const TEXT = "#text";
  const TITLE = "title";
  
  const name = node.nodeName.toLowerCase();
    
  if (SKIPPED_NODES.includes(name)) {
    return;
  }

  const children = node.children || EMPTY_LIST;

  if (name === TEXT) {
    const value = node.nodeValue ? node.nodeValue.trim() : '';
    if (value) {
      accum.push(value);
    }
  } else if (name === TITLE) {
    const title = [];

    for (let child of children) {
      parseText(child, null, title);
    }
  
    if (metadata) {
      metadata.title = title.join(' ');
    } else {
      accum.push(title.join(' '));
    }
  } else {
    for (let child of children) {
      parseText(child, metadata, accum);
    }

    if (node.contentDocument) { 
      parseText(node.contentDocument, null, accum);
    } 
  }
}


(async function () {
  await main();
  process.exit(0);
})();

