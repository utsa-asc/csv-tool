/* Image Process Tasks:
    // refinement from HCAP tasks, only focusing on image download and content rewriting of <img> src attributes
    // we save html entity and category fixing for other steps
  0) read incoming CSV
  1) read snippet html from local disk
  2) find any <img> in snippet content
  3) download any image src references to local disk
  4) rewrite img src attributes with new upload location "/<yyyy>/images/<image-file-name>"
  5) save updated snippet content
  */
  //"Apr 18, 2022, 8:09:58 PM", we will need to parse our target date based on the current article's post date
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const https = require('https');
const http = require('http');
var fs = require('fs');
const SOURCE_DIR = "/Users/garza/Downloads/tmp/car-resized";
const PAYLOAD_DOCUMENT = fs.readFileSync("json/file-update.json");
require('dotenv').config();
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const GET_URI = "/api/v1/read/file/FILE-BLOB-TESTING";
const POST_URI = "/api/v1/edit";
var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}
var tasks = [];
fs.readdir(SOURCE_DIR, function (err, files) {
  //handling error
  if (err) {
      return console.log('Unable to scan directory: ' + err);
  } 
  //listing all files using forEach
  files.forEach(function (f) {
      // Do whatever you want to do with the file
      if (f.indexOf('.pdf') > 0) {
        let taskData = {
          "filePath": SOURCE_DIR + "/" + f,
          "fileName": f,
          "assetURL": "/_documents/car/" + f
        }
        tasks.push(taskData);
        console.log("adding: " + f + " to tasks"); 
      }
  });
  completeTasks();
});


async function completeTasks() {
  var currentTask = {};
  try {
    for (let t of tasks) {
      currentTask = t;
      let updatedAsset = updateAsset(t);
      console.log("POST ASSET: " + t.fileName);
      // console.log(updatedAsset);
      let jsonPayload = JSON.stringify({asset: updatedAsset.asset});
      let postedAsset = await postAsset(POST_URI, jsonPayload);
      console.log(postedAsset);
    }  
  } catch (e) {
    console.log("error with task");
    console.log(currentTask);
  }
}

function updateAsset(task) {
  var updated = JSON.parse(PAYLOAD_DOCUMENT);
  var updatedContent = getByteArray(SOURCE_DIR + "/" + task.fileName);
  updated.asset.file.path = task.assetURL;
  updated.asset.file.data = updatedContent;
  return updated;
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

function getByteArray(fpath){
  let fdata = fs.readFileSync(fpath).toString('hex');
  var arrByte = new Int8Array(Buffer.from(fdata, 'hex'));
  var simpleArray = [].slice.call(arrByte)
  // console.log(arrByte);
  // console.log(simpleArray);
  return simpleArray;
}