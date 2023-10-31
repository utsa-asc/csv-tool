const https = require('https');
const http = require('http');
const {execSync} = require('child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
var fs = require('fs');
var tasks = [];
require('dotenv').config();
/* defining some constants */
const POST = process.env.POST;
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const PAYLOAD_DOCUMENT = fs.readFileSync("json/faculty-block-minimum.json");
const TARGET_SITE = "UC-VPAA-ASC-HALSTORE"
const DEPTS = fs.readFileSync("uc/departments.json");
const UGRAD = fs.readFileSync("uc/undergraduate.json");
// const GRAD = fs.readFileSync("acob/graduate.json");
// const DOCT = fs.readFileSync("acob/doctoral.json");
const TEST = fs.readFileSync("uc/test.json");
const SEARCH_URI = "/api/v1/search";
const POST_URI = "/api/v1/create";
const GET_URI = "/api/v1/read";
var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

var searchInformation = {
  "searchInformation": {
		"siteName":"UNIVERSITY-COLLEGE-VPAA-WWWROOT",
    "searchTerms":"_staff",
    "path": "_staff/cordova-lisa",
    "searchTypes": ["block"]
  }
};

var searchInformation = {
  "searchInformation": {
    "searchTerms": "_faculty _staff",
    "siteName": "TWP-VPAA-WWWROOT",
    "searchTypes": [
      "block"
    ]
  }
};

//for TESTING (single result)
// searchInformation = {
// 	"searchInformation": {
// 		"siteName": "UNIVERSITY-COLLEGE-VPAA-WWWROOT",
// 		"searchTerms": "ais/_staff/grace-morgan",
// 		"searchFields": [ "path"],
// 		"searchTypes": [
// 			"block"
// 		]
// 	}
// }

//POST to SEARCH_URI with searchInformation as payload
//enumerate response
//create a task for each search result

var tasks = [];
let searchPayload = JSON.stringify(searchInformation);
tasks = generateTasks();

async function generateTasks() {
  var searchResults = [];
  let search = await postAsset(SEARCH_URI, searchPayload) 
  var searchResultsObj = JSON.parse(search);
  try {
    // console.dir(search);
    searchResultsObj.matches.map(function(r) {
      console.log("pushing result: " + r.path.path);
      searchResults.push(r);
    });
  } catch(e) {
    console.log("unable to complete initial search to build task list");
    console.log(e);
    console.dir(e);
  }

  executeTasksConcurrently(searchResults);
  return searchResults;
}

// executeTasksConcurrently(tasks);

async function executeTasksConcurrently(
  list
) {
  let activeTasks = [];
  let concurrencyLimit = 100;

  for (const item of list) {
    if (activeTasks.length >= concurrencyLimit) {
      await Promise.race(activeTasks);
    }
    // console.log(`Start task: ${item}`);
    // console.dir(item);
    // wait 0.25 secs between launching new async task b/c Cascade chokes, otherwise...
    await delay(500);

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
  try {
    //grab task asset via a GET to path
    //preparePayload(asset)
    //POST new asset
    // console.dir(t);
    console.log("GET asset at path: " + t.path.siteName + "/" + t.path.path);
    let assetFullPath = "/block/" + t.path.siteName + "/" + t.path.path;
    let blockAsset = await getAsset(assetFullPath);
    t.asset = blockAsset;

    const payload = preparePayload(t);
    let stringPayload = JSON.stringify(payload);
    // console.log(stringPayload);
    if (POST == "YES") {
      let postedAsset = await postAsset(POST_URI, stringPayload);
      try {
        let respj = JSON.parse(postedAsset);
        if (respj.success == true) {
          console.log(respj);
          console.log("created: " + respj.success + "\t" + respj.createdAssetId);
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
    } else {
      console.log("skipping POST");
    }
  } catch (e) {
    console.log(e);
    console.log("Error while running tasks:");
    console.dir(t);
  }
  return t;
}

function preparePayload(data) {
  var oldBlock = data.asset;
  let stringBlock = JSON.stringify(oldBlock);
  // console.log(stringBlock);

  var facultyBlock = JSON.parse(PAYLOAD_DOCUMENT);
  var detailsSDNs = [];
  var imageSDNs = [];
  var fullName = "";
  var fullTitle = "";

  oldBlock.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes[0].structuredDataNodes.map(function(detail) {
    // console.log("\t", detail);
    if (detail.identifier=="fullName") {
      fullName = detail.text;
      facultyBlock.asset.xhtmlDataDefinitionBlock.metadata.displayName = detail.text;
    }
    if (detail.identifier=="headshot") {
      imageSDNs.push({
        "type": "asset",
        "identifier": "file",
        "filePath": detail.filePath,
        "assetType": "file"
      });
      imageSDNs.push({
        "type": "text",
        "identifier": "alt",
        "text": fullName
      });
    }
    if (detail.identifier=="title") {
      fullTitle = fullTitle + detail.text;
    }
    if (detail.identifier=="title2") {
      if (detail.text != undefined) {
        fullTitle = fullTitle + ", " + detail.text;      
      }
    }
    if (detail.identifier=="email") {
      detailsSDNs.push({
        "type": "text",
        "identifier": "email",
        "text": detail.text
      });
    }
    if (detail.identifier=="campusAddress1") {
      detailsSDNs.push(							{
        "type": "text",
        "identifier": "office",
        "text": detail.text
      });
    }
  });
  detailsSDNs.push({
    "type": "text",
    "identifier": "title",
    "text": fullTitle
  })      

  facultyBlock.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes.map(function(d) {
    if (d.identifier == "details") {
      d.structuredDataNodes = detailsSDNs;
    }
    if (d.identifier == "image") {
      d.structuredDataNodes = imageSDNs;
    }
  });

  // console.log("done constructing SDNs");
  facultyBlock.asset.xhtmlDataDefinitionBlock.siteName = TARGET_SITE;
  facultyBlock.asset.xhtmlDataDefinitionBlock.tags = generateTags(oldBlock);
  facultyBlock.asset.xhtmlDataDefinitionBlock['parentFolderPath'] = "faculty/_blocks/" + oldBlock.asset.xhtmlDataDefinitionBlock.parentFolderPath;
  facultyBlock.asset.xhtmlDataDefinitionBlock.name = oldBlock.asset.xhtmlDataDefinitionBlock.name;

  return facultyBlock;
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

function generateTags(block) {
  var tagList = [];
  tagList.push("Faculty");
  if (block.asset.xhtmlDataDefinitionBlock.parentFolderPath.indexOf('ais') >= 0) {
    tagList.push("ais");
  } 
  var tags = [];
  tagList.map(function(t) {
    tags.push({ name: t })
  });
  return tags;
}