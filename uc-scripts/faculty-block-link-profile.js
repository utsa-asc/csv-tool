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
const POST_URI = "/api/v1/edit";
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
    "path": "faculty/profiles",
    "searchTypes": ["page"]
  }
};

// for TESTING (single result)
// var searchInformation = {
// 	"searchInformation": {
//     "siteName": "UC-VPAA-ASC-HALSTORE",
// 		"searchTerms": "faculty/profiles/cruz-geneveva",
// 		"searchFields": ["path"],
// 		"searchTypes": [
// 			"page"
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
    //grab task
    //grab page asset via REST GET
    //lookup profile block path
    //grab block asset via REST GET
    //prepPayload
    // - update profile block with profile page url
    // - wipe any wysiwyg from the block
    //update profile block vai REST POST

    console.log("GET asset at path: " + t.path.siteName + "/" + t.path.path);
    let assetFullPath = "/page/" + t.path.siteName + "/" + t.path.path;
    let pageAsset = await getAsset(assetFullPath);

    t.page = pageAsset.asset.page;
    // console.dir(t.page);
    let sdns = t.page.structuredData.structuredDataNodes;
    t.targetBlock = "";
    t.pagePath = t.page.path;
    sdns.map(function(s) {
      if (s.identifier == "block") {
        t.targetBlock = s.blockPath;
      }
    });

    let blockFullPath = "/block/" + t.path.siteName + "/" + t.targetBlock;
    let blockAsset = await getAsset(blockFullPath);
    t.block = blockAsset;

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

function preparePayload(task) {
  var block = task.block;
  // console.dir(block);
  const profileLinkSDNs = [
    {
      "type": "text",
      "identifier": "type",
      "text": "internal",
      "recycled": false
    },
    {
      "type": "text",
      "identifier": "label",
      "text": block.asset.xhtmlDataDefinitionBlock.metadata.displayName + " Profile Page"
    },
    {
      "type": "asset",
      "identifier": "internal",
      "pagePath": task.page.path,
      "assetType": "page,file,symlink"
    },
    {
      "type": "text",
      "identifier": "target",
      "text": "Parent Window/Tab"
    }
  ];

  block.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes.map(function(d) {
    if (d.identifier == "details") {
      d.structuredDataNodes.map(function(detail) {
        // console.log(detail.identifier);
        if (detail.identifier == "link") {
          detail.structuredDataNodes = profileLinkSDNs;
        }
        if (detail.identifier == "wysiwyg") {
          detail.text = "";
        }
      })
    }
  });
  return block;
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