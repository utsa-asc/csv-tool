const https = require('https');
const http = require('http');
const {execSync} = require('child_process');
const XLSX = require("xlsx");
var fs = require('fs');
XLSX.set_fs(fs);
var tasks = [];
require('dotenv').config();
/* defining some constants */
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const DO_POST = process.env.POST;
const SOURCE_DOCUMENT = "cos/cos-faculty.xlsx";
const PAYLOAD_DOCUMENT = fs.readFileSync("json/faculty-block-minimum.json");
const LINK_GROUP = fs.readFileSync("json/link-section.json");
const POST_URI = "/api/v1/edit";
const GET_URI = "/api/v1/read/block/COS-VPAA-ASC-HALSTORE/"
var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

var tasks = [];
const workbook = XLSX.readFile(SOURCE_DOCUMENT);
console.dir(workbook.SheetNames);
const dataSheet = workbook.Sheets['test'];
const sheetRange = XLSX.utils.decode_range(dataSheet['!ref']);
const maxRow = sheetRange.e.r;

console.log(maxRow);
for (let i = 2; i < (maxRow + 2); i++) {
  var newTask = {
    "name" : dataSheet['C'+i].v.trim(),
    "blockURI" : "faculty/_blocks/" + dataSheet['I'+i].v + "/" + dataSheet['C'+i].v.trim(),
    "pageURI": "faculty/profiles/" + dataSheet['C'+i].v.trim()
  };
  // console.dir(newTask);
  tasks.push(newTask);
}
// console.dir(testSheet.Workbook.Names);
// console.log(testSheet);
completeTasks();

async function completeTasks() {
  var currentTask = {}
  try {
    for (let t of tasks) {
      currentTask = t;
      // GET block
      var asset = await getAsset(t.blockURI);
      // update block
      asset = updateAsset(asset, t);
      // POST block
      let stringPayload = JSON.stringify(asset);
      // console.log(stringPayload);
      if (DO_POST == "YES") {
        let postedAsset = await postAsset(POST_URI, stringPayload);
        console.log(postedAsset);
      } else {
        console.log("POST IS NO");
      }
    }
  } catch (e) {
    console.log("Error while running tasks");
    console.log(e);
    console.dir(currentTask);
  }
}

function updateAsset(asset, task) {
  var updatedAsset = asset;
  var nodes = [];
  var details = [];
  var detailsNodes = [];
  const profileLink = {
    "type": "group",
    "identifier": "link",
    "structuredDataNodes": [
      {
        "type": "text",
        "identifier": "label",
        "text": task.name + " Profile Page"
      },
      {
        "type": "asset",
        "identifier": "internal",
        "pagePath": task.pageURI,
        "assetType": "page,file,symlink"
      },
      {
        "type": "text",
        "identifier": "target",
        "text": "Parent Window/Tab"
      }
    ]
  };
  updatedAsset.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes.map(function(d) {
    if (d.identifier == "details") {
      details = d;
    } else {
      nodes.push(d);
    }
  });
  details.structuredDataNodes.map(function(n) {
    if (n.identifier == "link") {
      detailsNodes.push(profileLink);
    } else {
      detailsNodes.push(n);
    }
  });

  details.structuredDataNodes = detailsNodes;
  nodes.push(details);
  updatedAsset.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes = nodes;
  delete updatedAsset.success
  return updatedAsset;
}

async function postAsset(uri, payload) {
  payloadObj = JSON.parse(payload);
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
      console.log(postOptions.headers['Content-Length'] + "\t" + payloadObj.asset.xhtmlDataDefinitionBlock.name);
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
