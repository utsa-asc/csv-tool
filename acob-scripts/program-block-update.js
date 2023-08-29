const https = require('https');
const http = require('http');
const {execSync} = require('child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
var fs = require('fs');
var tasks = [];
require('dotenv').config();
/* defining some constants */
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const PAYLOAD_DOCUMENT = fs.readFileSync("json/program-block-minimum.json");
const DEPTS = fs.readFileSync("cos/departments.json");
const CERTS = fs.readFileSync("cos/certificate.json");
const UGRAD = fs.readFileSync("cos/undergraduate.json");
const GRAD = fs.readFileSync("cos/graduate.json");
const DOCT = fs.readFileSync("cos/doctoral.json");
const TEST = fs.readFileSync("cos/test.json");
const GET_URI = "/api/v1/read/block/COS-VPAA-ASC-HALSTORE/programs/_blocks/"
const POST_URI = "/api/v1/edit";
var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

var tasks = [];
// const departments = prepDepts(DEPTS);
// console.dir(departments);

// JSON.parse(CERTS).map(function(c) {
//   let taskData = c;
//   taskData.type = "certificate";
//   taskData.tag = "Certificate";
//   tasks.push(taskData);
// });

// JSON.parse(UGRAD).map(function(c) {
//   let taskData = c;
//   taskData.type = "undergraduate";
//   taskData.tag = "Undergraduate";
//   tasks.push(taskData);
// });

// JSON.parse(GRAD).map(function(c) {
//   let taskData = c;
//   taskData.type = "graduate";
//   taskData.tag = "Graduate";
//   tasks.push(taskData);
// });

JSON.parse(DOCT).map(function(c) {
  let taskData = c;
  taskData.type = "doctoral";
  taskData.tag = "Doctoral";
  tasks.push(taskData);
});

// JSON.parse(TEST).map(function(c) {
//   let taskData = c;
//   taskData.type = "graduate";
//   taskData.tag = "Graduate";
//   tasks.push(taskData);
// });
completeTasks();

async function completeTasks() {
  var currentTask = {}
  try {
    for (let t of tasks) {
      currentTask = t;
      const uri = t.type + "/" + t.slug;
      console.log("GET uri: " + uri);
      const assetJSON = await getAsset(uri);
      // console.dir(assetJSON);
      const payload = preparePayload(t, assetJSON);
      let stringPayload = JSON.stringify(payload);
      // console.log(stringPayload);
      let postedAsset = await postAsset(POST_URI, stringPayload);
      console.log(postedAsset);
    }
  } catch (e) {
    console.log("Error while running tasks");
    console.log(e);
    console.dir(currentTask);
  }
}

function preparePayload(data, payloadJSON) {
  var programBlock = payloadJSON;
  // console.log(JSON.stringify(data));
  const filePath = "images/programs/" + data.type + "-" + data.slug + ".jpg";
  const newImage = {
    "type": "group",
    "identifier": "image",
    "structuredDataNodes": [
      {
        "type": "asset",
        "identifier": "file",
        "filePath": filePath,
        "assetType": "file"
      },
      {
        "type": "text",
        "identifier": "alt",
        "text": data.yoast_head_json.title
      }
    ]
  }

  var newSDNs = [];
  programBlock.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes.map(function(d) {
    if (d.identifier == "image") {
      newSDNs.push(newImage);
    } else {
      newSDNs.push(d);
    }
  });
  programBlock.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes = newSDNs;

  return programBlock;
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
