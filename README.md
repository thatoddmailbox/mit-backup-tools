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
The scripts require authentication cookies to access MIT services. You'll need to provide cookies for each service you want to download from:

1. Log into each service in your browser (Canvas, Gradescope, etc.)
2. Use your browser's developer tools to export cookies
3. Save the cookies as JSON files in the `downloader` directory:
   - `cookies-canvas.json` for Canvas
   - `cookies-gradescope.json` for Gradescope
   - `cookies-websis.json` for WebSIS
   - `cookies-eecsis.json` for EECSIS
   - `cookies-confluence.json` for Confluence

For Confluence specifically, you'll also need to create a `confluence-spaces.json` file listing the spaces you want to download.

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

The scripts will:
1. Launch a browser window (visible, not headless)
2. Load your authentication cookies
3. Navigate through the service's pages
4. Save content in the `downloader/output/<service>` directory:
   * Pages are saved as both PDF and MHTML (multipart HTML) files
   * Files (like DOCX, PDFs) are downloaded directly
   * Content is organized in a directory structure matching the service's hierarchy

### Notes
* The browser window will stay open for an hour after completion (to allow manual inspection if needed)
* Some services may require additional configuration (see service-specific notes below)
* The scripts handle pagination and navigation automatically
* Downloads are incremental - already downloaded content won't be re-downloaded

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

#### Confluence
* Requires `confluence-spaces.json` listing spaces to download
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