/**
 * quick and dirty script to copy tags from blocks on WALLEDEV to WALLE
 * b/c import/export does not transfer tags
 */
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
const PAYLOAD_DOCUMENT = fs.readFileSync("json/faculty-page-minimum.json");
const TARGET_SITE = "PROVOST-VPAA-PROVWEB";
const TARGET_HOST = "walle.it.utsa.edu";
const TARGET_KEY = "85fbe845-c7d5-4e52-b9c7-4fa0214a97d2";
const REF_SITE = "PROVOST-VPAA-PROVWEB";
const REF_KEY = "c8186003-cc60-4eb3-a581-ae7330fe2f66";
const REF_HOST = "walledev.it.utsa.edu";
const SEARCH_URI = "/api/v1/search";
const POST_URI = "/api/v1/edit";
const GET_URI = "/api/v1/read/block/";
var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}
const MAX_CAT = 9;
const PRIMARY_DEPARTMENT = "The Writing Program";

var searchInformation = {
	"searchInformation": {
		"searchTerms": "resources-new/_service-blocks",
		"searchFields": [
			"path"
		],
		"searchTypes": [
			"block"
		]
	}
};

//POST to SEARCH_URI with searchInformation as payload
//enumerate response
//create a task for each search result

var start = 2;
var tasks = [];

while (start < MAX_CAT) {
  searchInformation.searchInformation.searchTerms = "resources-new/_service-blocks/0" + start;
  let searchPayload = JSON.stringify(searchInformation);
  generateTasks(searchPayload);
  start = start + 1;
}


async function generateTasks(payload) {
  var searchResults = [];
  console.dir(payload);

  let search = await postAsset(TARGET_HOST, CAS_PORT, TARGET_KEY, SEARCH_URI, payload) 
  var searchResultsObj = JSON.parse(search);
  try {
    // console.dir(search);
    searchResultsObj.matches.map(function(r) {
      // console.dir(r);
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
    console.log("copy tags from: " + t.path.siteName + "/" + t.path.path);
    let refFullPath = REF_SITE + "/" + t.path.path;
    let refBlock = await getAsset(REF_HOST, CAS_PORT, REF_KEY, refFullPath);
    console.log("found: " + refBlock.asset.xhtmlDataDefinitionBlock.tags.length + " tags");
    let targetFullPath = TARGET_SITE + "/" + t.path.path;
    var targetBlock = await getAsset(TARGET_HOST, CAS_PORT, TARGET_KEY, targetFullPath);
    // console.dir(targetBlock.asset.xhtmlDataDefinitionBlock.tags);
    targetBlock.asset.xhtmlDataDefinitionBlock.tags = refBlock.asset.xhtmlDataDefinitionBlock.tags; 
    let stringPayload = JSON.stringify(targetBlock);
    // console.log(stringPayload);
    if (POST == "YES") {
      let postedAsset = await postAsset(TARGET_HOST, CAS_PORT, TARGET_KEY, POST_URI, stringPayload);
      try {
        let respj = JSON.parse(postedAsset);
        if (respj.success == true) {
          console.log(respj);
          console.log("updated: " + respj.success + "\t");
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

function preparePayload(task) {
  var page = JSON.parse(PAYLOAD_DOCUMENT);
  var blockAsset = task.asset.asset.xhtmlDataDefinitionBlock;
  let uri = blockAsset.path;
  let name = blockAsset.name;
  let displayName = blockAsset.metadata.displayName;
  let textData = "";
  let office = "";
  let email = "";

  // console.dir(blockAsset);
  blockAsset.structuredData.structuredDataNodes.map(function(s) {
    if (s.identifier == "details") {
      s.structuredDataNodes.map(function(detail) {
        // console.dir(detail);
        if (detail.identifier == "wysiwyg") {
          textData = detail.text;
        }
        if (detail.identifier == "office") {
          office = detail.text;
        }
        if (detail.identifier == "email") {
          email = detail.text;
        }
      })
    }
  });

  var nodes = [];
  page.asset.page.structuredData.structuredDataNodes.map(function(sd) {
    if (sd.identifier == "block") {
      sd.blockPath = uri
    }  
    if (sd.identifier == "fullBio") {
      sd.text = textData;
    } 
    nodes.push(sd);
  });

  page.asset.page.structuredData.structuredDataNodes = nodes;
  page.asset.page.parentFolderPath = "faculty/profiles";
  page.asset.page.name = name;
  page.asset.page['metadata'] = { 'displayName' : displayName, 'title' : displayName };
  page.asset.page.siteName = TARGET_SITE;
  
  return page;
}

async function postAsset(host, port, key, uri, payload) {
  //do GET
  let postOptions = {
    hostname: host,
    port: port,
    path: uri,
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': payload.length,
        Authorization: ' Bearer ' + key
    }
  };
  if (port == 443) {
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

async function getAsset(host, port, key, uri) {
  //do GET
  let getOptions = {
    hostname: host,
    port: port,
    path: GET_URI + uri,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // 'Content-Length': postData.length,
      Authorization: ' Bearer ' + key
    }
  };
  if (port == 443) {
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
