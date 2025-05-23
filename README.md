# mit-backup-tools
Some scripts to download MIT account data for archival purposes. These scripts navigate to a website (Canvas, Gradescope, etc.) and click through all the different pages, capturing content as they go.

Pages are captured as PDF and MHTML (multipart HTML; it's an HTML file that includes all the referred images/styles/scripts). Additionally, content is saved directly where possible (such as DOCX files in Canvas).

## Supported sites
* Canvas
* Confluence
* EECSIS
* Gradescope
* WebSIS

### Honorable mentions
To archive these services, I used some existing tools.

* Email: [isync](https://wiki.archlinux.org/title/Isync)
* Google Drive: [rclone](https://rclone.org/)

## Usage

### Prerequisites
1. Node.js (v16 or later recommended)
2. npm (comes with Node.js)

### Setup
1. Navigate to the `downloader` directory:
   ```bash
   cd downloader
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Authentication
The scripts require authentication cookies to access MIT services. You'll need to provide cookies for each service you want to download from.

You provide these cookies in a JSON file. To make it easier, I have included sample cookie files for each service, with the minimum required cookies. You will need to fill in the values, like so:

1. In `downloader/`, copy the `sample-cookies-<service>.json` file to `cookies-<service>.json`
2. Log into the service in your browser (Canvas, Gradescope, etc.)
3. Open your browser's developer tools and go to the "Cookies" section (in Chrome this is in the Application tab, in Firefox it is in the Storage tab)
4. Look at your `cookies-<service>.json`. There will be a few cookies, each with the value set to `[fill me in]`. Copy the value of each cookie from your browser into the JSON file.
	* Tip: in your browser, if you double click the cookie value, it should select the whole thing. Some values are quite long and need to be copied exactly.

When you run the script, the first thing it does is check if you are logged in. If you aren't (which usually means you set up the cookies wrong, or your cookies have expired), then you'll get a `Loader said you aren't logged in` error.

For Confluence specifically, you'll also need to create a `confluence-spaces.json` file listing the spaces you want to download. See the service-specific notes below.

### Running the scripts
Each service has its own script. Run them from the `downloader` directory:

```bash
# Download Canvas content
npm run start-canvas

# Download Confluence content
npm run start-confluence

# Download EECSIS content
npm run start-eecsis

# Download Gradescope content
npm run start-gradescope

# Download WebSIS content
npm run start-websis
```

Each script will:
1. Launch a browser window (visible, not headless)
2. Load your authentication cookies
3. Navigate through the service's pages
4. Save content in the `downloader/output/<service>` directory:
   * Pages are saved as both PDF and MHTML (multipart HTML) files
   * Files (like DOCX, PDFs) are downloaded directly where possible
   * Content is organized in a directory structure matching the service's hierarchy

### Known issues
Puppeteer (the library used for web browsing) seems to have some issues with MHTML saving. This means that, on some pages, it will get stuck. Usually this happens on Canvas pages with an embedded Google Doc.

There are some hacks in the code to work around this, but it's not perfect. If your script does get stuck, the easiest fix is to just kill it (Control-C) and restart it. The script will pick up where it left off. You might not get the MHTML file for that page unfortunately, but you can always save the MHTML yourself in Chrome.

### Notes
* The browser window will stay open for an hour after completion (to allow manual inspection if needed)
* Confluence requires additional configuration (see service-specific notes below)
* The scripts handle pagination and navigation automatically; don't click on anything in the browser window that comes up!!
* Downloads are incremental - already downloaded content won't be re-downloaded. This means if a script crashes or get stuck, you can re-run it and it'll pick up where it left off.

### Service-specific notes

#### Canvas
* Downloads course content including:
  * Course homepages
  * Announcements
  * Modules
  * Files
  * Assignments
  * Discussions
  * Grades

##### Page names
Every Canvas course has a set of pages that are added by the teacher. The script recognizes a page's type by its name. (For example, the "Announcements" page is handled specially to ensure we capture all the announcements.)

If your Canvas course has a page name that isn't recognized, the script will error out. You can fix this by adding the page to [downloader/src/loader/canvas.ts](./downloader/src/loader/canvas.ts#L327). Most likely, you will want the "generic" archive type, which just saves that individual page and nothing else. In that case, you can add the page name to the list starting on line 327 of the canvas.ts file.

#### Confluence
* Requires `confluence-spaces.json` listing spaces to download
  * This belongs in the `downloader/` folder
  * It should be a JSON file, looking something like this: `["SomeCoolWiki", "OtherWiki"]`
  * You can find the space name in the URL of its pages
* Downloads:
  * Space homepages
  * All pages in each space
  * Page attachments
  * Page analytics

#### Gradescope
* Downloads:
  * Course homepages
  * Assignments
  * Submission files
  * Grade reports

#### WebSIS
* Downloads key student information pages:
  * Academic record
  * Registration status
  * Grade reports
  * Degree audit
  * Biographic records
  * Emergency contacts

#### EECSIS
* Downloads EECS-specific course, checklist, and grade information