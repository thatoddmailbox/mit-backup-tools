export interface SaveRequest {
	url: string;
	title: string;
	format: "archive" | "download";
};