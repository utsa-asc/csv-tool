/* HONORS News Content Type Migration Tasks:
  0) read incoming CSV
  1) GET request URI from CSV data
  2) construct new MINIMUM POST data
    - update content type
    - update structured data nodes []
      - make sure to reformat WYSIWYG text
      - make sure to reformat image1, image2 file asset
    - update metadata {}
  3) POST updated asset
  */
const https = require('https');
const http = require('http');
var fs = require('fs');
var csv = require('fast-csv');
const CSV_INPUT = "honors/honors-news-uris.csv";
const PAYLOAD_DOCUMENT = fs.readFileSync("json/honors-news-minimum.json");
require('dotenv').config();
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const GET_URI = "/api/v1/read/page/HONORS-VPAA-ASC-HALSTORE";
const POST_URI = "/api/v1/edit";

var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}
var tasks = [];

// 0) read incoming CSV
fs.createReadStream(CSV_INPUT)
  .pipe(csv.parse({ headers: false }))
  .on('data', function(obj) {
    console.log("adding: " + obj[0] + " to tasks"); 
    tasks.push({"uri": obj[0]});
  })
  .on('end', function() {
    completeTasks();
  });

async function completeTasks() {
  var currentTask = {};
  try {
    for (let t of tasks) {
      currentTask = t['uri'];
      console.log("modify content type for asset at: " + currentTask);
      // 1) GET request URI from CSV data
      var content = await getAsset(currentTask);
      // console.log(content);
      // 2) construct new MINIMUM POST data
      const updatedAsset = updateAsset(content);
      // 3) POST updated asset
      let jsonPayload = JSON.stringify({asset: updatedAsset.asset});
      console.log("updateAsset: " + currentTask)
      // console.log(jsonPayload);
      let postedAsset = await postAsset(POST_URI, jsonPayload);
      console.log(postedAsset);
    }
  } catch (e) {
    console.log("\t error with task: " + currentTask.uri);
    console.log(e);
  }
}

/*
// 2) construct new MINIMUM POST data
// - update content type
// - update structured data nodes []
//   - make sure to reformat WYSIWYG text
//   - make sure to reformat image1, image2 file asset
// - update metadata {}
*/
function updateAsset(content) {
  var updatedContent = content;
  const tags = [{ "name": "news"}, {"name": "honors" }];
  updatedContent.asset.page['tags'] = tags;
  return updatedContent;
}

function sanitizeText(content) {
  var contentStr = content;
  contentStr = contentStr.replace('&nbsp;', '&#160;');
  contentStr = contentStr.replace(/\u00a0/g, " ");
  contentStr = contentStr.replace(/\u2013/g, "-");
  contentStr = contentStr.replace(/\u2019/g, "'");
  contentStr = contentStr.replace(/\r?\n|\r/g, "");
  contentStr = contentStr.replace('“', '"');
  contentStr = contentStr.replace('”', '"');
  contentStr = contentStr.replace('’', "'");
  contentStr = contentStr.replace('&mdash;', '&#8212;');
  contentStr = contentStr.replace('<br>', '<br/>');
  contentStr = contentStr.replace('<hr>', '<hr/>');
  contentStr = contentStr.replace(/[^\x00-\x7F]/g, "");
  return contentStr;
}

async function postAsset(uri, payload) {
  //do GET
  let postOptions = {
    hostname: CAS_HOST,
    port: CAS_PORT,
    path: POST_URI,
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
      // console.log("GET: " + getOptions.path);
			let chunks_of_data = [];

			response.on('data', (fragments) => {
        // console.log("\t pushing data");
				chunks_of_data.push(fragments);
			});

			response.on('end', () => {
				let responseBody = Buffer.concat(chunks_of_data);
        let responseString = responseBody.toString();
        let responseObj = JSON.parse(responseString);
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
