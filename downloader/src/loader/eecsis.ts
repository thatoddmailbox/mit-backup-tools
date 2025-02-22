import { Page } from "puppeteer";

import { Loader } from "./loader";
import { SaveRequest } from "../saveRequest";

export class EECSIS implements Loader {
	getSlug(): string {
		return "eecsis";
	}

	getInitialURL(): string {
		return "https://eecsis.mit.edu/";
	}

	async isLoggedIn(page: Page): Promise<boolean> {
		const title = await page.title();
		// TODO: implement
		return true;
	}

	async buildInitialList(page: Page): Promise<SaveRequest[]> {
		return [
			{
				url: "https://eecsis.mit.edu/",
				title: "Homepage",
				format: "archive",
				loaderMeta: {}
			},
			{
				url: "https://eecsis.mit.edu/whos_taken_what.html",
				title: "Who's Taken What",
				format: "archive",
				loaderMeta: {}
			},
			{
				url: "https://eecsis.mit.edu/checklist.cgi",
				title: "Degree Checklist",
				format: "archive",
				loaderMeta: {}
			},
			{
				url: "https://eecsis.mit.edu/academic-information.html",
				title: "Academic Information",
				format: "archive",
				loaderMeta: {}
			}
		];
	}

	async preCapture(page: Page, req: SaveRequest) {
		// nothing to do
	}

	async discoverMoreRequests(page: Page, req: SaveRequest): Promise<SaveRequest[]> {
		return [];
	}
}