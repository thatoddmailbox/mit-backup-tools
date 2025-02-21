import puppeteer from "puppeteer";

function delay(time: number) {
	return new Promise<void>((resolve, reject) => {
		setTimeout(() => {
			resolve();
		}, time);
	});
}
const fs = require('fs').promises;

(async () => {
	console.log("Hello");

	const browser = await puppeteer.launch({
		headless: false
	});
	const page = await browser.newPage();
	await page.setViewport({
		width: 1366,
		height: 768
	});

	const cookiesString = await fs.readFile('./cookies-gradescope.json');
	const cookies = JSON.parse(cookiesString);
	await browser.setCookie(...cookies);

	await page.goto("https://gradescope.com"); //"https://techinfo.toyota.com");
	await page.waitForNetworkIdle();

	// const cookies = await browser.cookies();
	// await fs.writeFile('./cookies-bla.json', JSON.stringify(cookies, null, 2));

	const tisEmail = process.env.TIS_EMAIL;
	const tisPassword = process.env.TIS_PASSWORD;

	if (!tisEmail || !tisPassword) {
		throw Error("missing TIS_EMAIL and TIS_PASSWORD");
	}

	await page.type("input[name=username]", tisEmail);
	await page.type("input[name=password]", tisPassword);

	const submitButton = await page.$("#externalloginsubmit");
	if (!submitButton) {
		throw Error("couldn't find submit button");
	}
	await submitButton.click();

	await page.waitForNavigation();
	console.log("Logged in");

	// const ewd = new EWD("EM07X0U", "Prius", "2008");
	// await downloadHierarchicalDocument(page, ewd, "2008ewd");

	await delay(60 * 60 * 1000);
	await browser.close();
})();