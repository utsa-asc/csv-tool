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

const POST_URI = "/api/v1/create";
var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

var tasks = [];
const departments = prepDepts(DEPTS);
const certificates = JSON.parse(CERTS);
console.dir(departments);

// certificates.map(function(c) {
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

JSON.parse(GRAD).map(function(c) {
  let taskData = c;
  taskData.type = "graduate";
  taskData.tag = "Graduate";
  tasks.push(taskData);
});

// JSON.parse(DOCT).map(function(c) {
//   let taskData = c;
//   taskData.type = "doctoral";
//   taskData.tag = "Doctoral";
//   tasks.push(taskData);
// });

completeTasks();

async function completeTasks() {
  var currentTask = {}
  try {
    for (let t of tasks) {
      currentTask = t;
      const payload = preparePayload(t);
      let stringPayload = JSON.stringify(payload);
      console.log(stringPayload);
      let postedAsset = await postAsset(POST_URI, stringPayload);
      console.log(postedAsset);
    }
  } catch (e) {
    console.log("Error while running tasks");
    console.log(e);
    console.dir(currentTask);
  }
}

function preparePayload(data) {
  var programBlock = JSON.parse(PAYLOAD_DOCUMENT);
  // console.log(JSON.stringify(data));
  const sdns = [
    {
      "type": "text",
      "identifier": "program",
      "text": data.title.rendered
    },
    {
      "type": "text",
      "identifier": "secondaryTitle",
      "text": data.yoast_head_json.title
    },
    {
      "type": "text",
      "identifier": "external",
      "text": data.link
    }
  ];
  var departmentSlug = departments[data.department[0]];
  const departmentID = data.department[0];
  if (departmentID) {
    departmentSlug = departments[departmentID].slug;
  }
  // console.log("found department id: " + departmentID);
  const tags = [{"name": data.tag}];
  if (departmentSlug) {
    tags.push({"name":departmentSlug});
  }
  programBlock.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes = sdns
  let parentFolderPath = "programs/_blocks/" + data.type;
  let name = data.slug
  programBlock.asset.xhtmlDataDefinitionBlock.parentFolderPath = parentFolderPath;
  programBlock.asset.xhtmlDataDefinitionBlock.name = name;
  programBlock.asset.xhtmlDataDefinitionBlock.tags = tags;
  return programBlock;
}

function prepDepts(data) {
  var results = {};
  const originData = JSON.parse(data);
  originData.map(function(element) {
    results[element.id] = {"name": element.name, "slug": element.slug};
  })
  return results;
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
      console.log(getOptions);
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
