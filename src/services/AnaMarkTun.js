// Ideal cents for all MIDI notes [0-127] given A4=440Hz
const idealCents = new Array(128).fill(0).map((_, i) => (i) * 100);

// Tuning line format:
// note [number]=[cents]
function parseTuningLine(line) {
	const match = line.match(/^note\s+(\d+)=\s*(-?\d+(?:\.\d+)?)$/);

	if (match) {
		const note = parseInt(match[1], 10);
		const cents = Math.round(parseFloat(match[2]));
		return { note, cents };
	}

	return null;
}

export function getOffsetsFromTunFile(tunFileContent, startNote = 36, endNote = 96) {
	tunFileContent = tunFileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n'); // Normalize line endings
	const lines = tunFileContent.split('\n');
	const offsets = new Array(61).fill(0);
	let inTuningSection = false;

	lines.forEach(line => {
		if (line.startsWith('[Exact Tuning]')) {
			inTuningSection = true;
		}

		// If we're in the tuning section, parse the offsets
		// Read until we hit an empty line
		if (inTuningSection) {
			if (line === '') {
				inTuningSection = false;
				return;
			}

			const parsed = parseTuningLine(line);

			if (parsed) {
				const { note, cents } = parsed;

				if (note >= startNote && note <= endNote) {
					offsets[note - startNote] = cents - idealCents[note];
				}
			}
		}
	});

	return offsets;
}
