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
const SOURCE_DOCUMENT = "cos/cos-problems-02.xlsx";
const PAYLOAD_DOCUMENT = fs.readFileSync("json/faculty-page-minimum.json");
const LINK_GROUP = fs.readFileSync("json/link-section.json");
const POST_URI = "/api/v1/create";
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
  console.log(i);
  var newTask = {
    "last" : dataSheet['A'+i].v,
    "first" : dataSheet['B'+i].v,
    "name" : dataSheet['C'+i].v.trim(),
    "uri" : "faculty/_blocks/" + dataSheet['I'+i].v + "/" + dataSheet['C'+i].v.trim(),
    "parentFolderPath" : "faculty/profiles",
    "displayName": dataSheet['B'+i].v + " " + dataSheet['A'+i].v,
    "email" : dataSheet['J'+i].v,
    "pageURI": "faculty/profiles/" + dataSheet['C'+i].v
  };
  if (dataSheet['D'+i]) {
    newTask['honorific'] = dataSheet['D'+i].v;
    newTask['displayName'] = newTask['displayName'] + ", " + newTask['honorific'];
  }
  if (dataSheet['E'+i]) {
    newTask['title'] = dataSheet['E'+i].v;
  }
  if (dataSheet['H'+i]) {
    newTask['department'] = dataSheet['H'+i].v;
  }
  if (dataSheet['I'+i]) {
    newTask['tag'] = dataSheet['I'+i].v;
  }
  if (dataSheet['K'+i]) {
    newTask['phone'] = dataSheet['K'+i].v;
  }
  if (dataSheet['L'+i]) {
    newTask['office'] = dataSheet['L'+i].v;
  }
  if (dataSheet['Q'+i]) {
    newTask['links'] = dataSheet['Q'+i].v;
  }
  if (dataSheet['F'+i]) {
    newTask['degrees'] = dataSheet['F'+i].v;
  }
  if (dataSheet['G'+i]) {
    newTask['research'] = dataSheet['G'+i].v;
  }
  if (dataSheet['P'+i]) {
    newTask['uuid'] = dataSheet['P'+i].v;
  }
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
      // console.dir(newSDNs);
      const payload = preparePayload(t);
      let stringPayload = JSON.stringify(payload);
      // console.log(stringPayload);
      if (DO_POST == "YES") {
        let postedAsset = await postAsset(POST_URI, stringPayload);
        console.log(postedAsset);
        if (postedAsset.success == false) {
          console.dir(task);
        }
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

function preparePayload(task) {
  var facultyBlock = JSON.parse(PAYLOAD_DOCUMENT);
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
            "identifier": "ariaLabel"
            
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
            "text": "New Window/Tab",            
          }
        ]
      };
      linkGroups.push(newLinkGroup);
    });
  }


  var nodes = [];
  facultyBlock.asset.page.structuredData.structuredDataNodes.map(function(sd) {
    if (sd.identifier == "block") {
      sd.blockPath = task['uri'];
    } 
    if (sd.identifier == "uuid") {
      if (task['uuid']) {
        sd['text'] = task.uuid;
      }
    } 
    if (sd.identifier == "links") {
      linkGroups.map(function(l) {
        sd.structuredDataNodes.push(l);
      });
    }
    //»
    if (sd.identifier == "researchInterests") {
      if(task['research']) {
        var researchStr = "<ul>";
        const rs = task['research'].split('\n');
        rs.map(function(r) {
          const cleanR = r.replaceAll('»', '');
          researchStr = researchStr + "<li>" + cleanR.trim() + "</li>";
        });
        researchStr = researchStr + "</ul>";
        sd['text'] = researchStr;
      }
    } 
    if (sd.identifier == "degrees") {
      if(task['degrees']) {
        var dStr = "";
        const ds = task['degrees'].split('\n');
        ds.map(function(d) {
          dStr = dStr + d.trim() + "<br/>";
        });
        sd['text'] = dStr;
      }
    }
    nodes.push(sd);
  });

  facultyBlock.asset.page.structuredData.structuredDataNodes = nodes;
  facultyBlock.asset.page.parentFolderPath = task.parentFolderPath;
  facultyBlock.asset.page.name = task.name;
  facultyBlock.asset.page['metadata'] = { 'displayName' : task.displayName, 'title' : task.displayName };
  
  return facultyBlock;
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
      console.log(postOptions.headers['Content-Length'] + "\t" + payloadObj.asset.page.name);
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
