# Steps for import

## headshot cleanup
- replace spaces with dash (-)
- lowercase all files
- format should be last-first.jpg

## CMS setup
- create necessary asset folders in WALLEDEV/WALLE
    - block folder with year (2025-faculty)
    - img asset folder with year (img/2025)
- archive last year's index and create a new index
    - rename index to index-YYYY (index-2025)
    - copy index-YYYY to just index
        - update index for the target year (2026)
    - copy the attached SITE-NEWS format: faculty-listing-2025 and rename to target year faculty-listing-2025
    - attach new format to index
- update faculty-listing-YYYY target year format 
    - update $TARGET_TAG and $TARGET_YEAR
    - update any college tags if necessary (new colleges, renamed colleges, etc)

- create a test faculty block in the new target year and make sure to tag it with the target year to verify new format and index is working

- update index with new web banner (from basecamp)

## Local repo setup (csv-tool)

- create necessary files/folders:

    - csv-tool/new-faculty/2026
    - csv-tool/new-faculty/img/2026
        - copy your image assets here (our scripts verifies locally before attempt to create a block)
    - copy last year's excel to csv-tool/new-faculty/2026/new-faculty.xslx

## Update your csv-tool/YYYY/new-faculty.xslx
    - in the new-faculty sheet, replace the data here with the data provided via basecamp
    - take not of any major column changes
    - don't remove/rename any sheets

## Scripts update
- update your csv-tool/.env, make sure we are set to use WALLEDEV
    - for dry runs, set POST to NO
- update csv-tool/new-faculty-scripts/new-faculty-process.js:
    - SOURCE_DOCUMENT
    - TARGET_YEAR
    - verify newTask creation, columns should match any column changes made in our spreadsheet
    - verify preparePayload function if any major changes have been made

## JSON template update
- update parentFolderPath in the csv-tool/json/new-faculty-block.json template
    "parentFolderPath": "2026-faculty",

## DRY-RUN (image asset check)
- attempt a dry-run (.env POST set to NO)
    - use output xls with error messages to reconcile headshots, usually misspellings or incorrect name order
    - there WILL be faculty with missing images
    - once reconciled upload assets to cascade's img/YYYY folder

## ATTEMPT POST 
- run with .env POST set to YES, make sure you are testing against WALLEDEV
- move any error lines onto the "errors" sheet
- adjust SHEET_NAME to "errors"
    - repeat and troubleshoot as needed
    - common mistakes: misspelling, especially with the college
    - last name swapped with first, bad characters not sanitized for block URI

## ATTEMPT LIVE POST
- repeat the process for WALLE

## CLEANUP
- remove local images from csv-tool
- feel free to check in final spreadsheet in csv-tool/new-faculty/YYYY
- remove output new faculty spreadsheet
- update repo as needed

