const https = require('https');
const http = require('http');
var moment = require('moment');
moment().format();
//"Apr 18, 2022, 8:09:58 PM", we will need to parse our target date based on the current article's post date
const dateFormat = "M/D/YY";
const {execSync} = require('child_process');
var JSSoup = require('jssoup').default;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
var fs = require('fs');
var tasks = [];
require('dotenv').config();
/* defining some constants */
const POST = process.env.POST;
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const PAYLOAD_DOCUMENT = fs.readFileSync("json/test-post.json");
const TAGS_DOCUMENT = fs.readFileSync("acob/tags.json");
const tags = prepTags(TAGS_DOCUMENT);
const AUTHORS_DOCUMENT = fs.readFileSync("acob/authors.json");
const authors = prepAuthors(AUTHORS_DOCUMENT);
const TARGET_SITE = "ACOB-VPAA-ASC-HALSTORE";
/* WP REST API constants */
const WP_HOST = "business.utsa.edu";
const WP_PORT = "443";
const WP_PATH = "/wp-json/wp/v2/";

var protocol = http;
if (WP_PORT == 443) {
  protocol = https;
}
const DEFAULT_SOURCE = "Alvarez College of Business";

//read in a target year json file
//map over each post
//create a task for each one
var tasks = [];
var targetYear = 2017;

let JSON_FILE = "acob/news-" + targetYear + ".json";
let POSTS_FILE = fs.readFileSync(JSON_FILE);
let posts = JSON.parse(POSTS_FILE);
posts.map(function(p) {
    console.log("adding post: " + p.id);
    // console.dir(p._links.author);
    let newTask = {
        post: p
    };
    tasks.push(newTask);
}); 

console.log("generated: " + tasks.length + " tasks");
executeTasksConcurrently(tasks, targetYear);

// executeTasksConcurrently(tasks);

async function executeTasksConcurrently(list, year) {
  let activeTasks = [];
  var completedTasks = [];
  let concurrencyLimit = 10;

  for (const item of list) {
    if (activeTasks.length >= concurrencyLimit) {
      await Promise.race(activeTasks);
    }
    // console.log(`Start task: ${item} ${item.post.id}`);
    // console.dir(item);
    // wait 0.25 secs between launching new async task b/c Cascade chokes, otherwise...
    await delay(10);

    const activeTask = completeTask(item)
      .then((r) => {
        completedTasks.push(r.post);
        activeTasks.splice(activeTasks.indexOf(activeTask), 1);
        // console.log(`End task: ${item} ${item.post.id}`);
      })
      .catch((r) => {
        completedTasks.push(r.post);
        activeTasks.splice(activeTasks.indexOf(activeTask), 1);
        // console.log(`End task: ${item} ${item.post.id}`);
      });
    activeTasks.push(activeTask);
  }
  await delay(1000);

  //save updated tasks to new file
  let newFilePath = "acob/news-" + year + "-edited.json";
  console.log("save update tasks to: " + newFilePath);
  console.log("completed: " + completedTasks.length);
  saveSnippet(JSON.stringify(completedTasks), newFilePath);
}

