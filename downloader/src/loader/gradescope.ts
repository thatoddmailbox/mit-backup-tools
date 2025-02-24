import { Page } from "puppeteer";
import { mkdir, readdir } from "fs/promises";
import { resolve } from "path";

import { Loader } from "./loader";
import { SaveRequest } from "../saveRequest";
import { getBaseOutputPath } from "../main";

type GradescopeMeta = {
	pageType: "homepage";
} | {
	pageType: "course";
	courseDir: string;
} | {
	pageType: "assignment";
	courseDir: string;
	assignmentDir: string;
} | {
	pageType: "assignmentDownload"
};

export class Gradescope implements Loader {
	getSlug(): string {
		return "gradescope";
	}

	getInitialURL(): string {
		// https://www.gradescope.com/auth/saml/mit
		return "https://gradescope.com";
	}

	async isLoggedIn(page: Page): Promise<boolean> {
		const title = await page.title();

		if (title.includes("Your Courses")) {
			return true;
		}
		return false;
	}

	async buildInitialList(page: Page): Promise<SaveRequest[]> {
		return await page.evaluate(() => {
			const courseBoxes = document.querySelectorAll("a.courseBox");
			console.log("courseBoxes", courseBoxes);

			const list: SaveRequest[] = [];

			// homepage itself
			const homepageMeta: GradescopeMeta = {
				pageType: "homepage"
			};
			list.push({
				url: "",
				title: "Homepage",
				format: "archive",
				loaderMeta: homepageMeta
			});

			for (let i = 0; i < courseBoxes.length; i++) {
				const courseBox = courseBoxes[i] as HTMLAnchorElement;
				console.log("courseBox", courseBox);
				console.log("courseBox", (courseBox as any).href);

				const courseURL = courseBox.href;
				const courseURLParts = courseURL.split("/");
				const courseID = courseURLParts[courseURLParts.length - 1];
				const courseShortName = courseBox.querySelector("h3")!.innerText;

				const courseDir = courseShortName + "-" + courseID + "/";

				const pageMeta: GradescopeMeta = {
					pageType: "course",
					courseDir: courseDir
				};

				list.push({
					url: courseURL,
					title: courseDir + "Homepage",
					format: "archive",
					loaderMeta: pageMeta
				});
			}

			return list;
		});
	}

	async preCapture(page: Page, req: SaveRequest) {
		// nothing to do
	}

	async discoverMoreRequests(page: Page, req: SaveRequest): Promise<SaveRequest[]> {
		const meta = req.loaderMeta as GradescopeMeta;
		if (meta.pageType == "homepage") {
			return [];
		}

		if (meta.pageType == "course") {
			console.log("Time to discover assignments");

			const assignmentsDir = resolve(getBaseOutputPath(), meta.courseDir, "assignments");
			await mkdir(assignmentsDir, { recursive: true });
			const assignmentFolders = await readdir(assignmentsDir);
			console.log("assignmentFolders", assignmentFolders);

			return await page.evaluate((meta: GradescopeMeta, assignmentFolders: string[]) => {
				if (meta.pageType != "course") {
					throw new Error("This should never happen");
				}

				const result: SaveRequest[] = [];

				const table = document.querySelector("#assignments-student-table");
				if (!table) {
					throw new Error("Could not find assignment table");
				}

				const rows = table.querySelectorAll("tbody tr");
				console.log("rows", rows);

				for (let i = 0; i < rows.length; i++) {
					const row = rows[i];
					const rowLink = row.querySelector("a") as HTMLAnchorElement;

					if (!rowLink) {
						// no submission here, skip
						continue;
					}

					console.log("row", row);

					console.log("rowLink.href", rowLink.href);
					console.log("rowLink.innerText", rowLink.innerText);

					const assignmentName = rowLink.innerText;
					const assignmentDir = meta.courseDir + "assignments/" + assignmentName + "/";

					if (assignmentFolders.includes(assignmentName)) {
						// already have it
						console.log("Looks like we already have", assignmentName);
						continue;
					}

					const newPageMeta: GradescopeMeta = {
						pageType: "assignment",
						courseDir: meta.courseDir,
						assignmentDir: assignmentDir
					};

					result.push({
						url: rowLink.href,
						title: assignmentDir + "main",
						format: "archive",
						loaderMeta: newPageMeta
					});
				}

				return result;
			}, meta, assignmentFolders);
		}

		if (meta.pageType == "assignment") {
			return await page.evaluate((meta: GradescopeMeta) => {
				if (meta.pageType != "assignment") {
					throw new Error("This should never happen");
				}

				const assignmentViewerDiv = document.querySelector("div[data-react-class=AssignmentSubmissionViewer]");
				if (!assignmentViewerDiv) {
					console.log("Could not find assignment viewer div, assignment probably not viewable?");
					return [];
				}

				const reactPropsStr = assignmentViewerDiv.attributes.getNamedItem("data-react-props");
				if (!reactPropsStr) {
					throw new Error("Could not find react props");
				}

				const reactProps = JSON.parse(reactPropsStr.value);

				const newPageMeta: GradescopeMeta = {
					pageType: "assignmentDownload"
				};

				console.log("reactProps", reactProps);
				console.log("reactProps.paths.original_file_path", reactProps.paths.original_file_path);

				let req: SaveRequest;
				if (reactProps.paths.original_file_path != null) {
					// it's a pdf
					req = {
						url: reactProps.paths.original_file_path,
						title: meta.assignmentDir + "file.pdf",
						format: "download",
						loaderMeta: newPageMeta
					};
				} else if (reactProps.paths.submission_zip_path != null) {
					// it's not a pdf
					req = {
						url: window.location.origin + reactProps.paths.submission_zip_path,
						title: meta.assignmentDir + "file.zip",
						format: "download",
						loaderMeta: newPageMeta
					};
				} else if (reactProps.paths.graded_pdf_path != null) {
					// it's a quiz or something
					req = {
						url: window.location.origin + reactProps.paths.graded_pdf_path,
						title: meta.assignmentDir + "file.pdf",
						format: "download",
						loaderMeta: newPageMeta
					};
				} else {
					throw new Error("idk how to download this");
				}

				return [req];
			}, meta);
		}

		if (meta.pageType == "assignmentDownload") {
			return [];
		}

		throw new Error("Did not recognize page type " + (meta as any).pageType);
	}
}