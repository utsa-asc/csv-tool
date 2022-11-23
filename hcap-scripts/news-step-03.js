/* Cleanup Process Tasks:
    // here we are only concerned with any content and metadata cleanup
  0) read incoming CSV
  1) read snippet html from local disk
  2) adjust categories as needed
  3) complete any html entity, bad character before cleanup
  4) save updated snippet content
  */
  var csv = require('fast-csv');
  const {execSync} = require('child_process');
  var moment = require('moment');
  moment().format();
  //"Apr 18, 2022, 8:09:58 PM", we will need to parse our target date based on the current article's post date
  const dateFormat = "M/D/YY";
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const https = require('https');
  var fs = require('fs');
  var JSSoup = require('jssoup').default;
  var tasks = [];
  var authors = {};
  var categories = {};
  var writableStream = fs.createWriteStream("hcap/hcap-news-2022-step-03.csv");
  //var stream = fs.createReadStream("input.csv");
  const stream = csv.format();
  stream.pipe(writableStream);
  // outgoing header csv (should be the same, only making modifications to snippet content and maybe imageURL)
  headerOutput = ["id", "title", "date", "permalink", "imageURL", "imageTitle", "imageAltText", "categories", "department", "status", "author", "authorEmail", "slug", "snippetURI", "contentURI"];
  stream.write(headerOutput);
  writableStream.on("finish", function(){ console.log("DONE!"); });
  var authors = {
    'amanda.cody@utsa.edu': 'Amanda Cody'
  };
  var catHash = {
    'News': 'news',
    'Research': 'research',
    'Psychology': 'psychology',
    'Demography': 'demography',
    'Public Administration': 'public-administration',
    'Public Health': 'public-health',
    'Sociology': 'sociology',
    'Nutrition &amp; Dietetics': 'nutrition-dietetics',
    'Social Work': 'social-work',
    'Criminology &amp; Criminal Justice': 'criminology-criminal-justice',
    "Dean's Office": 'deans-office'
  };

  fs.createReadStream('hcap/hcap-news-2022-step-02.csv')
    .pipe(csv.parse({ headers: true }))
    .on('data', function(obj) {
      // console.log("parsing row: " + obj.id);
      // incoming header csv:
      // id,title,date,permalink,imageURL,imageTitle,imageAltText,categories,department,status,author,authorEmail,slug,snippetURI
      // no need to remap, all our headers should be well formed
      var parsedData = obj;
      tasks.push(parsedData);
      // processEachTask(parsedData);
      // execSync('sleep 1'); // block process for 1 second.
    }).on("end", function() {
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
      console.log("attempting to read task.snippet at: " + task.snippetURI)
      // console.dir(task);
      var snippetHtml = fs.readFileSync(task.snippetURI);
      var soup = new JSSoup(snippetHtml, false);
      // do work here:
      var categories = []
      var rawCatStr = task.categories;
      if (task.deparment != "") {
        rawCatStr = task.categories + "|" + task.department;
      }
      var rawCats = rawCatStr.split('|');
      rawCats.map(cat => {
        var newCats = catHash[cat.trim()];
        if (Array.isArray(newCats)) {
          // console.log("attempting to add new cats: " + newCats);
          newCats.map(innerCat => {
            categories.push(innerCat);
          });
        } else {
          if (typeof(newCats) != 'undefined') {
            // console.log("attempting to add new cats: " + newCats);
            categories.push(newCats);
            }
        }
      });
      console.log("new categories parsed:");
      console.dir(categories);
      // if (categories.length > 0) {
      //   var newCats = ""
      //   task.categories = categories.join('|');
      // } else {
      //   task.categories = ""
      // }


      // let contentPath = task.contentURI;
      // saveSnippet(soup, contentPath);
      // outputResult = [task.id, task.title, task.author, task.epoch, task.date, task.url, task.categories, task.slug, task.image, task.parentFolderPath, task.snippetURI, task.contentURI];
      // // console.dir(outputResult);
      // stream.write(outputResult);
    }

    /* given text, save it to local disk at the fpath location */
    function saveSnippet(content, fpath) {
      console.log("\t\t: SAVE SNIPPET:");
      console.log("\t" + fpath);
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
  });
  