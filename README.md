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
TODO fill this in