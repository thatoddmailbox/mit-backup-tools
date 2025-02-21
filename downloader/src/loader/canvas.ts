import { Page } from "puppeteer";
import { createInterface } from "readline";

import { Loader } from "./loader";
import { SaveRequest } from "../saveRequest";

type CanvasMeta = {
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

				const newPageMeta: CanvasMeta = {
					pageType: "course",
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

	async discoverMoreRequests(page: Page, req: SaveRequest): Promise<SaveRequest[]> {
		return [];
		// const meta = req.loaderMeta as CanvasMeta;
		// if (meta.pageType == "homepage") {
		// 	return [];
		// }

		// if (meta.pageType == "course") {
		// 	console.log("Time to discover assignments");

		// 	return await page.evaluate((meta: CanvasMeta) => {
		// 		if (meta.pageType != "course") {
		// 			throw new Error("This should never happen");
		// 		}

		// 		const result: SaveRequest[] = [];

		// 		const table = document.querySelector("#assignments-student-table");
		// 		if (!table) {
		// 			throw new Error("Could not find assignment table");
		// 		}

		// 		const rows = table.querySelectorAll("tbody tr");
		// 		console.log("rows", rows);

		// 		for (let i = 0; i < rows.length; i++) {
		// 			const row = rows[i];
		// 			const rowLink = row.querySelector("a") as HTMLAnchorElement;

		// 			if (!rowLink) {
		// 				throw new Error("Could not find rowLink");
		// 			}

		// 			console.log("row", row);

		// 			console.log("rowLink.href", rowLink.href);
		// 			console.log("rowLink.innerText", rowLink.innerText);

		// 			const assignmentName = rowLink.innerText;
		// 			const assignmentDir = meta.courseDir + "assignments/" + assignmentName + "/";

		// 			const newPageMeta: CanvasMeta = {
		// 				pageType: "assignment",
		// 				courseDir: meta.courseDir,
		// 				assignmentDir: assignmentDir
		// 			};

		// 			result.push({
		// 				url: rowLink.href,
		// 				title: assignmentDir + "main",
		// 				format: "archive",
		// 				loaderMeta: newPageMeta
		// 			});
		// 		}

		// 		return result;
		// 	}, meta);
		// }

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

		// throw new Error("Did not recognize page type " + (meta as any).pageType);
	}
}