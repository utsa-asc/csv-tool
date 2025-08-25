// const https = import('https');
import https from 'https';
// const http = import('http');
import http from 'http';
const {execSync} = import('child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

var tasks = [];
import dotenv from 'dotenv'
dotenv.config()
// require('dotenv').config();
/* defining some constants */
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const DO_POST = process.env.POST;

const TARGET_FOLDER = "faculty/_blocks/statistics-data-science/faculty";
const TARGET_TAGS = [{"name": "faculty"}, {"name": "statistics-and-data-science"}];
var GET_URI = "/api/v1/read/folder/SDS-VPAA-ASC-DLS-HALSTORE/";
const POST_URI = "/api/v1/edit";

var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

var tasks = [];
tasks = generateTasks();

// READ folder and get all children

// for each child block, add a task to apply TARGET_TAGS

// console.log(maxRow);
// for (let i = 2; i < (maxRow + 2); i++) {
//   var newTask = {
//     "last" : dataSheet['A'+i].v,
//     "first" : dataSheet['B'+i].v,
//     "name" : dataSheet['C'+i].v,
//     "uri" : dataSheet['M'+i].v,
//     //"faculty/_blocks/" + dataSheet['I'+i].v + "/" + dataSheet['C'+i].v,
//     "parentFolderPath" : "faculty/_blocks/" + dataSheet['I'+i].v + "/adjoint",
//     "displayName": dataSheet['B'+i].v + " " + dataSheet['A'+i].v,
//     "email" : dataSheet['J'+i].v
//   };
//   if (dataSheet['D'+i]) {
//     newTask['honorific'] = dataSheet['D'+i].v;
//     newTask['displayName'] = newTask['displayName'] + ", " + newTask['honorific'];
//   }
//   if (dataSheet['E'+i]) {
//     newTask['title'] = dataSheet['E'+i].v;
//   }
//   if (dataSheet['H'+i]) {
//     newTask['department'] = dataSheet['H'+i].v;
//   }
//   if (dataSheet['I'+i]) {
//     newTask['tag'] = dataSheet['I'+i].v;
//   }
//   if (dataSheet['K'+i]) {
//     newTask['phone'] = dataSheet['K'+i].v;
//   }
//   if (dataSheet['L'+i]) {
//     newTask['office'] = dataSheet['L'+i].v;
//   }
//   if (dataSheet['Q'+i]) {
//     newTask['links'] = dataSheet['Q'+i].v;
//   }
//   // console.dir(newTask);
//   tasks.push(newTask);
// }
// console.dir(testSheet.Workbook.Names);
// console.log(testSheet);
// completeTasks();

// CORRECT FULL PATH:
// https://walledev.it.utsa.edu
// /api/v1/read/folder/SDS-VPAA-ASC-DLS-HALSTORE/faculty/_blocks/computer-science/faculty
// message: "Unable to identify an entity based on provided entity path 
// 'faculty/_blocks/computer-science/faculty' and type 'folder'"
async function generateTasks() {
  var blocks = [];
  // var folder_uri = GET_URI + TARGET_FOLDER;
  let folder = await getAsset(TARGET_FOLDER);
  // console.log("******");
  // console.log(folder.asset.folder.children);
  // console.log("******");
  // var folderResultsObj = JSON.parse(folder);
  try {
    var blocks = folder.asset.folder.children;
    blocks.map(function(r) {
      console.log("pushing result: " + r.path.path);
      blocks.push(r);
    });
  } catch(e) {
    console.log("unable to complete initial folder read to build task list");
    console.log(e);
    console.dir(e);    
  }
  executeTasksConcurrently(blocks);
  return blocks;
}

async function executeTasksConcurrently(
  list
) {
  let activeTasks = [];
  let concurrencyLimit = 5;

  for (const item of list) {
    if (activeTasks.length >= concurrencyLimit) {
      await Promise.race(activeTasks);
    }
    console.log(`Start task: ${item.path.path}`);
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
    //READ block asset via REST GET
    GET_URI = "/api/v1/read/block/SDS-VPAA-ASC-DLS-HALSTORE/";
    let block = await getAsset(t.path.path);
    // console.dir(block);

    //prepPayload
    // - add tags
    //update block asset via REST POST
    const payload = preparePayload(t, block);
    let stringPayload = JSON.stringify(payload);
    console.log("modified tags: ");
    console.dir(payload.asset.xhtmlDataDefinitionBlock.tags);
    if (DO_POST == "YES") {
      let postedAsset = await postAsset(POST_URI, stringPayload);
      try {
        let respj = JSON.parse(postedAsset);
        if (respj.success == true) {
          console.log(respj);
          console.log("POST RESPONSE success: " + respj.success);
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


async function completeTasks() {
  var currentTask = {}
  try {
    for (let t of tasks) {
      currentTask = t;
      const newSDNs = prepareDetails(currentTask);
      // console.dir(newSDNs);
      const payload = preparePayload(t, newSDNs);
      let stringPayload = JSON.stringify(payload);
      console.log(stringPayload);
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

function prepareDetails(task) {
  var linkGroups = [];
  if (task.links) {
    const links = task.links.split('\n');
    links.map(function(l) {
      const parts = l.split('|');
      const linkLabel = parts[0].trim();
      const linkValue = parts[1].trim();
      var newLinkGroup = {
        "type": "group",
        "identifier": "link",
        "structuredDataNodes": [
          {
            "type": "text",
            "identifier": "label",
            "text": linkLabel
          },
          {
            "type": "text",
            "identifier": "type",
            "text": "external"
          },
          {
            "type": "text",
            "identifier": "external",
            "text": linkValue
          },
          {
            "type": "text",
            "identifier": "target",
            "text": "Parent Window/Tab"
          }
        ]
      };
      linkGroups.push(newLinkGroup);
    });
  }

  //fill in with data from task, should be 1:1 with columns in row data
  var sdns = [
    {
      "type": "text",
      "identifier": "title",
      "text": task.title
    },
    {
      "type": "text",
      "identifier": "primaryDepartment",
      "text": task.department
    },
    {
      "type": "text",
      "identifier": "phone",
      "text": task.phone
    },
    {
      "type": "text",
      "identifier": "email",
      "text": task.email
    },
    {
      "type": "text",
      "identifier": "office",
      "text": task.office
    },
    {
      "type": "text",
      "identifier": "wysiwyg"
    },
    {
      "type": "group",
      "identifier": "cvlink",
      "structuredDataNodes": [
      ]
    }
  ];

  if (linkGroups.length > 0) {
    linkGroups.map(function (lg) {
      sdns.push(lg);
    });  
  }

  //for each link, create a copy of link group and append to sdns
  return sdns;
};

function preparePayload(task, block) {
  var facultyBlock = block;
  // const tags = [{"name": task.tag}, {"name": "adjoint"}];
  facultyBlock.asset.xhtmlDataDefinitionBlock.tags = TARGET_TAGS;
  return facultyBlock;
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
      console.log(postOptions.headers['Content-Length']);
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