async function completeTask(t) {
  try {
    //given a task:
    // update the task's json object
    // - clean text, save to new content text field
    // save author name to author field
    // generate tags and save to tags field
    // images:
    // html soup images in content (from new text field)
    // - save/move images from uploads to new yyyy/images folder
    // - update html soup
    // update content text field
    // make sure featured media image is save/move from uploads to yyyy/images folder
    // update new image1 field with featured media field
    let newContent = generateNewContent(t.post.content.rendered, t.post);
    delete t.post.content.rendered;
    t.post.title.rendered = cleanText(t.post.title.rendered);
    t.post.content.clean = cleanText(newContent.content);
    t.post.excerpt.clean = cleanText(newContent.excerpt);
    delete t.post.excerpt.rendered;
    t.post.author_name = lookupAuthor(t.post.author);
    if ((newContent.author != "") || (newContent.author == undefined)) {
      t.post.author_name.name = newContent.author;
      t.post.author_name.slug = newContent.author.replaceAll(' ' , '-').toLowerCase();
    }
    t.post.tags_generated = generateTags(t.post.tags);
    // console.log("easy stuff done: " + t.post.id);
    //async call to process images
    t.post.parentFolderPath = computeParentFolder(t.post.date);
    t.post.content.clean = processImages(t.post.content.clean, t.post.date);
    let postLinks = t.post['_links'];
    let firstFeatured = postLinks['wp:featuredmedia'];
    t.post.featured_image = await processFeaturedmedia(firstFeatured, t.post.date);
    // console.log("computed feature image: " + t.post.featured_image);
    t.post.updated = true;
  } catch (e) {
    console.log(e);
    console.log("Error while running tasks:");
    console.dir(t);
  }
  return t;
}

function generateNewContent(htmlContent, post) {
  var results = { content: "", excerpt: "", author: "" }
  var soup = new JSSoup(htmlContent, false);
  var paragraphs = soup.findAll('p');
  let psize = paragraphs.length;
  if (psize > 0) {
    let excerpt = paragraphs[0].getText();
    results.excerpt = excerpt;
    // paragraphs[0].extract();
    if (paragraphs[psize - 1].getText().trim() == "&#160;") {
      paragraphs[psize - 1].extract;
      psize = psize - 1;
    }
    if (paragraphs[psize - 1].getText().trim() == "&nbsp;") {
      paragraphs[psize - 1].extract;
      psize = psize - 1;
    }

    if (paragraphs[psize - 1]) {
      let byline = paragraphs[psize - 1].getText().trim();
      //verify this is a byline
      if (byline.indexOf('&#8211;' == 0) || (byline.indexOf('&#8212;' == 0))) {
        if ((byline.length < 35) & (byline.indexOf('nbsp') < 0) ) {
          console.log("clipping byline: " + post.id + "\t" + byline);
          results.author = byline;
          results.author = results.author.replace('&#8211;', '').trim();
          results.author = results.author.replace('—', '').trim();
          results.author = results.author.replace('&#8212;', '').trim();
          paragraphs[psize - 1].extract();
        }
      }
    }  
  }

  results.content = soup.prettify(' ', '');
  return results;
}

function stripHtml(htmlContent) {
  var soup = new JSSoup(htmlContent, false);
  var excerptAnchor = soup.findAll("a.excerpt-read-more");
  if (excerptAnchor.length > 0) {
    excerptAnchor.map(function(a) {
      a.extract();
    });
  }
  var plainText = soup.getText();
  plainText = plainText.replace('&#8230; Read more &raquo;', '');
  return plainText;
}

