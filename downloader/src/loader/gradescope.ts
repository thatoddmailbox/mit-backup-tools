import { Page } from "puppeteer";

import { Loader } from "./loader";
import { SaveRequest } from "../saveRequest";

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
			list.push({
				url: "",
				title: "Homepage",
				format: "archive"
			});

			for (let i = 0; i < courseBoxes.length; i++) {
				const courseBox = courseBoxes[i] as HTMLAnchorElement;
				console.log("courseBox", courseBox);
				console.log("courseBox", (courseBox as any).href);

				const courseURL = courseBox.href;
				const courseShortName = courseBox.querySelector("h3")!.innerText;

				list.push({
					url: courseURL,
					title: courseShortName + "/Homepage",
					format: "archive"
				});
				break;
			}

			return list;
		});
		// const courseBoxes = await page.$$(".courseBox");
		// console.log("courseBoxes", courseBoxes);

		// for (let i = 0; i < courseBoxes.length; i++) {
		// 	const courseBox = courseBoxes[i];
		// 	console.log("courseBox", courseBox);
		// 	console.log("courseBox", courseBox);
		// }

		return [];
	}
}