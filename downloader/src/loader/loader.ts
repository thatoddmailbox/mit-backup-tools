import { Page } from "puppeteer";

import { SaveRequest } from "../saveRequest";

export interface Loader {
	getInitialURL(): string;
	isLoggedIn(page: Page): Promise<boolean>;

	buildInitialList(page: Page): Promise<SaveRequest[]>;
};