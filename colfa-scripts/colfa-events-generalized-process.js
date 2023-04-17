
const fs = require('fs');
const mysql = require('mysql2');
var moment = require('moment'); // require
moment().format(); 
require('dotenv').config();
const https = require('https');
const http = require('http');
/* defining some constants */
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASS = process.env.DB_PASS;
const DB_NAME = process.env.DB_NAME;
const DO_POST = process.env.POST;
if (!process.argv[2] || !process.argv[3] || !process.argv[4]) {
    console.log("sql query file, department name, and tag name required")
} else {
    const SQL_QUERY_DOCUMENT = fs.readFileSync(process.argv[2], {encoding:'utf8', flag:'r'});
    const DEPT_VAL = process.argv[3];
    const TAG_NAME = process.argv[4];
    console.log("event category will be: " + DEPT_VAL);
    console.log(SQL_QUERY_DOCUMENT);
    const PAYLOAD_DOCUMENT = fs.readFileSync("json/event-page-minimum.json", {encoding:'utf8', flag:'r'});
    const POST_URI = "/api/v1/create";
    var protocol = http;
    if (CAS_PORT == 443) {
    protocol = https;
    }
    const connection = mysql.createConnection({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASS,
        database: DB_NAME
    });
    connection.connect((err) => {
        if (err) throw err;
        console.log('Connected!');
        connection.query(SQL_QUERY_DOCUMENT, (err, rows) => {
            if(err) throw err;
            console.log('Data rows (' + rows.length + ') received from DB:');
            rows.forEach( (row) => {
                var payload = JSON.parse(PAYLOAD_DOCUMENT);
                let entryID = row.entry_id;
                let title = asciiOnly(cleanContent(row.title));
                let details = cleanContent(row.description);
                let location = cleanContent(row.location);
                let dateRaw = row.rawDate;
                let startRaw = dateRaw + row.startTime;
                let eventStart = moment.unix(startRaw);
                let endRaw = dateRaw + row.endTime;
                let eventEnd = moment.unix(endRaw);
                // console.log("dateRaws: " + dateRaw + "\t" + row.startTime + "\t" + row.endTime);
                // console.log("computed startRaw: " + startRaw);
                // console.log(eventStart.format("dddd, MMMM DD YYYY, h:mm:ss a")); // "Sunday, February 14th 2010, 3:25:50 pm"
                // console.log("computed endRaw: " + endRaw);
                // console.log(eventEnd.format("dddd, MMMM DD YYYY, h:mm:ss a")); // "Sunday, February 14th 2010, 3:25:50 pm"
                var uriFormat = eventStart.format("DD") + "-" + row.url_title;
                uriFormat = uriFormat.replace('.', '');
                var casPath = "events/" + eventStart.format("YYYY") + "/" + eventStart.format("MM");
                let eventStartFormatted = eventStart.format();
                // console.log(row);
                console.log(`${row.entry_id} id has title: ${row.title}`);
                console.log("cas path: " + casPath);
                console.log("asset name: " + uriFormat);
                console.log("title: " + title);
                console.log("location: " + location);
                console.log("------------------");
                console.log("");
                let newSD = [        
                    {
                        "type": "text",
                        "identifier": "featured",
                        "text": "::CONTENT-XML-CHECKBOX::"
                    },
                    {
                        "type": "text",
                        "identifier": "starts",
                        "text": "" + eventStart
                    },
                    {
                        "type": "text",
                        "identifier": "ends",
                        "text": "" + eventEnd
                    },
                    {
                        "type": "text",
                        "identifier": "all-day",
                        "text": "::CONTENT-XML-CHECKBOX::"
                    },
                    {
                        "type": "group",
                        "identifier": "eventLink",
                        "structuredDataNodes": [
                            {
                                "type": "text",
                                "identifier": "label"
                            },
                            {
                                "type": "text",
                                "identifier": "ariaLabel"
                            },
                            {
                                "type": "text",
                                "identifier": "type",
                                "text": "No Link"
                            },
                            {
                                "type": "asset",
                                "identifier": "internal",
                                "assetType": "page,file,symlink"
                            },
                            {
                                "type": "text",
                                "identifier": "anchor"
                            },
                            {
                                "type": "text",
                                "identifier": "external",
                                "text": "https://"
                            },
                            {
                                "type": "text",
                                "identifier": "target",
                                "text": "Parent Window/Tab"
                            }
                        ]
                    },
                    {
                        "type": "text",
                        "identifier": "imageChoice"
                    },
                    {
                        "type": "group",
                        "identifier": "image",
                        "structuredDataNodes": [
                            {
                                "type": "asset",
                                "identifier": "file",
                                "assetType": "file"
                            },
                            {
                                "type": "text",
                                "identifier": "alt"
                            }
                        ]
                    },
                    {
                        "type": "group",
                        "identifier": "recurrence",
                        "structuredDataNodes": [
                            {
                                "type": "text",
                                "identifier": "frequency",
                                "text": "Once"
                            },
                            {
                                "type": "text",
                                "identifier": "interval"
                            },
                            {
                                "type": "text",
                                "identifier": "day",
                                "text": "::CONTENT-XML-CHECKBOX::"
                            },
                            {
                                "type": "text",
                                "identifier": "monthly-day"
                            },
                            {
                                "type": "text",
                                "identifier": "ends"
                            }
                        ]
                    },
                    {
                        "type": "text",
                        "identifier": "details",
                        "text": details
                    },
                    {
                        "type": "text",
                        "identifier": "location",
                        "text": "" + location
                    },
                    {
                        "type": "group",
                        "identifier": "contact",
                        "structuredDataNodes": [
                            {
                                "type": "text",
                                "identifier": "name"
                            },
                            {
                                "type": "text",
                                "identifier": "website"
                            },
                            {
                                "type": "text",
                                "identifier": "phone"
                            }
                        ]
                    },
                    {
                        "type": "group",
                        "identifier": "relatedlink",
                        "structuredDataNodes": [
                            {
                                "type": "text"
                            },
                            {
                                "type": "asset",
                                "identifier": "internal",
                                "assetType": "page"
                            },
                            {
                                "type": "asset",
                                "identifier": "external",
                                "assetType": "symlink"
                            },
                            {
                                "type": "text",
                                "identifier": "custom"
                            }
                        ]
                    }
                ];
                let dFields = [
                    {
                        "name": "categories",
                        "fieldValues": [
                            {
                                "value": "Campus Events"
                            },
                            {
                                "value": DEPT_VAL
                            }
                        ]
                    }
                ];
                let tags = [{ "name": "event"}, {"name": TAG_NAME }];
                payload.asset.page.structuredData.structuredDataNodes = newSD;
                payload.asset.page.metadata.displayName = title;
                payload.asset.page.metadata.title = title;
                payload.asset.page.metadata.summary = title;
                payload.asset.page.metadata.dynamicFields = dFields;
                payload.asset.page.tags = tags;
                payload.asset.page.parentFolderPath = casPath;
                payload.asset.page.name = uriFormat;
                let postData = JSON.stringify(payload);
                // console.log("computed JSON payload:");
                // console.log(payload);
                // console.log(postData);
                //do POST
                var postResponse = "";
                var postOptions = {
                    hostname: CAS_HOST,
                    port: CAS_PORT,
                    path: POST_URI,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Content-Length': postData.length,
                        Authorization: ' Bearer ' + API_KEY
                    }
                };
                if (CAS_PORT == 443) {
                    postOptions.requestCert = false;
                    postOptions.rejectUnauthorized = false;
                }
                // console.dir(postOptions);
                if (DO_POST == "YES") {
                    const post = protocol.request(postOptions, res => {
                        // console.log('status code: ' + res.statusCode);
                        // console.log('headers:', res.headers);
                        res.on('data', d => {
                            postResponse = postResponse + d;
                            let responseObj = JSON.parse(d);
                            process.stdout.write(d);
                            process.stdout.write('\t' + payload.asset.page.parentFolderPath + "\t" + payload.asset.page.name);
                            //   process.stdout.write(responseObj.createdAssetId);
                            process.stdout.write('\n');
                        });
                    });
                    post.on('error', (e) => {
                        console.log('error on POST');
                        console.error(e);
                    });
                    post.write(postData);
                    post.end();
                } else {
                    console.log("SKIPPING POST TO API");
                }
            });
            connection.end();
        });
    });
}

function cleanContent(content) {
    contentStr = content.replace('&nbsp;', '&#160;');
    contentStr = contentStr.replace(/\u00a0/g, " ");
    contentStr = contentStr.replace('&mdash;', '&#8212;');
    contentStr = contentStr.replace('<br>', '<br/>');
    contentStr = contentStr.replace('–', '-');
    return contentStr;
  }

  function asciiOnly(content) {
    contentStr = content.replace('&nbsp;', '&#160;');
    contentStr = contentStr.replace(/\u00a0/g, " ");
    contentStr = contentStr.replace('&mdash;', '&#8212;');
    contentStr = contentStr.replace('<br>', '<br/>');
    contentStr = contentStr.replace('–', '-');
    contentStr = contentStr.replace('"', '');
    contentStr = contentStr.replace(/[^\x00-\x7F]/g, "");
    return contentStr;
  }