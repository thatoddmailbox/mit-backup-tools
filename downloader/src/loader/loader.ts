import { Page } from "puppeteer";

import { SaveRequest } from "../saveRequest";

export interface Loader {
	getSlug(): string;

	getInitialURL(): string;
	isLoggedIn(page: Page): Promise<boolean>;

	buildInitialList(page: Page): Promise<SaveRequest[]>;
	preCapture(page: Page, req: SaveRequest): Promise<void>;
	discoverMoreRequests(page: Page, req: SaveRequest): Promise<SaveRequest[]>;
};