function lookupAuthor(id) {
  var authorName = "Alvarez College of Business";
  if (authors[id] != undefined) {
    authorName = authors[id];
  }
  return authorName;
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

function computeParentFolder(pubdate) {
  var date = moment(pubdate);
  let year = date.year();
  let month = date.month() + 1;
  var monthStr = "" + month;
  if (month < 10) {
    monthStr = "0" + monthStr;
  }
  return "/news/" + year + "/" + monthStr;
}

function computeMediaFolder(uri, pubdate) {
  let pieces = uri.split('/');
  var date = moment(pubdate);
  let year = date.year();
  if (pieces[0] == "uploads") {
    year = pieces[1];
  }
  return "news/" + year + "/images";
}

async function processFeaturedmedia(mediaObj, pubdate) {
  // console.dir(mediaObj);
  var mediaPath = "";
  var updatedImageURI = {
    uri:"",
    alt:""
  }
  try {
    mediaPath = mediaObj[0].href;
    mediaPath = mediaPath.replace('https://business.utsa.edu', '');
    let options = {
      hostname: WP_HOST,
      port: WP_PORT,
      path: mediaPath
    };
    let media = await getURL(options);
    if (media.media_details != undefined) {
      let uploadPath = "acob/uploads/" + media.media_details.file;
      let parts = media.media_details.file.split('/');
      let localPath = "acob/news/" + parts[0] + "/images/" + parts[2].toLowerCase();
      let cmsPath = "/news/" + parts[0] + "/images/" + parts[2].toLowerCase();
      if (!fs.existsSync(uploadPath)) {
          // console.log("\t FI: image not found in local uploads path: " + uploadPath);
      } else {
        fs.copyFileSync(uploadPath, localPath);
        updatedImageURI.uri = cmsPath;
        updatedImageURI.alt = media.alt_text;
        // console.log("\t FI: upload path: " + uploadPath);
        // console.log("\t FI: new media path: " + cmsPath);
      }
    } else {
      console.log("image not found");
    }
  } catch (e) {
    console.log("unable to fetch featured media:");
    // console.log(e);
    console.dir(mediaObj);
  }
  return updatedImageURI;
}

function processImages(htmlContent, pubdate) {
  var WP_HTTP_PREFIX = "business.utsa.edu/wp-content/";
  var soup = new JSSoup(htmlContent, false);
  var images = soup.findAll('img');
  if (images.length > 0) {
    images.map(function(image) {
      var newImageSrc = image.attrs.src;
      var imageSrc = image.attrs.src;
      imageSrc = imageSrc.replace('https://', '');
      imageSrc = imageSrc.replace('http://', '');
      // console.log("\tparsed: " + imageSrc);
      //we only care about images hosted at WP_HTTP_PREFIX
      if (imageSrc.indexOf(WP_HTTP_PREFIX) >= 0) {
        imageSrc = imageSrc.replace(WP_HTTP_PREFIX, '');
        let uploadsPath = imageSrc;
        let fileName = imageSrc.split('/')[3];
        let newMediaPath = computeMediaFolder(imageSrc, pubdate);
        // console.log("\t upload path: " + uploadsPath);
        // console.log("\t new media path: " + newMediaPath);
        // console.log("\t media file: " + fileName);
        if (!fs.existsSync("acob/" + uploadsPath)) {
          // console.error("\timage not found");
        } else {
          let fullPath = "acob/" + uploadsPath;
          let localPath = "acob/" + newMediaPath + "/" + fileName.toLowerCase();
          let cmsPath = "/" + newMediaPath + "/" + fileName.toLowerCase();
          newImageSrc = cmsPath;
          image.attrs.src = cmsPath;
          image.attrs.class = image.attrs.class + " float-start p-2 m-3";
          try {
            fs.copyFileSync(fullPath, localPath);
          } catch (copyError) {
            console.log("\t\t unable to copy file");
            console.log("\t\t" + fullPath + " > " + newPath.toLowerCase());
            console.log(copyError);
          }
          // console.error("\timage found");
        }
      }
      //all said and done, update image src attr
      delete image.attrs.sizes;
      delete image.attrs.srcset;
      delete image.attrs.loading;
    });
  }

  return soup.prettify(' ', '');
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

function prepTags(data) {
  var results = {};
  const originData = JSON.parse(data);
  originData.map(function(element) {
    results[element.id] = {"name": element.name, "slug": element.slug};
  })
  return results;
}

function prepAuthors(data) {
  var results = {};
  const originData = JSON.parse(data);
  originData.map(function(element) {
    results[element.id] = {"name": element.name, "slug": element.slug};
  })
  return results;
}

function generateTags(taglist) {
  //wordpress represents attached tags as an array of ids
  var gtags = [];
  taglist.map(function(t) {
    if (tags[t] != undefined) {
      let newTag = { "name" : tags[t].slug };
      gtags.push(newTag);
    }
  });
  gtags.push({"name": "news"});
  return gtags;
}

function saveSnippet(content, fpath) {
  var snippetStream = fs.createWriteStream(fpath);
  snippetStream.write(content);
  snippetStream.end();
}