const https = require('https');
const http = require('http');
const {execSync} = require('child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
var fs = require('fs');
const { stringify } = require('querystring');
const { lookup } = require('dns');
var tasks = [];
require('dotenv').config();
/* defining some constants */
const CAS_HOST = process.env.CAS_HOST;
const POST = process.env.POST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
/* WP REST API constants */
const WP_HOST = "business.utsa.edu";
const WP_PORT = "443";
const WP_PATH = "/wp-json/wp/v2/";
const LOOKUP_DOCUMENT = "acob/directory-media-hash.json";
const GET_URI = "/api/v1/read/block/ACOB-VPAA-ASC-HALSTORE/"
const EDIT_URI = "/api/v1/edit"

var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}
const ROLE = "faculty";

var tasks = [];
var headshots = {};
var documents = {};

const DEPTS = fs.readFileSync("acob/directory-dept-list.json");
// const HASH_CONTENTS = fs.readFileSync("acob/directory-media-hash.json");

// const lookupHash = JSON.parse(HASH_CONTENTS);
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

// completeTasks();

executeTasksConcurrently(tasks);

async function executeTasksConcurrently(
  list
) {
  let activeTasks = [];
  let concurrencyLimit = 10;

  for (const item of list) {
    if (activeTasks.length >= concurrencyLimit) {
      await Promise.race(activeTasks);
    }
    // console.log(`Start task: ${item}`);
    // console.dir(item);
    // wait 0.25 secs between launching new async task b/c Cascade chokes, otherwise...
    await delay(250);

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
  // data points to collect from WP JSON API Faculty object:
  // console.log("parse person data");
  var person = parsePersonData(t);
  
  // console.log("generating asset paths");
  // CMS REST GET
  let blockPath = generateBlockPath(person);
  var personObj = await getAsset(blockPath);
  person.blockPath = generateBlockPath(person);
  person.pagePath = generatePagePath(person);
  person.uri = generateSlug(person);
  // console.log("page page: " + person.pagePath);
  let givenContent = person.content;

  if (person.roles.includes(ROLE) && givenContent.length > 0) {
    // preparePayload
    // console.log("faculty role found for: " + person.uri);
    const payload = preparePayload(personObj, person);
    let stringPayload = JSON.stringify(payload);
    // console.log(stringPayload);
    // console.log("\n\n")

    // CMS REST POST
    if (POST == "YES") {
      let postedAsset = await postAsset(EDIT_URI, stringPayload);
      try {
        let respj = JSON.parse(postedAsset);
        if (respj.success == true) {
          // console.log(postedAsset);
          console.log("updated: " + respj.success + "\t" + payload.asset.xhtmlDataDefinitionBlock.name);
        } else {
          console.log("****ERROR****");
          console.log(postedAsset);
          console.log(person.id + "\t" + person.uri);
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
  } else {
    console.log("skipping person: " + person.uri +  " NOT Faculty");
  }
  return t;
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
      // console.dir(t.acf);
      newPerson.uri = t.slug;
      newPerson.fullname = t.title.rendered;
      newPerson.id = t.id;
      newPerson.status = t.status;
      newPerson.link = t.link;
      newPerson.json = t._links.self[0].href;
      newPerson.media = t._links['wp:featuredmedia'];
      // attached CV is referenced in the acf.faculty_pdf property
      if (t.acf.faculty_pdf != "") {
        newPerson.attachment = [
          {
            embeddable: true,
            href: 'https://business.utsa.edu/wp-json/wp/v2/media/' + t.acf.faculty_pdf
          }
        ];
      } else {
        newPerson.attachment = [];
      }
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
    tags.push({ name: d });
  });

  roles.map(function(r) {
    tags.push({ name: r});
  });
  return tags;
}

function createFolderPath(p) {
  //potential roles:
  // Faculty | Staff | Administrators | Doctoral Students | Emeritus Faculty
  var folderPath = "faculty/_blocks/" + p.topd.toLowerCase() + "";
  folderPath = folderPath.replaceAll(' ', '-').replaceAll("'", "");
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

function generateBlockPath(p) {
  var blockPath = createFolderPath(p);
  var newSlug = generateSlug(p);
  blockPath = blockPath + "/" + newSlug;
  return blockPath;
}

function generatePagePath(p) {
  var blockPath = "faculty/" + generateSlug(p);
  return blockPath;
}

function generateSlug(data) {
  var newSlug = data.last_name.toLowerCase().trim() + "-" + data.first_name.toLowerCase().trim();
  newSlug = newSlug.replace(/[^a-z -]/gi, '');
  newSlug = newSlug.replaceAll(' ', '-');
  newSlug = newSlug.replaceAll(',', '-');
  return newSlug;
}

function preparePayload(data, person) {
  // console.log("*** preparePayload ***");
  const profileLink = {
    "type": "group",
    "identifier": "link",
    "structuredDataNodes": [
      {
        "type": "text",
        "identifier": "label",
        "text": person.fullname + " Faculty Profile"
      },
      {
        "type": "text",
        "identifier": "type",
        "text": "internal"
      },
      {
        "type": "asset",
        "identifier": "internal",
        "pagePath": person.pagePath,
        "assetType": "page,file,symlink"
      },
      {
        "type": "text",
        "identifier": "target",
        "text": "Parent Window/Tab"
      }
    ]
  };
  
  try {
    data.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes.map(function (d) {
      if (d.identifier == "details") {
        d.structuredDataNodes.map(function(l) {
          if (l.identifier == "link") {
            l.structuredDataNodes = profileLink.structuredDataNodes;
          }
        });
      }
    });
  } catch (e) {
    console.log("unable to modify asset data:");
    console.log(e);
    console.dir(data);
  }
  return data;
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
    path: uri,
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
            // console.log(getOptions);
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
      // console.log(getOptions);
			let chunks_of_data = [];

			response.on('data', (fragments) => {
        // console.log("\t pushing data");
				chunks_of_data.push(fragments);
			});

			response.on('end', () => {
        var responeObj = {};
        try {
          let responseBody = Buffer.concat(chunks_of_data);
          let responseString = responseBody.toString();
          responseObj = JSON.parse(responseString);  
        } catch (jsonE) {
          responseObj = { status: false, error: "unable to parse JSON as response"};
        }
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
