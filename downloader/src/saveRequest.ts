export interface SaveRequest {
	url: string;
	title: string;
	format: "archive" | "download";
	loaderMeta: any;
	useDelayWait?: number;
};