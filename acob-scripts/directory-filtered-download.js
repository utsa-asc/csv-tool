const https = require('https');
const http = require('http');
const {execSync} = require('child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
var fs = require('fs');
const { stringify } = require('querystring');
var tasks = [];
require('dotenv').config();
/* defining some constants */
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const POST_URI = "/api/v1/create";
/* WP REST API constants */
const WP_HOST = "business.utsa.edu";
const WP_PORT = "443";
const WP_PATH = "/wp-json/wp/v2/";

var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

var tasks = [];

const DEPTS = fs.readFileSync("acob/directory-dept-single.json");
const departments = prepDepts(DEPTS);
// console.dir(departments);
let dkeys = Object.keys(departments);
// console.log(dkeys.length);
console.log(dkeys.length + " departments parsed");

dkeys.map(function(k) {
    let slug = departments[k].slug;
    let name = departments[k].name;
    let newTask = {
        "id" : k,
        "slug" : slug,
        "name" : name
    };
    console.log(newTask.id + ": " + newTask.slug);
    tasks.push(newTask);
});

completeTasks();

async function completeTasks() {
  var currentTask = {}
  try {
    for (let t of tasks) {
        //use task.id to build WP REST API URL path
        //use getURL(host, port, path) to grab JSON results
        //parse JSON, output results thru map
        //  - report datapoints needed for each person
        //  - build new WP REST API URL for individual
        //  - use getURL(host, port, path) to grab individual json file
        //  - save json file to disk for later processing

        //https://business.utsa.edu/wp-json/wp/v2/faculty?faculty_departments=30&per_page=100
        let options = {
            hostname: WP_HOST,
            port: WP_PORT,
            path: WP_PATH + "faculty?faculty_departments=" + t.id + "&per_page=100"    
        }
        let peopleIndex = await getURL(options);
        peopleIndex.map(function(p) {
            console.log("\n");
            console.log(p.slug);
            console.log(p.link);
            console.dir(p.acf.department_role_repeater);
            console.dir(p._links.self[0].href);
        });
        // data points to collect from WP JSON API Faculty object:
        /*
        id: numeric
        slug: uri string
        status: "publish"
        link: current business url
        title: { rendered: string }
        content: { rendered: string (html) }
        faculty_departments: [ num ] (corresponding to department-list ids, always an array)
        acf:
            - first_name
            - last_name
            - faculty_title
            - faculty_email
            - faculty_phone
            - faculty_fax
            - faculty_office_number
            - faculty_pdf: num???
            - department_role_repeater: [ { department: string, role: string }]
        _links: { self: { href: string } } link to JSON api endpoint
        _links: { wp:attachment [{ href: string }] media url (headshot)
        // $.media_details.sizes.full.source_url for original
        // $.media_details.sizes.medium_large.source_url for 768ish
        */
    //   currentTask = t;
    //   const payload = preparePayload(t);
    //   let stringPayload = JSON.stringify(payload);
    //   console.log(stringPayload);
    //   let postedAsset = await postAsset(POST_URI, stringPayload);
    //   console.log(postedAsset);
    }
  } catch (e) {
    console.log(e);
    console.log("Error while running tasks:");
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

async function getURL(options) {
    var getOptions = options;
    getOptions['method'] = 'GET';
    getOptions['headers'] = {
        'Content-Type': 'application/json'
    };
    if (getOptions.port == 443) {
        getOptions.requestCert = false;
        getOptions.rejectUnauthorized = false;
    }
    let p = new Promise((resolve, reject) => {
        const req = protocol.request(getOptions, (response) => {
            console.log(getOptions);
            let chunks_of_data = [];
            response.on('data', (fragments) => {
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
