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
const TARGET_SITE = "UC-VPAA-ASC-HALSTORE";
const SEARCH_URI = "/api/v1/search";
const POST_URI = "/api/v1/create";
const GET_URI = "/api/v1/read";
var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

const PRIMARY_DEPARTMENT = "The Writing Program";

var searchInformation = {
  "searchInformation": {
    "siteName": "UC-VPAA-ASC-HALSTORE",
    "searchTerms": "faculty",
    "path": "faculty/_blocks",
    "searchTypes": ["block"]
  }
};

// for TESTING (single result)
// var searchInformation = {
// 	"searchInformation": {
//     "siteName": "UC-VPAA-ASC-HALSTORE",
// 		"searchTerms": "faculty/_blocks/twp/cruz-geneveva",
// 		"searchFields": ["path"],
// 		"searchTypes": [
// 			"block"
// 		]
// 	}
// }

//POST to SEARCH_URI with searchInformation as payload
//enumerate response
//create a task for each search result
//only create a task for profile block with a "faculty" tag
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
      if (r.path.path.indexOf('Former Faculty') < 0) {
        searchResults.push(r);
      }
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
    //grab task
    //grab block asset via REST GET
    //prepPayload for faculty page
    //create faculty profile page via REST POST

    console.log("GET asset at path: " + t.path.siteName + "/" + t.path.path);
    let assetFullPath = "/block/" + t.path.siteName + "/" + t.path.path;
    let blockAsset = await getAsset(assetFullPath);
    t.asset = blockAsset;
    var pass = false;
    t.asset.asset.xhtmlDataDefinitionBlock.tags.map(function (tag) {
      if (tag.name == "faculty") {
        pass = true;
      }
    });

    if (pass) {
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
  if (block.asset.xhtmlDataDefinitionBlock.siteName.indexOf('TWP') >= 0) {
    tagList.push("twp");
  }   

  var tags = [];
  tagList.map(function(t) {
    tags.push({ name: t })
  });
  return tags;
}