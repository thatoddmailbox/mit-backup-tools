import { Page } from "puppeteer";

import { Loader } from "./loader";
import { SaveRequest } from "../saveRequest";

export class WebSIS implements Loader {
	getSlug(): string {
		return "websis";
	}

	getInitialURL(): string {
		return "https://student.mit.edu/cgi-bin/shrwssor.sh";
	}

	async isLoggedIn(page: Page): Promise<boolean> {
		const title = await page.title();

		if (title.includes("Status of Registration")) {
			return true;
		}
		return false;
	}

	async buildInitialList(page: Page): Promise<SaveRequest[]> {
		return [
			{
				url: "https://student.mit.edu/",
				title: "Homepage",
				format: "archive",
				loaderMeta: {}
			},
			{
				url: "https://student.mit.edu/cgi-docs/student.html",
				title: "Student Homepage",
				format: "archive",
				loaderMeta: {}
			},
			{
				url: "https://student.mit.edu/cgi-docs/shrwstop.html",
				title: "Academic Record",
				format: "archive",
				loaderMeta: {}
			},
			{
				url: "https://student.mit.edu/cgi-bin/shrwssor.sh",
				title: "Status of Registration",
				format: "archive",
				loaderMeta: {}
			},
			{
				url: "https://student.mit.edu/cgi-bin/shrwsgrd.sh",
				title: "Grade Report",
				format: "archive",
				loaderMeta: {}
			},
			{
				url: "https://student.mit.edu/cgi-bin/shrwsdau.sh",
				title: "Undergraduate Degree Audit",
				format: "archive",
				loaderMeta: {}
			},
			{
				url: "https://student.mit.edu/cgi-docs/sfprwups.html",
				title: "Biographic and Emergency Records",
				format: "archive",
				loaderMeta: {}
			},
			{
				url: "https://student.mit.edu/cgi-bin/sppwsadr.sh",
				title: "Addresses and Phone Numbers",
				format: "archive",
				loaderMeta: {}
			},
			{
				url: "https://student.mit.edu/cgi-docs/sfprwemr.html",
				title: "Emergency Record",
				format: "archive",
				loaderMeta: {}
			},
			{
				url: "https://student.mit.edu/cgi-bin/sfprwemg.sh",
				title: "Emergency Contacts",
				format: "archive",
				loaderMeta: {}
			},
			{
				url: "https://student.mit.edu/cgi-bin/sppwsbio.sh",
				title: "Student Biographic Record",
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