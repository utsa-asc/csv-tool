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
const PAYLOAD_DOCUMENT = fs.readFileSync("json/faculty-block-minimum.json");
/* WP REST API constants */
const WP_HOST = "business.utsa.edu";
const WP_PORT = "443";
const WP_PATH = "/wp-json/wp/v2/";

var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}
const ROLE = "Faculty";

var tasks = [];

const DEPTS = fs.readFileSync("acob/directory-dept-test.json");
const departments = prepDepts(DEPTS);
// console.dir(departments);
let dkeys = Object.keys(departments);

// for each department
// - look up saved directly json
// - for each entry, create a task
var directories = [];
var tasks = [];

dkeys.map(function(k) {
    let slug = departments[k].slug;
    let name = departments[k].name;
    let newTask = {
        "id" : k,
        "slug" : slug,
        "name" : name,
        "data" : "acob/directory/" + k + "-" + slug + ".json"
    };
    console.log(newTask.id + ": " + newTask.slug);
    directories.push(newTask);
});

console.log(directories.length + " departments parsed");
directories.map(function(d) {
  let dirdata = JSON.parse(fs.readFileSync(d.data));
  console.log("dept has: " + dirdata.length + " entries");
  dirdata.map(function(p) {
    p.dslug = d.slug;
    p.department = d.name;
    tasks.push(p);
  });
});

completeTasks();

async function completeTasks() {
  var currentTask = {}
  try {
    for (let t of tasks) {
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
      */
      // console.dir(t);
      // console.dir(t.acf.department_role_repeater);
      var newPerson = t.acf;
      newPerson.uri = t.slug;
      newPerson.id = t.id;
      newPerson.status = t.status;
      newPerson.link = t.link;
      newPerson.json = t._links.self[0].href;
      newPerson.media = t._links['wp:featuredmedia'];
      newPerson.attachment = t._links['wp:attachment'];
      newPerson.department = t.department;
      newPerson.dslug = t.dslug;
      newPerson.content = t.content.rendered;
      // console.dir(newPerson);
      let roles = reduceRoles(newPerson);
      // console.dir(roles);
      let depts = reduceDepartments(newPerson);
      // console.dir(depts);
      newPerson.department = depts;
      newPerson.roles = roles;
      /*
      // $.media_details.sizes.full.source_url for original
      // $.media_details.sizes.medium_large.source_url for 768ish
      */
      // TODO let's leave headshot and CV download/upload to another task

      const payload = preparePayload(newPerson);

      //   older workflow
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

function reduceDepartments(p) {
  var depts = [];
  // console.log(p.department_role_repeater);
  p.department_role_repeater.map(function(r) {
    depts.push(r.department.toLowerCase());
  });
  return depts;
}

function reduceRoles(p) {
  var roles = [];
  // console.log(p.department_role_repeater);
  p.department_role_repeater.map(function(r) {
    // console.log(r.role);
    roles.push(r.role.toLowerCase());
  });
  return roles;
}

function preparePayload(data) {
  var block = JSON.parse(PAYLOAD_DOCUMENT);
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

function saveSnippet(content, fpath) {
  var snippetStream = fs.createWriteStream(fpath);
  snippetStream.write(content.prettify());
  snippetStream.end();
}

async function grabImage(url, fpath) {
  try {
    if (!fs.existsSync(fpath)) {
      let image_promise = getPromise(url, fpath);
      let image = await image_promise;
      console.log("attempting to save to disk:" + fpath);
      // fs.writeFileSync( fpath, image );
    } else {
      console.log("image already cached! " + fpath);
    }

    return true
  } catch (error) {
    console.log(error);
    console.log(url);
    return false
  }
}

function sanitizeTextHTML(inputText) {
  var contentStr = inputText.replaceAll('&euml;', '&#235;');
  contentStr = contentStr.replaceAll('<p>&#160;</p>', '');
  contentStr = contentStr.replaceAll('&rdquo;', '"');
  contentStr = contentStr.replaceAll('&ldquo;', '"');
  contentStr = contentStr.replaceAll('&nbsp;', ' ');
  contentStr = contentStr.replaceAll(/\u00a0/g, " ");
  contentStr = contentStr.replaceAll('&mdash;', '&#8212;');
  contentStr = contentStr.replaceAll('<br>', '<br/>');
  contentStr = contentStr.replaceAll('\n', '');
  return contentStr;
}

function sanitizeImageName(fileName) {
  fileName = fileName.toLowerCase()
  fileName = fileName.replaceAll('(', '');
  fileName = fileName.replaceAll(')', '');
  fileName = fileName.replaceAll('_', '-');
  fileName = fileName.replaceAll('-.', '.');
  return fileName;
}

function contentClean(content) {
  var contentStr = content.replace('&nbsp;', '&#160;');
  contentStr = contentStr.replace(/\u00a0/g, " ");
  contentStr = contentStr.replace('&mdash;', '&#8212;');
  contentStr = contentStr.replace('<br>', '<br/>');
  return contentStr;
}