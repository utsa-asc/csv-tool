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
  var updated = JSON.parse(PAYLOAD_DOCUMENT);
  updated.asset.page.parentFolderPath = content.asset.page.parentFolderPath;
  updated.asset.page.path = content.asset.page.path;
  updated.asset.page.name = content.asset.page.name;
  updated.asset.page.id = content.asset.page.id;
  updated.asset.page.metadata = content.asset.page.metadata;
  updated.asset.page.metadata.teaser = sanitizeText(updated.asset.page.metadata.teaser);
  updated.asset.page.metadata.author = sanitizeText(updated.asset.page.metadata.author);
  delete updated.asset.page.metadata.dynamicFields;
  updated.asset.page.structuredData.structuredDataNodes = reformatStructuredData(content.asset.page.structuredData.structuredDataNodes);
  return updated;
}

// - update structured data nodes []
//   - make sure to reformat WYSIWYG text
//   - make sure to reformat image1, image2 file asset
function reformatStructuredData(data) {
  var image1Struct = {
    "type": "group",
    "identifier": "image1",
    "structuredDataNodes": [
      {
        "type": "asset",
        "identifier": "file",
        "assetType": "file"
      }
    ]
  };
  var image2Struct = {
    "type": "group",
    "identifier": "image2",
    "structuredDataNodes": [
      {
        "type": "asset",
        "identifier": "file",
        "assetType": "file"
      }
    ]
  };
  var textStruct = {
    "type": "text",
    "identifier": "wysiwyg",
    "text": ""
  };
  var copy = "";
  var updatedData = [];
  // console.log("original SD");
  // console.log(JSON.stringify(data));
  // console.log("========================");
  // console.log("========================");
  // console.log("========================");
  // console.log("========================");
  data.map(function(dataNode) {
    if (dataNode.identifier == "source" ) {
      dataNode.text = sanitizeText(dataNode.text);
      updatedData.push(dataNode);
    } else if (dataNode.identifier == "wysiwyg") {
      //surpress any existing empty wysiwyg nodes
    } else if (dataNode.identifier == "image1") {
      if (dataNode.filePath != "") {
        image1Struct.structuredDataNodes[0].fileId = dataNode.fileId;
        image1Struct.structuredDataNodes[0].filePath = dataNode.filePath;
      }
      // console.log(JSON.stringify(dataNode));
      //do nothing for now (surpress)
    } else if (dataNode.identifier == "image2") {
      if (dataNode.filePath != "") {
        image2Struct.structuredDataNodes[0].fileId = dataNode.fileId;
        image2Struct.structuredDataNodes[0].filePath = dataNode.filePath;
      }
      // console.log(JSON.stringify(dataNode));
    } else if (dataNode.identifier == "ContentRow" ) {
      const contentSD = dataNode.structuredDataNodes[0].structuredDataNodes;
      contentSD.map(function(cnode) {
        if (cnode.identifier == "editor") {
          console.log("upating copy");
          copy = copy + cnode.text;
        }
      });
    } else {
      updatedData.push(dataNode);
    }
  });
  textStruct.text = sanitizeText(copy);
  updatedData.push(textStruct);
  updatedData.push(image1Struct);
  updatedData.push(image2Struct);
  // console.log("updated SD");
  // console.log(JSON.stringify(updatedData));
  return updatedData;
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
      console.log("GET: " + getOptions.path);
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
