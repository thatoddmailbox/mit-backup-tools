import { Page } from "puppeteer";
import { createInterface } from "readline";
import { readdir } from "fs/promises";
import { resolve } from "path";

import { Loader } from "./loader";
import { SaveRequest } from "../saveRequest";
import { delay } from "../util";
import { getBaseOutputPath, increaseEvilCount } from "../main";

type CanvasMeta = {
	pageType: "homepage";
} | {
	pageType: "genericArchive" | "courseGradesDetails" | "courseDiscussion";
} | {
	pageType: "courseHome";
	courseDir: string;
} | {
	pageType: "courseAnnouncements";
	courseDir: string;
	announcementsDir: string;
} | {
	pageType: "courseModules";
	courseDir: string;
	modulesDir: string;
} | {
	pageType: "courseModuleFile";
	moduleDir: string;
} | {
	pageType: "courseFiles";
	filesDir: string;
} | {
	pageType: "courseAssignments";
	assignmentsDir: string;
} | {
	pageType: "courseAssignment";
	assignmentDir: string;
} | {
	pageType: "courseAssignmentSubmission";
	assignmentDir: string;
} | {
	pageType: "coursePages";
	pagesDir: string;
} | {
	pageType: "courseDiscussions",
	discussionsDir: string;
};

// https://stackoverflow.com/a/50890409
function askQuestion(query: string) {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}

export class Canvas implements Loader {
	getSlug(): string {
		return "canvas";
	}

	getInitialURL(): string {
		return "https://canvas.mit.edu/courses";
	}

	async isLoggedIn(page: Page): Promise<boolean> {
		const title = await page.title();

		if (title.includes("Courses")) {
			return true;
		}
		return false;
	}

	async buildInitialList(page: Page): Promise<SaveRequest[]> {
		await askQuestion("Please enable third-party cookies in Chrome, then press enter: ");
		await page.reload();
		await page.waitForNetworkIdle();

		return await page.evaluate(() => {
			const list: SaveRequest[] = [];

			// homepage itself
			const homepageMeta: CanvasMeta = {
				pageType: "homepage"
			};
			list.push({
				url: "",
				title: "Homepage",
				format: "archive",
				loaderMeta: homepageMeta
			});

			const termMap: { [index: string] : string } = {
				"Default Term": "",
				"Spring Term (AY 2019-2020)": "2019SP",
				"Fall Term (AY 2020-2021)": "2020FA",
				"Spring Term (AY 2020-2021)": "2020SP",
				"Fall Term (AY 2021-2022)": "2021FA",
				"Spring Term (AY 2021-2022)": "2021SP",
				"Fall Term (AY 2022-2023)": "2022FA",
				"Spring Term (AY 2022-2023)": "2022SP",
				"Fall Term (AY 2023-2024)": "2023FA",
				"Spring Term (AY 2023-2024)": "2023SP",
			};

			const courseLinks = document.querySelectorAll("#past_enrollments_table tbody a");
			console.log("courseLinks", courseLinks);

			for (let i = 0; i < courseLinks.length; i++) {
				const courseLink = courseLinks[i] as HTMLAnchorElement;
				const courseLinkSpan = courseLink.querySelector("span") as HTMLSpanElement;

				console.log("courseLink", courseLink);
				console.log("courseLink.href", courseLink.href);
				console.log("courseLinkSpan.innerText", courseLinkSpan.innerText);

				const courseLinkParts = courseLink.href.split("/");
				const courseID = courseLinkParts[courseLinkParts.length - 1];

				const courseTermName = (courseLink.parentElement!.parentElement!.querySelector(".course-list-term-column") as any).innerText;
				const courseTermShortName = termMap[courseTermName] || "";

				const courseName = courseLinkSpan.innerText + "-" + courseTermShortName + "-" + courseID;
				console.log("courseName", courseName);

				// TODO: remove me!!!
				// if (!courseName.includes("6.013")) {
				// 	continue;
				// }

				const newPageMeta: CanvasMeta = {
					pageType: "courseHome",
					courseDir: courseName + "/"
				};

				list.push({
					url: courseLink.href,
					title: newPageMeta.courseDir + "Homepage",
					format: "archive",
					loaderMeta: newPageMeta
				});
			}

			return list;
		});
	}

