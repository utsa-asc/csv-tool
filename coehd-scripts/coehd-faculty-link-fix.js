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
const SOURCE_DOCUMENT = "coehd/coehd-faculty.xlsx";
const PAYLOAD_DOCUMENT = fs.readFileSync("json/faculty-block-minimum.json");
const POST_URI = "/api/v1/edit";
const GET_URI = "/api/v1/read/block/COEHD-VPAA-DLS-HALSTORE/"
var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

var tasks = [];
const workbook = XLSX.readFile(SOURCE_DOCUMENT);
console.dir(workbook.SheetNames);
const dataSheet = workbook.Sheets['Sheet1'];
const sheetRange = XLSX.utils.decode_range(dataSheet['!ref']);
const maxRow = sheetRange.e.r;

console.log(maxRow);
for (let i = 2; i < (maxRow + 2); i++) {
  var newTask = {
    "uri" : dataSheet['F'+i].v.trim(),
    "tag" : dataSheet['J'+i].v,
    "displayName": cleanText(dataSheet['G'+i].v)
  };
  newTask['blockURI'] = generateBlockURI(newTask);
  // console.dir(newTask);
  // if (newTask.tag == 'counseling') {
    tasks.push(newTask);
  // }
}
completeTasks();

async function completeTasks() {
  var currentTask = {}
    for (let t of tasks) {
      try {
        currentTask = t;
        // GET block
        var asset = await getAsset(t.blockURI);
        // update block
        asset =  updateLink(asset, t);
        // POST block
        let stringPayload = JSON.stringify(asset);
        // console.log(stringPayload);
        if (DO_POST == "YES") {
          let postedAsset = await postAsset(POST_URI, stringPayload);
          console.log(postedAsset);
        } else {
          console.log("POST IS NO");
        }
      } catch (e) {
        console.log("Error while running task");
        console.log(e);
        console.dir(currentTask);
      }
  }
}

function generateBlockURI(task) {
  var blockURI ="faculty/_blocks/" + task.tag + "/" + task.uri;
  return blockURI;
}

function updateLink(asset, task) {
  var updatedAsset = asset;
  var blockSDNs = [];
  var detailsSDNs = [];
  var linkSDNs = [];

  var details = {};
  var linkNodes = {};

  updatedAsset.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes.map(function(d) {
    if (d.identifier == "details") {
      details = d;
      // console.dir(d);
    } else {
      blockSDNs.push(d);
    }
  });
  details.structuredDataNodes.map(function(n) {
    if (n.identifier == "link") {
      linkNodes = n;
    } else {
      detailsSDNs.push(n);
    }
  });
  // console.dir(linkNodes);

  linkNodes.structuredDataNodes.map(function(l) {
    if (l.identifier == "type") {
      console.dir(l);
      l.text = "internal";
    }
    if (l.identifier == "label") {
      l.text = "Profile for " + task.displayName;
    }
    if (l.identifier == "internal") {
      delete l.pageId;
      l.identifier = "internal";
      l.pagePath = "faculty/profiles/" + task.uri;
    }
    linkSDNs.push(l);
  });

  linkNodes.structuredDataNodes = linkSDNs;  
  // console.log("updated link nodes:");
  // console.dir(linkNodes);
  detailsSDNs.push(linkNodes);
  details.structuredDataNodes = detailsSDNs;
  blockSDNs.push(details);
  updatedAsset.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes = blockSDNs;
  delete updatedAsset.success;

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
        try {
          let responseObj = JSON.parse(responseString);
          resolve(responseObj);
        } catch (e) {
          console.log('caught non json response');
          console.dir(e);
          resolve({'error':"non json response returned", "success":false});
        }
			});

			response.on('error', (error) => {
				reject(error);
			});
    });
    req.end();
  });
  return await p;
}

function cleanText(content) {
  var contentStr = content.replaceAll('&nbsp;', '&#160;');
  contentStr = contentStr.replace(/\u00a0/g, " ");
  //curly quote unicode character, double quotes
  
  contentStr = contentStr.replace(/\u2018/g, "&#8216;");
  contentStr = contentStr.replace(/\u2019/g, "&#8217;");
  contentStr = contentStr.replace(/\u201C/g, "&#8220;");
  contentStr = contentStr.replace(/\u201D/g, "&#8221;");
  contentStr = contentStr.replaceAll('—', '&#8212;');
  //mdash
  contentStr = contentStr.replaceAll('&mdash;', '&#8212;');
  //unclosed breaks
  contentStr = contentStr.replaceAll('<br>', '<br/>');
  contentStr = contentStr.replace(/\u2013/g, "-");
  contentStr = contentStr.replaceAll('/\u00ad/g', '-');
  //ñ, ó, ü, é
  contentStr = contentStr.replaceAll('ñ', "&#241;");
  contentStr = contentStr.replaceAll('á', '&#225;');
  contentStr = contentStr.replaceAll('á', '&#225;');
  contentStr = contentStr.replaceAll('ó', '&#243;');
  contentStr = contentStr.replaceAll('ú', '&#250;');
  contentStr = contentStr.replaceAll('ü', '&#252;');
  contentStr = contentStr.replaceAll('ö', '&#246;');
  contentStr = contentStr.replaceAll('é', '&#233;');
  contentStr = contentStr.replaceAll('í', '&#237;')
  contentStr = contentStr.replaceAll('“', '&ldquo;');
  contentStr = contentStr.replaceAll('”', '&rdquo;');
  contentStr = contentStr.replaceAll('•', '&#183;');
  contentStr = contentStr.replaceAll('’', '&#8217;');
  contentStr = contentStr.replaceAll('‘', '&#8216;');
  contentStr = contentStr.replaceAll('°', '&#176;');
  contentStr = contentStr.replaceAll('®', '&#174;');
  contentStr = contentStr.replace('/\r?\n|\r/g', '');
  contentStr = contentStr.replaceAll('…', '&#8230;');  
  contentStr = contentStr.replaceAll(' ­­­', ' ');
  contentStr = contentStr.replaceAll('ê', '&#234;');
  contentStr = contentStr.replaceAll('Å', '&#197;');
  
  contentStr = contentStr.replaceAll('É', '&#201;');

  return contentStr;
}