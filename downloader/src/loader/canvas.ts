import { Page } from "puppeteer";
import { createInterface } from "readline";

import { Loader } from "./loader";
import { SaveRequest } from "../saveRequest";

type CanvasMeta = {
	pageType: "homepage";
} | {
	pageType: "genericArchive";
}  | {
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
	pageType: "assignment";
	courseDir: string;
	assignmentDir: string;
} | {
	pageType: "assignmentDownload"
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
		// await askQuestion("Please enable third-party cookies in Chrome, then press enter: ");
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

				// TODO: remove me!!!
				break;
			}

			return list;
		});
	}

	async discoverMoreRequests(page: Page, req: SaveRequest): Promise<SaveRequest[]> {
		const meta = req.loaderMeta as CanvasMeta;
		if (meta.pageType == "homepage") {
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

						// TODO: undo me!
						// result.push({
						// 	url: navMenuLink.href,
						// 	title: newPageMeta.announcementsDir + "main",
						// 	format: "archive",
						// 	loaderMeta: newPageMeta
						// });
					} else if (pageName == "Modules") {
						// TODO: handle me
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
						// TODO: handle me
					} else if (pageName == "Assignments" || pageName == "Quizzes") {
						// TODO: handle me
						// quizzess in 6.S983
					} else if (pageName == "Grades") {
						// TODO: handle me
					} else if (pageName == "Discussions") {
						// TODO: handle me
						// it's in 6.013
					} else if (pageName == "Pages") {
						// TODO: handle me
						// it's in 21M.385
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
						// skip these
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
			return await page.evaluate(async (meta: CanvasMeta) => {
				if (meta.pageType != "courseAnnouncements") {
					throw new Error("This should never happen");
				}

				const result: SaveRequest[] = [];

				const content = document.querySelector("#content");
				if (!content) {
					throw new Error("Could not find content");
				}

				// TODO: pagination
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

						// Formatted like "Dec 18, 2021, 5:30 PM"
						const dateString = (link.parentElement!.parentElement!.querySelector(".ic-item-row__meta-content-timestamp") as HTMLSpanElement).innerText
						const date = new Date(dateString);

						const formattedDate = date.toISOString().split("T")[0];

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
			}, meta);
		}

		if (meta.pageType == "courseModules") {
			return await page.evaluate(async (meta: CanvasMeta) => {
				if (meta.pageType != "courseModules") {
					throw new Error("This should never happen");
				}

				const result: SaveRequest[] = [];

				const items = document.querySelectorAll(".context_module_item a.title");

				for (let i = 0; i < items.length; i++) {
					const item = items[i] as HTMLAnchorElement;
					console.log("item", item);
					console.log("item.href", item.href);

					if (item.href.includes("{{ id }}")) {
						console.log("weird template thing, ignore");
						continue;
					}

					const itemLinkParts = item.href.split("/");
					const moduleID = itemLinkParts[itemLinkParts.length - 1];

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

						// result.push({
						// 	url: item.href,
						// 	title: meta.modulesDir + "module-" + moduleID,
						// 	format: "archive",
						// 	loaderMeta: newPageMeta
						// });
					}

				}

				return result;
			}, meta);
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

		// if (meta.pageType == "assignment") {
		// 	return await page.evaluate((meta: CanvasMeta) => {
		// 		if (meta.pageType != "assignment") {
		// 			throw new Error("This should never happen");
		// 		}

		// 		const assignmentViewerDiv = document.querySelector("div[data-react-class=AssignmentSubmissionViewer]");
		// 		if (!assignmentViewerDiv) {
		// 			throw new Error("Could not find assignment viewer div");
		// 		}

		// 		const reactPropsStr = assignmentViewerDiv.attributes.getNamedItem("data-react-props");
		// 		if (!reactPropsStr) {
		// 			throw new Error("Could not find react props");
		// 		}

		// 		const reactProps = JSON.parse(reactPropsStr.value);

		// 		const newPageMeta: CanvasMeta = {
		// 			pageType: "assignmentDownload"
		// 		};

		// 		console.log("reactProps", reactProps);
		// 		console.log("reactProps.paths.original_file_path", reactProps.paths.original_file_path);

		// 		let req: SaveRequest;
		// 		if (reactProps.paths.original_file_path != null) {
		// 			// it's a pdf
		// 			req = {
		// 				url: reactProps.paths.original_file_path,
		// 				title: meta.assignmentDir + "file.pdf",
		// 				format: "download",
		// 				loaderMeta: newPageMeta
		// 			};
		// 		} else if (reactProps.paths.submission_zip_path != null) {
		// 			// it's not a pdf
		// 			req = {
		// 				url: window.location.origin + reactProps.paths.submission_zip_path,
		// 				title: meta.assignmentDir + "file.zip",
		// 				format: "download",
		// 				loaderMeta: newPageMeta
		// 			};
		// 		} else {
		// 			throw new Error("idk how to download this");
		// 		}

		// 		return [req];
		// 	}, meta);
		// }

		// if (meta.pageType == "assignmentDownload") {
		// 	return [];
		// }

		throw new Error("Did not recognize page type " + (meta as any).pageType);
	}
}