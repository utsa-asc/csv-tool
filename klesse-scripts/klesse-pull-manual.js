var csv = require('fast-csv');
const {execSync} = require('child_process');
var moment = require('moment');
moment().format();
//"Apr 18, 2022, 8:09:58 PM"
const dateFormat = "MMM D, yyyy, h:mm:ss A";
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const https = require('https');
var fs = require('fs');
var JSSoup = require('jssoup').default;
var tasks = [];
var authors = {};
var categories = {};
var writableStream = fs.createWriteStream("manual-curated.csv");
//var stream = fs.createReadStream("input.csv");
const stream = csv.format();
stream.pipe(writableStream);
headerOutput = ["snippet", "content"];
stream.write(headerOutput);

writableStream.on("finish", function(){ console.log("DONE!"); });

targetData = {
  "snippet": "table-scratch.html"
}
tasks.push(targetData)

/*
Promise.all(tasks.map(processEachTask)).then(afterAllTasks);
// async/await notation:
// you must be in an "async" environement to use "await"
*/
async function wrapper () {
  console.log("task count: " + tasks.length);

  for(let t of tasks) {
    await processEachTask(t);
  }
}
// async function return a promise transparently
wrapper();

console.log("waiting for tasks");

function processEachTask(task, callback) {
  //id,title,author,epoch,date,url,categories,slug,image,snippet
  var snippetHtml = fs.readFileSync(task.snippet);
  var soup = new JSSoup(snippetHtml, false);
  //fix image
  var articleImages = soup.findAll('img');
  if (articleImages) {
    articleImages.map(articleImage => {
      // execSync('sleep 2');
      var articleImgSrc = articleImage.attrs.src;
      if (articleImgSrc) {
        console.log("\t\tdownload and save image: " + articleImgSrc);
        var imageName = articleImgSrc.split('/');
        // console.log(imageName.length);
        var imagePath = "manual-images/" + imageName[imageName.length - 1];
        var newImageSrc = "/images/advisory-council/" + imageName[imageName.length - 1];
        newImageSrc = newImageSrc.toLowerCase();
        if (articleImgSrc) {
          downloadImage(articleImgSrc, imagePath);
          console.log("setting new image src: " + newImageSrc);
          articleImage.attrs.src = newImageSrc;
        }
      }
    })
  }
  var contentPath = "manual-curated/" + task.snippet;
  task.content = contentPath
  saveSnippet(soup, contentPath);
  // console.log(articleHeader.prettify());
  // console.log(articleBody.prettify())
  outputResult = [task.snippet, task.content]
  console.dir(outputResult);
  stream.write(outputResult);
}
  
function downloadImage(url, fpath) {
  if (!fs.existsSync(fpath)) {
    if (url.startsWith('https')) {
      execSync('sleep 1');
      const imgReq = https.get(url, (res) => {
        res.pipe(fs.createWriteStream(fpath));
      });
      imgReq.on('error', function(e) {
        console.error('error while fetching: ' + url + ' to path: ' + fpath);
        // console.error(e);
      });
      imgReq.end();  
    }
  } else {
    // console.log("exists!");
  }
}

function saveSnippet(content, fpath) {
  var articleStream = fs.createWriteStream(fpath);
  var contentStr = content.prettify();
  contentStr = contentStr.replace('&nbsp;', '&#160;');
  contentStr = contentStr.replace(/\u00a0/g, " ");
  contentStr = contentStr.replace('&mdash;', '&#8212;');
  contentStr = contentStr.replace('<br>', '<br/>');
  articleStream.write(contentStr);
  articleStream.end();
}

function afterAllTasks(err) {
  console.log("all promises complete");
}
