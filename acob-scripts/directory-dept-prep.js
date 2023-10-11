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
const POST = process.env.POST;
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

const DEPTS = fs.readFileSync("acob/directory-dept-list-admin.json");
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
    console.log("adding task: " + p);
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
      // console.log("starting task: " + t.id);
      var person = parsePersonData(t);
      // console.log("prep payload: " + t.id);
      const payload = preparePayload(person);
      let stringPayload = JSON.stringify(payload);
      // console.log(stringPayload);
      if (POST == "YES") {
        let postedAsset = await postAsset(POST_URI, stringPayload);
        try {
          let respj = JSON.parse(postedAsset);
          if (respj.success == true) {
            // console.log(postedAsset);
            console.log("created: " + respj.createdAssetId + ": " + payload.asset.xhtmlDataDefinitionBlock.name);
          } else {
            console.log("****ERROR****");
            console.log(postedAsset);
            console.log(stringPayload);
            // console.dir(payload);
          }
        } catch (e) {
          console.log("POST failed to return a JSON response");
          console.log(e);
        }
      } else {
        console.log("skipping POST");
      }
    }
  } catch (e) {
    console.log(e);
    console.log("Error while running tasks:");
    console.dir(currentTask);
  }
}

function parsePersonData(t) {
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
      newPerson.fullname = t.title.rendered;
      newPerson.id = t.id;
      newPerson.status = t.status;
      newPerson.link = t.link;
      newPerson.json = t._links.self[0].href;
      newPerson.media = t._links['wp:featuredmedia'];
      newPerson.attachment = t._links['wp:attachment'];
      newPerson.topd = t.department;
      newPerson.dslug = t.dslug;
      newPerson.content = t.content.rendered;
      // console.dir(newPerson);
      let roles = reduceRoles(newPerson);
      // console.dir(roles);
      let depts = reduceDepartments(newPerson);
      // console.dir(depts);
      newPerson.department = depts;
      newPerson.roles = roles;
      return newPerson;
      /*
      // $.media_details.sizes.full.source_url for original
      // $.media_details.sizes.medium_large.source_url for 768ish
      */
      // TODO let's leave headshot and CV download/upload to another task
}

function reduceDepartments(p) {
  var depts = [];
  // console.log(p.department_role_repeater);
  try {
    p.department_role_repeater.map(function(r) {
      depts.push(r.department.toLowerCase());
    });
  } catch (e) {
    depts = [];
  }
  return depts;
}

function reduceRoles(p) {
  var roles = [];
  // console.log(p.department_role_repeater);
  try {
    p.department_role_repeater.map(function(r) {
      // console.log(r.role);
      roles.push(r.role.toLowerCase());
    });  
  } catch (e) {
    roles = [];
  }
  return roles;
}

function createTags(depts, roles) {
  var tags = [];
  depts.map(function(d) {
    let dtag = d.replaceAll(' ', '-').replaceAll("'", "").trim();
    tags.push({ name: dtag });
  });

  roles.map(function(r) {
    tags.push({ name: r});
  });
  return tags;
}

function createFolderPath(p) {
  //potential roles:
  // Faculty | Staff | Administrators | Doctoral Students | Emeritus Faculty
  var folderPath = "faculty/_blocks/" + p.dslug.toLowerCase() + "";
  folderPath = folderPath.replaceAll(' ', '-');
  // console.dir(p.roles);
  if (p.roles.includes('faculty')) {
    //going to assume emeritus also goes in faculty
  } else if (p.roles.includes('staff')) {
    //always use staff first even if they are also student (below)
    folderPath = folderPath + "/staff";
  } else if (p.roles.includes('doctoral students')) {
    folderPath = folderPath + "/student";
  }
  return folderPath;
}

function generateSlug(data) {
  var newSlug = data.last_name.toLowerCase().trim() + "-" + data.first_name.toLowerCase().trim();
  newSlug = newSlug.replace(/[^a-z -]/gi, '');
  newSlug = newSlug.replaceAll(' ', '-');
  newSlug = newSlug.replaceAll(',', '-');
  return newSlug;
}

function preparePayload(data) {
  // console.log("*** preparePayload ***");
  // console.dir(data);
  var block = JSON.parse(PAYLOAD_DOCUMENT);
  block.asset.xhtmlDataDefinitionBlock.metadata.displayName = data.fullname;
  block.asset.xhtmlDataDefinitionBlock.parentFolderPath = createFolderPath(data);
  block.asset.xhtmlDataDefinitionBlock.tags = createTags(data.department, data.roles);
  var newSlug = generateSlug(data);
  block.asset.xhtmlDataDefinitionBlock.name = newSlug;

  var sdns = block.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes;
  sdns.map(function(node) {
    if (node.identifier == "details") {
      node.structuredDataNodes.map(function(detailNode) {
        if (detailNode.identifier == "title") {
          detailNode.text = data.faculty_title;
          detailNode.text = detailNode.text.replaceAll('<br/>', '<br>');
          detailNode.text = detailNode.text.replaceAll(' <br> ', '<br>');
          detailNode.text = detailNode.text.replaceAll('<br>', ', ');
        }
        if (detailNode.identifier == "primaryDepartment") {
          detailNode.text = data.topd;
        }
        if (detailNode.identifier == "phone") {
          detailNode.text = data.faculty_phone;
        }
        if (detailNode.identifier == "email") {
          detailNode.text = data.faculty_email.toLowerCase();
        }
        if (detailNode.identifier == "office") {
          detailNode.text = data.faculty_office_number;
        }
      });
      // console.dir(node);
    }
  })

  // console.log("*** prepped payload ***");
  // console.dir(block);
  // block.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes.map(function(sd) {
  //   console.dir(sd);
  // });
  return block;
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
