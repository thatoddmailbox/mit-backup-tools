import { Page } from "puppeteer";

import { SaveRequest } from "../saveRequest";

export interface Loader {
	getSlug(): string;

	getInitialURL(): string;
	isLoggedIn(page: Page): Promise<boolean>;

	buildInitialList(page: Page): Promise<SaveRequest[]>;
};