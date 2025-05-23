import puppeteer, { Browser, Page } from "puppeteer";

import { get } from "https";

import { Canvas } from "./loader/canvas";
import { Gradescope } from "./loader/gradescope";
import { Loader } from "./loader/loader";

import { delay } from "./util";

import { createWriteStream } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { basename, dirname } from "path/posix";
import { WebSIS } from "./loader/websis";
import { EECSIS } from "./loader/eecsis";
import { Confluence } from "./loader/confluence";

async function download(browser: Browser, page: Page, url: string, fullPath: string) {
	const userAgent = await page.evaluate(() => navigator.userAgent);

	const domain = url.split("/")[2];
	console.log("Domain is", domain);

	const cookies = await browser.cookies();
	// console.log("cookies", cookies);
	let cookieString = "";
	for (let i = 0; i < cookies.length; i++){
		const cookie = cookies[i];
		console.log(i, cookie.domain, domain, cookie);

		if (!domain.includes(cookie.domain)) {
			continue;
		}

		cookieString += cookie.name + "=" + cookie.value + ";";
	}

	console.log("Cookies are", cookieString);

	return await new Promise<void>((resolve, reject) => {
		get(url, {
			// hack that shouldn't be needed :)
			rejectUnauthorized: false,
			headers: {
				"Cookie": cookieString,
				"User-Agent": userAgent
			},
		}, (res) => {
			if (res.headers["set-cookie"]) {
				const cookieStrings = res.headers["set-cookie"];
				for (let i = 0; i < cookieStrings.length; i++) {
					const cookieString = res.headers["set-cookie"][i].split(";")[0];
					browser.setCookie({
						name: cookieString.split("=")[0],
						value: cookieString.split("=")[1],
						domain: domain
					});
				}
			}

			if (res.statusCode == 302) {
				const newURL = res.headers.location || "";
				console.log("Following redirect to", newURL);

				if (!newURL) {
					throw new Error("Got redirect but no new location?");
				}
				if (newURL.includes("/login")) {
					throw new Error("Got redirected to what seems like a login page...");
				}

				const result = download(browser, page, newURL, fullPath);
				result.then(resolve);
				result.catch(reject);
				return;
			}
			if (res.statusCode == 500) {
				console.log("Got 500 internal server error for ", url);
				console.log("Continuing...");
				resolve();
				return;
			}
			if (res.statusCode != 200) {
				throw new Error("Got unexpected status code " + res.statusCode);
			}

			const stream = createWriteStream(fullPath);
			stream.on("finish", () => {
				stream.close();
				resolve();
			});
			res.pipe(stream);
		});
	});
}

let outputPath = "";
export function getBaseOutputPath(): string {
	return outputPath;
};
let evilCount = 0;
export function increaseEvilCount() {
	evilCount = evilCount + 1;
};

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

	const loaders: Loader[] = [
		new Canvas(),
		new Confluence(),
		new EECSIS(),
		new Gradescope(),
		new WebSIS()
	];

	if (process.argv.length <= 2) {
		console.error("Please specify loader as a command line argument.");
		process.exit(1);
		return;
	}

	const targetSlug = process.argv[2];

	let loader: Loader | undefined;
	for (let i = 0; i < loaders.length; i++) {
		if (loaders[i].getSlug() == targetSlug) {
			loader = loaders[i];
			break;
		}
	}
	if (!loader) {
		console.error("Could not find loader '" + targetSlug + "'.");
		process.exit(1);
		return;
	}

	const cookiesString = await readFile("./cookies-" + loader.getSlug() + ".json");
	const cookies = JSON.parse(cookiesString.toString("utf-8"));
	await browser.setCookie(...cookies);

	outputPath = "output/" + loader.getSlug() + "/";
	await mkdir(outputPath, { recursive: true });

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

	for (let i = 0; i < queue.length; i++) {
		const item = queue[i];
		console.log("item", item);

		const fullPath = outputPath + item.title;

		if (item.format == "download") {
			console.log("let's download", item.url);

			await download(browser, page, item.url, fullPath);

			console.log("Download complete");

			continue;
		}

		if (item.url != "") {
			await page.goto(item.url);
		}
		if (!item.useDelayWait) {
			console.log("evilCount", evilCount);
			await page.waitForNetworkIdle({
				concurrency: evilCount
			});
		} else {
			await delay(item.useDelayWait);
		}

		await loader.preCapture(page, item);

		console.log("fullPath", fullPath);
		console.log("dirname(fullPath)", dirname(fullPath));
		console.log("basename(fullPath)", basename(fullPath));

		await mkdir(dirname(fullPath), { recursive: true });

		await page.emulateMediaType("screen");
		await page.pdf({
			landscape: true,
			path: fullPath + ".pdf"
		});

		const session = await page.createCDPSession();
		const { data } = await session.send("Page.captureSnapshot");
		await writeFile(fullPath + ".mhtml", data);
		await session.detach();

		const newRequests = await loader.discoverMoreRequests(page, item);
		for (let j = 0; j < newRequests.length; j++) {
			const newRequest = newRequests[j];
			queue.splice(i + 1, 0, newRequest);
		}
	}

	console.log("Done");

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