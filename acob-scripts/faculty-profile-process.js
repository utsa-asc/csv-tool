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
const POST_PAYLOAD = "json/faculty-page-minimum.json";
const GET_URI = "/api/v1/read/block/ACOB-VPAA-ASC-HALSTORE/";
const POST_URI = "/api/v1/create";

var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}
const ROLE = "faculty";

var tasks = [];

const DEPTS = fs.readFileSync("acob/directory-dept-list.json");

const PAYLOAD_CONTENT = fs.readFileSync(POST_PAYLOAD);
const payloadTemplate = JSON.parse(PAYLOAD_CONTENT);
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

// individual task completion here:
async function completeTask(t) {
  // FLOW:
  // - for each person
  //  - only process if they are faculty
  //  - preparePayload
  //  - POST
  var person = parsePersonData(t);
  person.blockPath = generateBlockPath(person);
  person.pagePath = generatePagePath(person);
  person.uri = generateSlug(person);

  // TEST is this person FACULTY?
  // console.dir(person);
  // MAYBE ONLY CREATE PROFILE WHEN WE HAVE CONTENT?
  let givenContent = person.content;
  // prep content
  var contentAreas = {}
  contentAreas = prepareContent(person);

  if (person.roles.includes(ROLE) && givenContent.length > 0) {
    
    // preparePayload
    const payload = preparePayload(person);
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

/* TODO: not implemented */
function prepareContent(content) {
  //HTML SOUP

  //parse
  //split on H3 tags
  //capture text only
  //trim
  //remove colons
  //sort into buckets:
  // - degrees
  // - fulLBio
  // - researchInterests
  // - teaching
  // these last two buckets require more structure:
  // - publications
  // - grantsInfo

}

function preparePayload(person) {
  console.log("*** preparePayload ***");
  var asset = payloadTemplate;
  console.dir(person);

  asset.page.structuredData.structuredDataNodes.map(function(sdn) {
    if (sdn.identifier == 'block') {

    }
    if (sdn.identifier == 'campusAddress') {
      
    }
    if (sdn.identifier == 'fullBio') {
      
    }
    if (sdn.identifier == 'teaching') {
      
    }
    if (sdn.identifier == 'researchInterests') {
      
    }
    if (sdn.identifier == 'degrees') {
      
    }

    //update metadata
    asset.page.metadata.displayName = "";
    asset.page.metadata.displayName = "";

    //cascade location data
    asset.page.parentFolderPath = "faculty";
    asset.page.name = person.uri;
  });
  let noImage = [{
    "type": "asset",
    "identifier": "file",
    "fileId": "55ec68b3ac1600040826d2316fbe3c5f",
    "filePath": "faculty/headshots/_utsa-profile-placeholder-400x500.svg",
    "assetType": "file",
    "recycled": true
  }];
  let noCVLink = [{
    "type": "text",
    "identifier": "type",
    "text": "No Link",
    "recycled": false
  }];
  var fileData = lookupHash[person.id];
  // console.log("fileData for person id: " + person.id + "\t " + data.asset.xhtmlDataDefinitionBlock.name);
  // console.dir(fileData);
  let media = fileData.media;
  let docs = fileData.docs;

  try {
    data.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes.map(function(d) {
      if (d.identifier == 'image') {
        if (media.length > 0) {
          let replacement = media[0];
          d.structuredDataNodes.map(function(i) {
            if (i.identifier == 'file') {
              console.log("replace headshot for: " + person.uri + " with: " + replacement.correctedPath);
              i.filePath = replacement.correctedPath;
              i.fileId = "";
            };
            if (i.identifier == 'alt') {
              console.log('replace alt text with: ' + replacement.alt);
              i.text = replacement.alt;
            }
          });
          // console.dir(d);
        } else {
          console.log("skipping headshot replacement for: " + data.asset.xhtmlDataDefinitionBlock.name);
        }
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
