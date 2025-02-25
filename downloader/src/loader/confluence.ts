import { Page } from "puppeteer";

import { readFile } from "fs/promises";

import { Loader } from "./loader";
import { SaveRequest } from "../saveRequest";

type ConfluenceMeta = {
	pageType: "spaceHome";
	spaceDir: string;
} | {
	pageType: "spacePage";
	pageDir: string;
} | {
	pageType: "spacePageAttachments";
	attachmentsDir: string;
} | {
	pageType: "spacePageAttachmentDownload"
} | {
	pageType: "spacePageAnalytics"
};

export class Confluence implements Loader {
	getSlug(): string {
		return "confluence";
	}

	getInitialURL(): string {
		return "https://wikis.mit.edu/";
	}

	async isLoggedIn(page: Page): Promise<boolean> {
		const menuLink = await page.$("#user-menu-link");
		return menuLink != null;
	}

	async buildInitialList(page: Page): Promise<SaveRequest[]> {
		const confluenceSpacesJSON = await readFile("confluence-spaces.json");
		const confluenceSpaces = JSON.parse(confluenceSpacesJSON.toString("utf8")) as string[];

		const result: SaveRequest[] = [];

		for (let i = 0; i < confluenceSpaces.length; i++) {
			const confluenceSpace = confluenceSpaces[i];

			const pageMeta: ConfluenceMeta = {
				pageType: "spaceHome",
				spaceDir: confluenceSpace + "/"
			};

			result.push({
				url: "https://wikis.mit.edu/confluence/display/" + confluenceSpace,
				title: confluenceSpace + "/Homepage",
				format: "archive",
				loaderMeta: pageMeta
			});
		}

		return result;
	}

	async preCapture(page: Page, req: SaveRequest) {
		// nothing to do
	}

	async discoverMoreRequests(page: Page, req: SaveRequest): Promise<SaveRequest[]> {
		const meta = req.loaderMeta as ConfluenceMeta;

		if (meta.pageType == "spaceHome") {
			// expand everything in the hierarchy
			// repeat until there's nothing left
			let somethingLeft = true;
			while (somethingLeft) {
				somethingLeft = await page.evaluate(() => {
					const toggles = document.querySelectorAll(".ia-splitter .plugin_pagetree_children a.plugin_pagetree_childtoggle");

					let foundSomething = false;
					for (let i = 0; i < toggles.length; i++) {
						const toggle = toggles[i] as HTMLAnchorElement;
						const isExpanded = toggle.classList.contains("aui-iconfont-chevron-down");
						if (isExpanded) {
							continue;
						}

						foundSomething = true;
						toggle.click();
					}

					return foundSomething;
				});

				await page.waitForNetworkIdle();
			}

			// ok, at this point the hierarchy should be open
			// now we build the list of pages
			return await page.evaluate((meta: ConfluenceMeta) => {
				if (meta.pageType != "spaceHome") {
					throw new Error("This should never happen");
				}

				const result: SaveRequest[] = [];

				const processLevel = (e: HTMLUListElement, prefix: string[], pathPrefix: string) => {
					for (let i = 0; i < e.children.length; i++) {
						const child = e.children[i];

						const childLink = child.querySelector(":scope > .plugin_pagetree_children_content a") as HTMLAnchorElement | null;
						if (!childLink) {
							throw new Error("This should not happen...");
						}

						const pageName = childLink.innerText;
						const pageURL = childLink.href;

						console.log(prefix, pageName, pageURL);

						const pagePath = pathPrefix + pageName.replace(/\//g, "_") + "/";

						const newPageMeta: ConfluenceMeta = {
							pageType: "spacePage",
							pageDir: pagePath
						};

						result.push({
							url: pageURL,
							title: pagePath + "index",
							format: "archive",
							loaderMeta: newPageMeta
						});

						const subchildren = child.querySelector(":scope > .plugin_pagetree_children_container > ul.plugin_pagetree_children_list") as HTMLUListElement | null;
						if (subchildren) {
							const newPrefix = [...prefix];
							newPrefix.push(pageName);
							processLevel(subchildren, newPrefix, pagePath);
						}
					}
				};

				const firstLevel = document.querySelector(".plugin_pagetree > .plugin_pagetree_children_list > .plugin_pagetree_children > ul.plugin_pagetree_children_list");
				if (!firstLevel) {
					throw new Error("Could not find first level of hierarchy");
				}
				processLevel(firstLevel as HTMLUListElement, [], meta.spaceDir);

				return result;
			}, meta);
		}

		if (meta.pageType == "spacePage") {
			return await page.evaluate((meta: ConfluenceMeta) => {
				if (meta.pageType != "spacePage") {
					throw new Error("This should never happen");
				}

				const result: SaveRequest[] = [];

				// look for attachments
				const attachmentsLink = document.querySelector("#content-metadata-attachments") as HTMLAnchorElement | null;
				if (attachmentsLink) {
					const newPageMeta: ConfluenceMeta = {
						pageType: "spacePageAttachments",
						attachmentsDir: meta.pageDir + "_attachments/"
					};

					result.push({
						url: attachmentsLink.href,
						title: newPageMeta.attachmentsDir + "index",
						format: "archive",
						loaderMeta: newPageMeta
					});
				}

				// look for analytics
				const analyticsLink = document.querySelector(".analytics-metadata-button-test") as HTMLAnchorElement | null;
				if (analyticsLink) {
					const newPageMeta: ConfluenceMeta = {
						pageType: "spacePageAnalytics"
					};

					result.push({
						url: analyticsLink.href,
						title: meta.pageDir + "_analytics",
						format: "archive",
						loaderMeta: newPageMeta
					});
				}

				return result;
			}, meta);
		}

		if (meta.pageType == "spacePageAttachments") {
			return await page.evaluate((meta: ConfluenceMeta) => {
				if (meta.pageType != "spacePageAttachments") {
					throw new Error("This should never happen");
				}

				const result: SaveRequest[] = [];

				const attachmentLinks = document.querySelectorAll(".attachments tr:not(.hidden) a.filename");
				for (let i = 0; i < attachmentLinks.length; i++) {
					const attachmentLink = attachmentLinks[i] as HTMLAnchorElement;

					const attachmentName = attachmentLink.innerText;
					const attachmentURL = attachmentLink.href;

					const newPageMeta: ConfluenceMeta = {
						pageType: "spacePageAttachmentDownload"
					};

					result.push({
						url: attachmentURL,
						title: meta.attachmentsDir + attachmentName.replace(/\//g, "_"),
						format: "download",
						loaderMeta: newPageMeta
					});
				}

				return result;
			}, meta);
		}

		if (meta.pageType == "spacePageAttachmentDownload" || meta.pageType == "spacePageAnalytics") {
			// nothing to do
			return [];
		}

		throw new Error("Did not recognize page type " + (meta as any).pageType);
	}
}