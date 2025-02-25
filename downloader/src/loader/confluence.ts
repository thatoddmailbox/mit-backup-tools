import { Page } from "puppeteer";

import { Loader } from "./loader";
import { SaveRequest } from "../saveRequest";

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
		return [];
	}

	async preCapture(page: Page, req: SaveRequest) {
		// nothing to do
	}

	async discoverMoreRequests(page: Page, req: SaveRequest): Promise<SaveRequest[]> {
		return [];
	}
}