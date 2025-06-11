/**
 * Graduate School News Page Post
 * ## Goals:
 * - convert older Blog v1.2 cascade pages into new DLS blog page
 * - utilize CMS API GET to grab exisiting page data
 * - populate blank blog JSON with old blog data
 * - CMS API POST to create new DLS blog post
 * - assuming all images are in news-old/YYYY/images
 * - assuming no html data need to be updated (left for content owners)
 * 
 * ## Input:
 * - list of CMS page paths in .xls format
 * 
 * ## Output:
 * - updated .xls of exported/created page paths (relative) and created cascade IDs
 * **/
const https = require('https');
const http = require('http');
var JSSoup = require("jssoup").default;
const XLSX = require("xlsx");
var moment = require('moment'); // require
moment().format();
const { execSync } = require('child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
var fs = require('fs');
XLSX.set_fs(fs);
var tasks = [];
require('dotenv').config();
/* defining some constants */
const POST = process.env.POST;
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const DO_POST = process.env.POST;
const FETCH = process.env.FETCH;
const SAVE = process.env.SAVE;
const PAYLOAD_DOCUMENT = fs.readFileSync("json/generated-gs-news.json");
const TARGET_SITE = "GRADUATESCHOOL-VPAA-ASC-HALSTORE";
const POST_URI = "/api/v1/edit";
const GET_URI = "/api/v1/read/page/GRADUATESCHOOL-VPAA-ASC-HALSTORE/"
const PATH_FORMAT = "YYYY/MM";
const DAY_FORMAT = "DD-";
const TARGET_YEAR = 2020;
const SOURCE_DOCUMENT = "gs/gs-news-new.xlsx";
const SHEET_NAME = "news";

var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

//read in a target year json file
//map over each post
//create a task for each one
var tasks = [];
var workbook = XLSX.readFile(SOURCE_DOCUMENT, { cellDates: true });
console.dir(workbook.SheetNames);
var dataSheet = workbook.Sheets[SHEET_NAME];
const sheetRange = XLSX.utils.decode_range(dataSheet['!ref']);
const maxRow = sheetRange.e.r;


console.log(maxRow);
for (let i = 2; i < (maxRow + 2); i++) {
  // console.log(i);
  var newTask = {}
  try {
    var newTask = {
      "row": i,
      "uri": dataSheet['B' + i].v.trim()
    };
    if (newTask.uri.includes(TARGET_YEAR)) {
      tasks.push(newTask);
    }
    // console.dir(newTask);
  } catch (pe) {
    console.log(pe);
    console.log("unable to parse: " + i + " skipping row");
  }
}
console.log("generated: " + tasks.length + " tasks");
executeTasksConcurrently(tasks);

async function executeTasksConcurrently(list) {
  let activeTasks = [];
  let concurrencyLimit = 3;

  for (const item of list) {
    if (activeTasks.length >= concurrencyLimit) {
      await Promise.race(activeTasks);
    }
    // console.log(`Start task: ${item}`);
    // console.dir(item);
    // wait 0.25 secs between launching new async task b/c Cascade chokes, otherwise...
    await delay(50);
    const activeTask = completeTask(item)
      .then(() => {
        activeTasks.splice(activeTasks.indexOf(activeTask), 1);
        // console.log(`End task: ${item}`);
      })
      .catch(() => {
        activeTasks.splice(activeTasks.indexOf(activeTask), 1);
        // console.log(`End task: ${item}`);
      });
    activeTasks.push(activeTask);
  }
}

async function completeTask(t) {
  var oldAsset = {};
  try {
    if (FETCH == "YES") {
      console.log("FETCH: " + t.uri);
      t.asset = await getAsset(encodeURI(t.uri));
      // console.dir(t.asset);
    }
    //given a task (post):
    // preparePayload(t)
    // POST payload
    // const payload = {};
    const payload = preparePayload(t);
    let stringPayload = JSON.stringify(payload);
    // console.log(stringPayload);
    if (POST == "YES") {
      let postedAsset = await postAsset(POST_URI, stringPayload);
      try {
        let respj = JSON.parse(postedAsset);
        if (respj.success == true) {
          console.log(respj);
          // console.log("created: " + respj.success + "\t" + respj.createdAssetId);
        } else {
          console.log("****ERROR****");
          console.log(postedAsset);
          console.dir(t);
          console.log("******PAYLOAD******");
          console.log(stringPayload);
          console.log("******END******");
          // console.dir(payload);
        }
      } catch (e) {
        console.log("POST failed to return a JSON response");
        console.log(e);
      }
    }
  } catch (e) {
    console.log(e);
    console.log("Error while running tasks:");
    console.dir(t);
  }
  return t;
}

function preparePayload(task) {
  //grab out html content
  //load it into jssoup
  //remove redundant wrapper section and div tags
  //set html content and pass back the asset object
  var page = task.asset;
  var data = page.asset.page.structuredData.structuredDataNodes;
  var content = "";
  var imageData = {
    "type": "group",
    "identifier": "image1",
    "structuredDataNodes": [
      {
        "type": "asset",
        "identifier": "file",
        "filePath": "",
        "assetType": "file"
      },
      {
        "type": "text",
        "identifier": "alt",
        "text": "headline goes here"
      }
    ]
  };

  data.map(function (d) {
    if (d.identifier == "wysiwyg") {
      content = d.text;
      //JSSoup instantiation
      var soup = new JSSoup(content);
      var images = soup.findAll('img');
      //find any images
      //populate our imageData set
      if (images.length > 0) {
        let firstImage = images[0];
        var imageSrc = firstImage.attrs.src.replace('/news/', 'news/');
        let imageAlt = firstImage.attrs.alt;
        console.log("first image: " + imageSrc);
        console.log("alt txt: " + imageAlt);
        imageData.structuredDataNodes[0].filePath = imageSrc;
        imageData.structuredDataNodes[1].text = imageAlt;
      }
    }
  });

  //do we have an image set?
  // if so, maq over data again and update image1 node
  if (imageData.structuredDataNodes[0].filePath != "") {
    data.map(function (i) {
      if (i.identifier == "image1") {
        i.structuredDataNodes = imageData.structuredDataNodes;
      }

      if (i.identifier == "articleType") {
        i.text = "custom"
      }
    });
  }
  return page;
}

async function postAsset(uri, payload) {
  //do GET
  let postOptions = {
    hostname: CAS_HOST,
    port: CAS_PORT,
    path: uri,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': payload.length,
      Authorization: ' Bearer ' + API_KEY
    }
  };
  if (CAS_PORT == 443) {
    postOptions.requestCert = false;
    postOptions.rejectUnauthorized = false;
  }
  // console.log(payload);
  let p = new Promise((resolve, reject) => {
    const req = protocol.request(postOptions, (response) => {
      // console.log(postOptions);
      // console.log(postOptions.headers['Content-Length']);
      // console.log(payload);
      // console.log(payload.length);
      let chunks_of_data = [];
      response.on('data', (fragments) => {
        chunks_of_data.push(fragments);
      });

      response.on('end', () => {
        let responseBody = Buffer.concat(chunks_of_data);
        let responseString = responseBody.toString();
        resolve(responseString);
      });

      response.on('error', (error) => {
        reject(error);
      });
    });
    req.write(payload);
    req.end();
  });

  return await p;
}

async function getAsset(uri) {
  //do GET
  let getOptions = {
    hostname: CAS_HOST,
    port: CAS_PORT,
    path: GET_URI + uri,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // 'Content-Length': postData.length,
      Authorization: ' Bearer ' + API_KEY
    }
  };
  if (CAS_PORT == 443) {
    getOptions.requestCert = false;
    getOptions.rejectUnauthorized = false;
  }
  let p = new Promise((resolve, reject) => {
    const req = protocol.request(getOptions, (response) => {
      // console.log(getOptions);
      let chunks_of_data = [];

      response.on('data', (fragments) => {
        // console.log("\t pushing data");
        chunks_of_data.push(fragments);
      });

      response.on('end', () => {
        var responeObj = {};
        try {
          let responseBody = Buffer.concat(chunks_of_data);
          let responseString = responseBody.toString();
          responseObj = JSON.parse(responseString);
        } catch (jsonE) {
          responseObj = { status: false, error: "unable to parse JSON as response" };
        }
        resolve(responseObj);
      });

      response.on('error', (error) => {
        reject(error);
      });
    });
    req.end();
  });
  return await p;
}
