import { $ } from "bun";
import { rmdir } from "node:fs/promises";
import packageJson from "./package.json";

await rmdir("./out", { recursive: true }).catch(() => {});

import fs from "fs";
import path from "path";

let commitInfo = {
	commitHash: process.env.COMMIT_HASH ?? "",
	buildDate: new Date().toISOString(),
	buildActor: process.env.BUILD_ACTOR ?? "",
	packageVersion:
		process.env.DEV === "TRUE"
			? "dev-" + packageJson.version
			: packageJson.version,
};

interface Options {
	humanReadable: boolean;
}

interface FileEntry {
	path: string;
	size: number;
	formattedSize: string;
}

interface Results {
	files: FileEntry[];
	totalSize: number;
	formattedTotal: string;
}

function listFileSizes(
	dirPath: string,
	options: Options = { humanReadable: true }
): Results | null {
	let totalSize = 0;
	const files: FileEntry[] = [];

	function formatSize(bytes: number): string {
		if (!options.humanReadable) return bytes.toString();

		const units = ["KB"];
		let size = bytes;
		let unitIndex = 0;

		size /= 1024;

		return `${size.toFixed(2).padStart(8)}${units[unitIndex]}`;
	}

	function processDirectory(currentPath: string): void {
		const items = fs.readdirSync(currentPath);

		items.forEach((item) => {
			const itemPath = path.join(currentPath, item);
			const stats = fs.statSync(itemPath);

			if (stats.isDirectory()) {
				processDirectory(itemPath);
			} else {
				const size = stats.size;
				totalSize += size;
				files.push({
					path: itemPath,
					size,
					formattedSize: formatSize(size),
				});
			}
		});
	}

	try {
		processDirectory(dirPath);
		return {
			files,
			totalSize,
			formattedTotal: formatSize(totalSize),
		};
	} catch (error) {
		if (error instanceof Error) {
			console.error(`Error processing directory: ${error.message}`);
		} else {
			console.error("An unknown error occurred");
		}
		return null;
	}
}

var router = new Bun.FileSystemRouter({
	style: "nextjs",
	dir: "./api",
	origin: process.env.ORIGIN || "http://localhost:3000",
});

const routesArr = Object.keys(router.routes);
const routeEntrypoints = [];

for (const route of routesArr) {
	const rtArr = route.split("/");
	if (rtArr.at(-1) === "route") {
		routeEntrypoints.push(rtArr.join("/"));
	}
}

const re = routeEntrypoints.map((rt) => `./api${rt}.ts`);

const result = await Bun.build({
	entrypoints: ["./server.ts", ...re],
	outdir: "./out",
	root: ".",
	target: "bun",
	splitting: true,
	minify: true,
	sourcemap: "linked",
});

if (result.success) {
	// Example usage:
	const targetDir = process.argv[2] || "./out";
	const results = listFileSizes(targetDir);

	if (results) {
		// Print each file and its size
		results.files
			.sort((a, b) => a.path.localeCompare(b.path))
			.forEach((file) => {
				console.log(`${file.formattedSize}\t${file.path}`);
			});

		// Print total
		console.log("\nTotal size:");
		console.log(`${results.formattedTotal}\t(${results.files.length} files)`);
	}
	console.log("Build successful");

	console.log(`\nCommit Hash: ${commitInfo.commitHash.trim()}`);
	console.log(`PackageVersion: ${packageJson.version}`);

	// write commit info to file
	fs.writeFileSync("./out/commit.json", JSON.stringify(commitInfo));
} else {
	console.error(result.logs, "Build failed");
}
