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
const SOURCE_DOCUMENT = "cos/cos-adjoint.xlsx";
const PAYLOAD_DOCUMENT = fs.readFileSync("json/faculty-block-minimum.json");
const LINK_GROUP = fs.readFileSync("json/link-section.json");
const POST_URI = "/api/v1/create";
var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

var tasks = [];
const workbook = XLSX.readFile(SOURCE_DOCUMENT);
console.dir(workbook.SheetNames);
const dataSheet = workbook.Sheets['adjoint'];
const sheetRange = XLSX.utils.decode_range(dataSheet['!ref']);
const maxRow = sheetRange.e.r;

console.log(maxRow);
for (let i = 2; i < (maxRow + 2); i++) {
  var newTask = {
    "last" : dataSheet['A'+i].v,
    "first" : dataSheet['B'+i].v,
    "name" : dataSheet['C'+i].v,
    "uri" : dataSheet['M'+i].v,
    //"faculty/_blocks/" + dataSheet['I'+i].v + "/" + dataSheet['C'+i].v,
    "parentFolderPath" : "faculty/_blocks/" + dataSheet['I'+i].v + "/adjoint",
    "displayName": dataSheet['B'+i].v + " " + dataSheet['A'+i].v,
    "email" : dataSheet['J'+i].v
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

function preparePayload(task, nodes) {
  var facultyBlock = JSON.parse(PAYLOAD_DOCUMENT);
  // console.log(JSON.stringify(data));
  // console.log("found department id: " + departmentID);
  const tags = [{"name": task.tag}, {"name": "adjoint"}];

  var newSDNS = [];
  facultyBlock.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes.map(function(sd) {
    if (sd.identifier == "details") {
      sd.structuredDataNodes = nodes;
    }
    newSDNS.push(sd);
  });
  // facultyBlock.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes = nodes;
  facultyBlock.asset.xhtmlDataDefinitionBlock.parentFolderPath = task.parentFolderPath;
  facultyBlock.asset.xhtmlDataDefinitionBlock.name = task.name;
  facultyBlock.asset.xhtmlDataDefinitionBlock['metadata'] = { 'displayName' : task.displayName};
  facultyBlock.asset.xhtmlDataDefinitionBlock.tags = tags;
  
  return facultyBlock;
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