	async preCapture(page: Page, req: SaveRequest) {
		const meta = req.loaderMeta as CanvasMeta;

		if (meta.pageType == "courseGradesDetails") {
			const detailsButton = await page.$("#show_all_details_button");
			if (!detailsButton) {
				return;
			}

			await detailsButton.click();
		}

		if (meta.pageType == "courseDiscussion") {
			const expandButtons = await page.$$(".discussion-expand-btn button");
			for (let i = 0; i < expandButtons.length; i++) {
				const expandButton = expandButtons[i];
				await expandButton.click();
			}

			if (expandButtons.length > 0) {
				await delay(5 * 1000);
			}
		}
	}

	async discoverMoreRequests(page: Page, req: SaveRequest): Promise<SaveRequest[]> {
		const meta = req.loaderMeta as CanvasMeta;
		if (meta.pageType == "homepage" || meta.pageType == "courseGradesDetails" || meta.pageType == "courseDiscussion") {
			return [];
		}

		if (meta.pageType == "courseHome") {
			console.log("Time to discover course stuff");

			return await page.evaluate((meta: CanvasMeta) => {
				if (meta.pageType != "courseHome") {
					throw new Error("This should never happen");
				}

				const result: SaveRequest[] = [];

				const navMenu = document.querySelector("nav[aria-label='Courses Navigation Menu']");
				if (!navMenu) {
					throw new Error("Could not find navMenu");
				}

				const navMenuLinks = navMenu.querySelectorAll("a");
				console.log("navMenuLinks", navMenuLinks);

				for (let i = 0; i < navMenuLinks.length; i++) {
					const navMenuLink = navMenuLinks[i];
					const disabledIcon = navMenuLink.querySelector("i.icon-off");

					console.log("navMenuLink", navMenuLink);

					if (disabledIcon) {
						// teacher view, it's disabled, skip
						continue;
					}

					console.log("navMenuLink.href", navMenuLink.href);
					console.log("navMenuLink.innerText", navMenuLink.innerText);

					const pageName = navMenuLink.innerText;

					// we don't care about every page (there is only so much we can archive)
					if (pageName == "Home") {
						// already got this
					} else if (pageName == "Announcements") {
						const newPageMeta: CanvasMeta = {
							pageType: "courseAnnouncements",
							courseDir: meta.courseDir,
							announcementsDir: meta.courseDir + "announcements/"
						};

						result.push({
							url: navMenuLink.href,
							title: newPageMeta.announcementsDir + "main",
							format: "archive",
							loaderMeta: newPageMeta
						});
					} else if (pageName == "Modules") {
						const newPageMeta: CanvasMeta = {
							pageType: "courseModules",
							courseDir: meta.courseDir,
							modulesDir: meta.courseDir + "modules/"
						};

						result.push({
							url: navMenuLink.href,
							title: newPageMeta.modulesDir + "main",
							format: "archive",
							loaderMeta: newPageMeta
						});
					} else if (pageName == "Files") {
						const newPageMeta: CanvasMeta = {
							pageType: "courseFiles",
							filesDir: meta.courseDir + "files/"
						};

						result.push({
							url: navMenuLink.href,
							title: newPageMeta.filesDir + "main",
							format: "archive",
							loaderMeta: newPageMeta
						});
					} else if (pageName == "Assignments" || pageName == "Quizzes") {
						// quizzess in 6.S983
						const newPageMeta: CanvasMeta = {
							pageType: "courseAssignments",
							assignmentsDir: meta.courseDir + "assignments/"
						};

						result.push({
							url: navMenuLink.href,
							title: newPageMeta.assignmentsDir + (pageName == "Quizzes" ? "quizzes" : "main"),
							format: "archive",
							loaderMeta: newPageMeta
						});
					} else if (pageName == "Grades") {
						const newPageMeta: CanvasMeta = {
							pageType: "genericArchive"
						};

						result.push({
							url: navMenuLink.href,
							title: meta.courseDir + "grades",
							format: "archive",
							loaderMeta: newPageMeta
						});

						const newPageMeta2: CanvasMeta = {
							pageType: "courseGradesDetails"
						};

						result.push({
							url: navMenuLink.href,
							title: meta.courseDir + "grades-details",
							format: "archive",
							loaderMeta: newPageMeta2
						});
					} else if (pageName == "Discussions") {
						// it's in 6.013
						const newPageMeta: CanvasMeta = {
							pageType: "courseDiscussions",
							discussionsDir: meta.courseDir + "discussions/"
						};

						result.push({
							url: navMenuLink.href,
							title: newPageMeta.discussionsDir + "main",
							format: "archive",
							loaderMeta: newPageMeta
						});
					} else if (pageName == "Pages") {
						// it's in 21M.385 only
						const newPageMeta: CanvasMeta = {
							pageType: "coursePages",
							pagesDir: meta.courseDir + "pages/"
						};

						result.push({
							url: navMenuLink.href.replace("/wiki", "/pages"),
							title: newPageMeta.pagesDir + "list",
							format: "archive",
							loaderMeta: newPageMeta
						});
					} else if (
						pageName == "Gradescope" ||
						pageName == "Panopto Video" ||
						pageName == "Zoom" ||
						pageName == "Dropbox for Canvas" ||
						pageName == "Piazza" ||
						pageName == "Study.Net Materials" ||
						pageName == "Course Overview" ||
						pageName == "Videos" ||
						pageName == "Photobook" ||
						pageName == "MITx Course Page" ||
						pageName == "New Analytics" ||
						pageName == "Settings" ||
						pageName == "People" ||
						pageName == "Subject Evaluation Reports" ||
						pageName == "Course Evaluations" ||
						pageName == "EvaluationKIT Auth" ||
						pageName == "Syllabus" ||
						pageName == "Class Dropbox Files"
					) {
						// treat these as generic
						const newPageMeta: CanvasMeta = {
							pageType: "genericArchive"
						};

						result.push({
							url: navMenuLink.href,
							title: meta.courseDir + pageName,
							format: "archive",
							loaderMeta: newPageMeta
						});
					} else {
						throw new Error("idk what to do with '" + pageName + "'");
					}

					// const assignmentName = rowLink.innerText;
					// const assignmentDir = meta.courseDir + "assignments/" + assignmentName + "/";

					// const newPageMeta: CanvasMeta = {
					// 	pageType: "assignment",
					// 	courseDir: meta.courseDir,
					// 	assignmentDir: assignmentDir
					// };

					// result.push({
					// 	url: rowLink.href,
					// 	title: assignmentDir + "main",
					// 	format: "archive",
					// 	loaderMeta: newPageMeta
					// });
				}

				return result;
			}, meta);
		}

		if (meta.pageType == "genericArchive") {
			return [];
		}

		if (meta.pageType == "courseAnnouncements") {
			const existingAnnouncementIDs = [];
			const announcementFiles = await readdir(resolve(getBaseOutputPath(), meta.announcementsDir));
			console.log("announcementFiles", announcementFiles);
			for (let i = 0; i < announcementFiles.length; i++) {
				const announcementFile = announcementFiles[i];
				if (announcementFile.startsWith("announcement-")) {
					const announcementID = announcementFile.replace("/", "").split(".")[0].split("-")[4];
					existingAnnouncementIDs.push(announcementID);
				}
			}
			console.log("existingAnnouncementIDs", existingAnnouncementIDs);

			return await page.evaluate(async (meta: CanvasMeta, existingAnnouncementIDs: string[]) => {
				if (meta.pageType != "courseAnnouncements") {
					throw new Error("This should never happen");
				}

				const result: SaveRequest[] = [];

				const content = document.querySelector("#content");
				if (!content) {
					throw new Error("Could not find content");
				}

				const pagination = content.querySelector("div[role=navigation]");
				let pages: (HTMLButtonElement | null)[] = [null];
				if (pagination) {
					console.log("We have a pagination control");
					pages = [];
					pagination.querySelectorAll("button").forEach((button) => {
						pages.push(button);
					});
				}

				for (var i = 0; i < pages.length; i++) {
					console.log("Page", i);

					const page = pages[i];
					if (page) {
						page.click();

						await new Promise<void>((resolve, reject) => {
							setTimeout(() => {
								resolve();
							}, 5*1000);
						});
					}

					// process links
					const links = content.querySelectorAll("a.ic-item-row__content-link");
					for (let i = 0; i < links.length; i++) {
						const link = links[i] as HTMLAnchorElement;

						console.log("href", link.href);

						const linkParts = link.href.split("/");
						const announcementID = linkParts[linkParts.length - 1];
						console.log("announcementID", announcementID);

						if (existingAnnouncementIDs.indexOf(announcementID) > -1) {
							continue;
						}

						// Formatted like "Dec 18, 2021, 5:30 PM"
						const dateString = (link.parentElement!.parentElement!.querySelector(".ic-item-row__meta-content-timestamp") as HTMLSpanElement).innerText;
						console.log("dateString", dateString);
						let formattedDate = "";

						if (dateString) {
							const date = new Date(dateString);

							formattedDate = date.toISOString().split("T")[0];
						}

						const newPageMeta: CanvasMeta = {
							pageType: "genericArchive"
						};

						result.push({
							url: link.href,
							title: meta.announcementsDir + "announcement-" + formattedDate + "-" + announcementID,
							format: "archive",
							loaderMeta: newPageMeta
						});
					}
				}

				return result;
			}, meta, existingAnnouncementIDs);
		}

		if (meta.pageType == "courseModules") {
			const existingModuleIDs = [];
			const moduleFiles = await readdir(resolve(getBaseOutputPath(), meta.modulesDir));
			console.log("moduleFiles", moduleFiles);
			for (let i = 0; i < moduleFiles.length; i++) {
				const moduleFile = moduleFiles[i];
				if (moduleFile.startsWith("module-")) {
					const moduleID = moduleFile.replace("/", "").split(".")[0].split("-")[1];
					existingModuleIDs.push(moduleID);
				}
			}
			console.log("existingModuleIDs", existingModuleIDs);

			return await page.evaluate(async (meta: CanvasMeta, existingModuleIDs: string[]) => {
				if (meta.pageType != "courseModules") {
					throw new Error("This should never happen");
				}

				const result: SaveRequest[] = [];

				const items = document.querySelectorAll(".context_module_item a.title");

				for (let i = 0; i < items.length; i++) {
					const item = items[i] as HTMLAnchorElement;
					console.log("item", item);
					console.log("item.href", item.href);

					if (decodeURI(item.href).includes("{{ id }}")) {
						console.log("weird template thing, ignore");
						continue;
					}
					if (!item.href.includes("canvas.mit.edu")) {
						console.log("External link, ignore");
						continue;
					}

					const itemLinkParts = item.href.split("/");
					const moduleID = itemLinkParts[itemLinkParts.length - 1];

					if (existingModuleIDs.indexOf(moduleID) > -1) {
						continue;
					}

					// possible class names include
					// attachment
					// discussion_topic
					// assignment
					// quiz
					// lti-quiz
					// external_url

					// only one we handle specially is attachment
					const isAttachment = item.parentElement!.parentElement!.parentElement!.parentElement!.parentElement!.classList.contains("attachment")
					if (isAttachment) {
						const newPageMeta: CanvasMeta = {
							pageType: "courseModuleFile",
							moduleDir: meta.modulesDir + "module-" + moduleID + "/"
						};

						result.push({
							url: item.href,
							title: newPageMeta.moduleDir + "main",
							format: "archive",
							loaderMeta: newPageMeta,
							useDelayWait: 7*1000
						});
					} else {
						const newPageMeta: CanvasMeta = {
							pageType: "genericArchive"
						};

						result.push({
							url: item.href,
							title: meta.modulesDir + "module-" + moduleID,
							format: "archive",
							loaderMeta: newPageMeta
						});
					}

				}

				return result;
			}, meta, existingModuleIDs);
		}

		if (meta.pageType == "courseModuleFile") {
			return page.evaluate(async (meta: CanvasMeta) => {
				if (meta.pageType != "courseModuleFile") {
					throw new Error("This should never happen");
				}

				const result: SaveRequest[] = [];

				const downloadLink = document.querySelector("a[download]");
				if (!downloadLink) {
					throw new Error("Could not find download link");
				}

				const downloadURL = (downloadLink as HTMLAnchorElement).href;
				const downloadFilename = (downloadLink as HTMLAnchorElement).innerText.replace("Download ", "");

				const newPageMeta: CanvasMeta = {
					pageType: "genericArchive"
				};

				result.push({
					url: downloadURL,
					title: meta.moduleDir + downloadFilename,
					format: "download",
					loaderMeta: newPageMeta
				});

				return result;
			}, meta);
		}

		if (meta.pageType == "courseFiles") {
			return page.evaluate(async (meta: CanvasMeta) => {
				if (meta.pageType != "courseFiles") {
					throw new Error("This should never happen");
				}

				const result: SaveRequest[] = [];

				const fileItems = document.querySelectorAll(".ef-item-row a.ef-name-col__link");
				for (let i = 0; i < fileItems.length; i++) {
					const fileItem = fileItems[i] as HTMLAnchorElement;

					const fileName = fileItem.innerText.replace(/\//g, "_");
					const fileURL = fileItem.href;
					const fileIsFolder = fileURL.includes("/folder/");

					console.log(fileName, fileURL, fileIsFolder);

					if (fileIsFolder) {
						const newPageMeta: CanvasMeta = {
							pageType: "courseFiles",
							filesDir: meta.filesDir + fileName + "/"
						};

						result.push({
							url: fileURL,
							title: newPageMeta.filesDir + "main",
							format: "archive",
							loaderMeta: newPageMeta
						});
					} else {
						const newPageMeta: CanvasMeta = {
							pageType: "genericArchive"
						};

						result.push({
							url: fileURL,
							title: meta.filesDir + fileName,
							format: "download",
							loaderMeta: newPageMeta
						});
					}
				}

				return result;
			}, meta);
		}

		if (meta.pageType == "courseAssignments") {
			return page.evaluate(async (meta: CanvasMeta) => {
				if (meta.pageType != "courseAssignments") {
					throw new Error("This should never happen");
				}

				const result: SaveRequest[] = [];

				const assignments = document.querySelectorAll("#content .assignment a");
				for (let i = 0; i < assignments.length; i++) {
					const assignment = assignments[i] as HTMLAnchorElement;

					const assignmentName = assignment.innerText;
					const assignmentURL = assignment.href;

					const assignmentURLParts = assignmentURL.split("/");
					const assignmentID = assignmentURLParts[assignmentURLParts.length - 1];

					console.log(assignmentName, assignmentURL);

					const newPageMeta: CanvasMeta = {
						pageType: "courseAssignment",
						assignmentDir: meta.assignmentsDir + "assignment-" + assignmentID + "-" + assignmentName + "/"
					};

					result.push({
						url: assignmentURL,
						title: newPageMeta.assignmentDir + "main",
						format: "archive",
						loaderMeta: newPageMeta
					});
				}

				return result;
			}, meta);
		}

		if (meta.pageType == "courseAssignment") {
			return page.evaluate(async (meta: CanvasMeta) => {
				if (meta.pageType != "courseAssignment") {
					throw new Error("This should never happen");
				}

				const sidebarLinks = document.querySelectorAll("#sidebar_content a");

				const result: SaveRequest[] = [];

				for (let i = 0; i < sidebarLinks.length; i++) {
					const sidebarLink = sidebarLinks[i] as HTMLAnchorElement;

					const sidebarLinkName = sidebarLink.innerText;
					const sidebarLinkURL = sidebarLink.href;

					if (sidebarLinkName == "Submission Details") {
						const newPageMeta: CanvasMeta = {
							pageType: "courseAssignmentSubmission",
							assignmentDir: meta.assignmentDir
						};

						result.push({
							url: sidebarLinkURL,
							title: meta.assignmentDir + "details",
							format: "archive",
							loaderMeta: newPageMeta
						});
					} else if (sidebarLinkName.indexOf("Download ") == 0) {
						const newPageMeta: CanvasMeta = {
							pageType: "genericArchive"
						};

						const fileName = sidebarLinkName.replace("Download ", "");

						result.push({
							url: sidebarLinkURL,
							title: meta.assignmentDir + fileName,
							format: "download",
							loaderMeta: newPageMeta
						});
					}
				}

				return result;
			}, meta);
		}

		if (meta.pageType == "courseAssignmentSubmission") {
			const previewFrame = await page.$("#preview_frame");
			if (!previewFrame) {
				throw new Error("Could not find preview frame");
			}

			const previewFrameContent = await previewFrame.contentFrame();
			if (!previewFrameContent) {
				throw new Error("Could not find preview frame content");
			}

			const foundFeedback = await previewFrameContent.evaluate(async () => {
				const feedbackLink = document.querySelector(".file-upload-submission-attachment a") as HTMLAnchorElement | undefined;
				if (feedbackLink && feedbackLink.innerText == "View Feedback") {
					feedbackLink.click();

					await new Promise<void>((resolve) => {
						setTimeout(() => {
							resolve();
						}, 12*1000);
					});

					return true;
				}

				return false;
			});

			if (!foundFeedback) {
				return [];
			}

			const docFrame = await previewFrameContent.waitForSelector(".ui-dialog-content iframe");
			if (!docFrame) {
				throw new Error("Could not find doc frame");
			}

			const docFrameContent = await docFrame.contentFrame();
			if (!docFrameContent) {
				throw new Error("Could not find doc frame content");
			}

			const downloadButton = await docFrameContent.waitForSelector(".download-button--button");
			if (!downloadButton) {
				throw new Error("Could not find download button");
			}

			increaseEvilCount();

			const absoluteDownloadPath = resolve(getBaseOutputPath(), meta.assignmentDir);
			const session = await page.createCDPSession();
			await session.send("Browser.setDownloadBehavior", {
				behavior: "allow",
				downloadPath: absoluteDownloadPath,
			});
			await session.detach();
			console.log("meta.assignmentDir", meta.assignmentDir);
			console.log("absoluteDownloadPath", absoluteDownloadPath);

			await downloadButton.click();

			await delay(20 * 1000);

			return [];
		}

		if (meta.pageType == "coursePages") {
			return page.evaluate(async (meta: CanvasMeta) => {
				if (meta.pageType != "coursePages") {
					throw new Error("This should never happen");
				}

				const pageLinks = document.querySelectorAll(".wiki-page-title a");

				const result: SaveRequest[] = [];

				for (let i = 0; i < pageLinks.length; i++) {
					const pageLink = pageLinks[i] as HTMLAnchorElement;

					const pageLinkName = pageLink.innerText;
					const pageLinkURL = pageLink.href;

					const newPageMeta: CanvasMeta = {
						pageType: "genericArchive"
					};

					result.push({
						url: pageLinkURL,
						title: meta.pagesDir + pageLinkName.replace(/\//g, "_"),
						format: "archive",
						loaderMeta: newPageMeta
					});
				}

				return result;
			}, meta);
		}

		if (meta.pageType == "courseDiscussions") {
			const existingDiscussions = [];
			const discussionFiles = await readdir(resolve(getBaseOutputPath(), meta.discussionsDir));
			console.log("discussionFiles", discussionFiles);
			for (let i = 0; i < discussionFiles.length; i++) {
				const discussionFile = discussionFiles[i];
				const discussion = discussionFile.replace("_", "/").split(".")[0];
				existingDiscussions.push(discussion);
			}
			console.log("existingDiscussions", existingDiscussions);

			return page.evaluate(async (meta: CanvasMeta, existingDiscussions: string[]) => {
				if (meta.pageType != "courseDiscussions") {
					throw new Error("This should never happen");
				}

				const discussionLinks = document.querySelectorAll(".ic-discussion-content-container a");

				const result: SaveRequest[] = [];

				for (let i = 0; i < discussionLinks.length; i++) {
					const discussionLink = discussionLinks[i] as HTMLAnchorElement;

					const discussionLinkName = discussionLink.querySelector("span")!.innerText;
					const discussionLinkURL = discussionLink.href;

					if (existingDiscussions.indexOf(discussionLinkName) > -1) {
						continue;
					}

					const newPageMeta: CanvasMeta = {
						pageType: "courseDiscussion"
					};

					result.push({
						url: discussionLinkURL,
						title: meta.discussionsDir + discussionLinkName.replace(/\//g, "_"),
						format: "archive",
						loaderMeta: newPageMeta,
						useDelayWait: 3 * 1000
					});
				}

				return result;
			}, meta, existingDiscussions);
		}

		throw new Error("Did not recognize page type " + (meta as any).pageType);
	}
}