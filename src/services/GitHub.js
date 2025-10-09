const proxyUrl = 'https://githubproxy.bishbashbosh.work';

export async function getLatestRelease(device) {
	const url = 'https://api.github.com/repos/superlativeinstruments/firmware-releases/releases';
	const headers = {
		'User-Agent': 'SB01ControlPanel/1.0'
	};

	const releases = await fetch(`${proxyUrl}?url=${encodeURIComponent(url)}`, {headers}).then(_ => _.json());

	// Find the latest prerelease
	const prerelease = releases.find(r => r.prerelease);
	const prereleaseChangelog = prerelease.assets.find(a => a.name.endsWith('.md')).browser_download_url;
	const prereleaseDateTimeRaw = prerelease.body.match(/Build Time: (.*)/)[1] + 'Z';
	const prereleaseDateTime = new Date(prereleaseDateTimeRaw);

	// Find the latest release
	const release = releases.find(r => !r.prerelease);
	let releaseChangelog;
	let releaseDateTime = new Date('1970-01-01T00:00:00Z');

	if (release) {
		releaseChangelog = release.assets.find(a => a.name.endsWith('.md')).browser_download_url;
		releaseDateTimeRaw = release.body.match(/Build Time: (.*)/)[1] + 'Z';
		releaseDateTime = new Date(releaseDateTimeRaw);
	}

	return {prereleaseChangelog, prereleaseDateTime, releaseChangelog, releaseDateTime};
}
