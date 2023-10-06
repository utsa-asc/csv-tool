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
const POST_URI = "/api/v1/create";
const PAYLOAD_DOCUMENT = fs.readFileSync("json/faculty-block-minimum.json");
/* WP REST API constants */
const WP_HOST = "business.utsa.edu";
const WP_PORT = "443";
const WP_PATH = "/wp-json/wp/v2/";
const LOOKUP_DOCUMENT = "acob/directory-media-hash.json";
var lookupStream = fs.createWriteStream(LOOKUP_DOCUMENT);
const LOOKUP_HASH = {};

var protocol = https;
const ROLE = "Faculty";

var tasks = [];
var headshots = {};
var documents = {};

const DEPTS = fs.readFileSync("acob/directory-dept-single.json");
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
    let results = await Promise.all(tasks.map(async function(t) {
      // data points to collect from WP JSON API Faculty object:
      var person = parsePersonData(t);
      // parse headshot data
      console.log("parse media:" + person.uri);
      media = await parseAssetData(person.media, "image");
      // parse file attachments (CVs) data
      // console.dir(person.attachment);
      // console.log("parse docs:" + person.uri);
      // docs = await parseAssetData(person.attachment, "file");
      // find headshot data locally and move it to new correct path
      media = findAndCopy(media, "headshot", person);
      // docs = findAndCopy(docs, "document", person);
      person.media = media;
      // person.docs = docs;
      console.log("pushing id: " + t.id + " to lookup hash");
      LOOKUP_HASH[person.id] = person;
    }));
    console.log("tasks complete");
    console.log("saving LOOKUP_HASH");
    lookupStream.on("finish", function(){ console.log("DONE!"); });
    lookupStream.write(JSON.stringify(LOOKUP_HASH));
    lookupStream.end();

  } catch (e) {
    console.log(e);
    console.log("Error while running tasks:");
    // console.dir(currentTask);
  }
}

function findAndCopy(assets, type, person) {
  var destinationPath = "faculty";
  var correctedAssets = [];
  // console.log("\n");
  // console.log(assets);
  if (type == "headshot") {
    destinationPath = destinationPath + "/headshots/";
    console.log("HEADSHOT: " + person.uri);
    destinationPath = destinationPath + person.topd.toLowerCase() + "";
    destinationPath = destinationPath.replaceAll(' ', '-');
  
    // console.dir(assets);
    assets.map(function(i) {
      if (type == "headshot") {
        // console.dir(i);
        let parts = i.path.split('/');
        let fileparts = parts[parts.length - 1].split('.');
        let suffix = fileparts[fileparts.length - 1];
        var newFullPath = destinationPath + "/" + person.id + "-" + person.uri + "." + suffix;
        var correctedFullPath = destinationPath + "/" + person.id + "-" + person.uri + ".jpg";
        //person.slugparts[parts.length - 1];
    
        newFullPath = newFullPath.toLowerCase();
        newFullPath = newFullPath.replaceAll(' ', '-');
        let lookupPath = i.path;
        let MISSING_HEADSHOT_JPG = "utsa-cob-contact-default-bw.jpg";
        let MISSING_HEADSHOT_PNG = "PikPng.com_business-woman-silhouette-png_1369280.png";
    
        if (!lookupPath.includes(MISSING_HEADSHOT_JPG) && !lookupPath.includes(MISSING_HEADSHOT_PNG)) {
          // TODO fs.COPY SYNC goes here
          console.log("cp " + lookupPath + " " + newFullPath);
          try {
            fs.copyFileSync("acob/" + lookupPath, "acob/" + newFullPath);
          } catch(e) {
            console.log("\t unable to copy file, see error:");
            console.dir(person.link);
            console.log(e);
          }
          i.correctedPath = correctedFullPath;
          correctedAssets.push(i);
        } else {
          console.log("skipping placeholder image: " + lookupPath + " for " + person.uri);
        }
      }
    });  
  }
  // if (type == "document") {
  //   destinationPath = destinationPath + "/documents/";
  //   console.log("DOCUMENT: " +  person.uri);
  // }
  return correctedAssets;
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
      // if (t.acf.faculty_pdf != "") {
      //   newPerson.attachment = [
      //     {
      //       embeddable: true,
      //       href: 'https://business.utsa.edu/wp-json/wp/v2/media/' + t.acf.faculty_pdf
      //     }
      //   ];
      // } else {
      //   newPerson.attachment = [];
      // }
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

async function parseAssetData(assets, type) {
  // console.dir(assets);
  var parsedAssets = [];
  if (Array.isArray(assets)) {
    asset = assets[0];
    let mediaPath = asset.href.replace('https://business.utsa.edu', '');
    var options = {
      hostname: WP_HOST,
      port: WP_PORT,
      path: mediaPath
    };
    var assetj = await getURL(options);
    if (assetj.media_type == "image" && assetj.media_type == type) {
      // console.dir(a);
      var parsedAsset = {
        id: assetj.id,
        alt: assetj.alt_text,
        path: assetj.source_url.replace('https://business.utsa.edu/wp-content/', '')
      }
      parsedAssets.push(parsedAsset);
    }
  }
  // console.dir(parsedAssets);
  return parsedAssets;
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
};

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
                console.log("EEEEEEEEEEEE");
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
