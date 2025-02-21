import puppeteer from "puppeteer";

import { Gradescope } from "./loader/gradescope";
import { Loader } from "./loader/loader";

import { readFile, writeFile } from "fs/promises";

function delay(time: number) {
	return new Promise<void>((resolve, reject) => {
		setTimeout(() => {
			resolve();
		}, time);
	});
}

(async () => {
	console.log("Hello");

	const browser = await puppeteer.launch({
		headless: false,
		devtools: true
	});
	const page = await browser.newPage();
	await page.setViewport({
		width: 1366,
		height: 768
	});

	// const cdpSession = await page.createCDPSession();

	const loader: Loader = new Gradescope();

	const cookiesString = await readFile("./cookies-" + loader.getSlug() + ".json");
	const cookies = JSON.parse(cookiesString.toString("utf-8"));
	await browser.setCookie(...cookies);

	await page.goto(loader.getInitialURL());
	await page.waitForNetworkIdle();

	// const cookies = await browser.cookies();
	// await fs.writeFile('./cookies-bla.json', JSON.stringify(cookies, null, 2));

	const isLoggedIn = await loader.isLoggedIn(page);
	if (!isLoggedIn) {
		throw Error("Loader said you aren't logged in");
	}

	const queue = await loader.buildInitialList(page);
	console.log("queue", queue);

	for (var i = 0; i < queue.length; i++) {
		const item = queue[i];
		await page.goto(item.url)
		await page.waitForNetworkIdle();

		await page.emulateMediaType("screen");
		await page.pdf({
			landscape: true,
			path: "page.pdf"
		});
		// await cdpSession
	}

	// await page.type("input[name=username]", tisEmail);
	// await page.type("input[name=password]", tisPassword);

	// const submitButton = await page.$("#externalloginsubmit");
	// if (!submitButton) {
	// 	throw Error("couldn't find submit button");
	// }
	// await submitButton.click();

	await delay(60 * 60 * 1000);
	await browser.close();
})();