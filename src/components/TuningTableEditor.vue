<script>
</script>

<script setup>
import { useFloating } from '@floating-ui/vue';
import { ref, onMounted, watch, defineEmits, nextTick } from 'vue';
import { computePosition, flip, shift, offset } from '@floating-ui/vue';
import { getOffsetsFromTunFile } from '../services/AnaMarkTun.js';

const tuningPresets = ref([
	{file: 'tunings/just-intonation/c.tun', name: 'Just Intonation - C'},
	{file: 'tunings/just-intonation/csharp.tun', name: 'Just Intonation - C#'},
	{file: 'tunings/just-intonation/d.tun', name: 'Just Intonation - D'},
	{file: 'tunings/just-intonation/dsharp.tun', name: 'Just Intonation - D#'},
	{file: 'tunings/just-intonation/e.tun', name: 'Just Intonation - E'},
	{file: 'tunings/just-intonation/f.tun', name: 'Just Intonation - F'},
	{file: 'tunings/just-intonation/fsharp.tun', name: 'Just Intonation - F#'},
	{file: 'tunings/just-intonation/g.tun', name: 'Just Intonation - G'},
	{file: 'tunings/just-intonation/gsharp.tun', name: 'Just Intonation - G#'},
	{file: 'tunings/just-intonation/a.tun', name: 'Just Intonation - A'},
	{file: 'tunings/just-intonation/asharp.tun', name: 'Just Intonation - A#'},
	{file: 'tunings/just-intonation/b.tun', name: 'Just Intonation - B'},
]);
const selectedPreset = ref('');

const tooltipTrigger = ref(null);
const tooltipContent = ref(null);
const showTooltip = ref(false);
const tooltipStyle = ref({});

const updatePosition = async () => {
  if (tooltipTrigger.value && tooltipContent.value) {
    const { x, y } = await computePosition(tooltipTrigger.value, tooltipContent.value, {
      placement: 'top',
      middleware: [
        offset(0),
        flip(),
        shift({ padding: 5 })
      ]
    });
    
    tooltipStyle.value = {
      position: 'fixed',
      left: `${x}px`,
      top: `${y}px`,
      zIndex: 9999,
    };
  }
};

watch(showTooltip, async (show) => {
  if (show) {
    await nextTick();
    updatePosition();
  }
});

const props = defineProps({
	tuningTable: {
		type: Array,
		default: () => new Array(61).fill(0)
	}
});

const emit = defineEmits(['dataUpdated']);
const offsets = ref(new Array(61).fill(0));
const keyPositions = ref(null);
const keyLabels = ref(null);
const activeKey = ref(null);
const tuningCollapseOpen = ref(false);
let offsetWrapperElement;
let keyElements;
let tuningCollapseElement;
let initialMouseY = 0;
let previousDeltaY = 0;
let previousOffsets;

const valuePerCent = 4095 / 60 / 100;
const idealTuningTable = [];

for (let i = 0; i < 61; i++) {
	idealTuningTable[i] = valuePerCent * 100 * i;
}

// Uint16 tuning table from rounded ideal values
const idealTuningTableUint16 = Uint16Array.from(idealTuningTable.map(value => Math.round(value)));

watch(() => props.tuningTable, (newValue) => {
  if (newValue) {
	  init();
  }
}, { immediate: true, once: true });

function init() {
	console.log('Initializing tuning table');

	// Set offsets based on tuningTable and valuePerCent. Offsets are in cents (-99 to +99)
	for (let i = 0; i < 61; i++) {
		const diff = props.tuningTable[i] - idealTuningTableUint16[i];
		offsets.value[i] = Math.round(diff / valuePerCent);
	}

	previousOffsets = [...offsets.value];
}

watch(activeKey, (newVal, oldValue) => {
	if (newVal !== null) {
		keyElements[newVal].classList.add('active');
	}
});

function update() {
	const isValid = offsets.value.every(value => {
		const intValue = parseInt(value);
		return !isNaN(intValue);
	});

	const tempOffsets = [...offsets.value];
	// Update tuningTable by adding offsets to idealTuningTable, rounding and clamping to 0-4095
	if (isValid && JSON.stringify(previousOffsets) !== JSON.stringify(tempOffsets)) {
		for (let i = 0; i < 61; i++) {
			let newValue = idealTuningTableUint16[i] + Math.round(offsets.value[i] * valuePerCent);
			newValue = Math.min(Math.max(newValue, 0), 4095); // Clamp to 0-4095
			props.tuningTable[i] = newValue;
		}

		emit('dataUpdated', props.tuningTable);
	}

	previousOffsets = [...offsets.value];
}

onMounted(() => {
	tuningCollapseElement = document.querySelector('.tuning-collapse');
	offsetWrapperElement = document.querySelector('.offsets-wrapper');
	keyElements = document.querySelectorAll('.keyboard path');
	const keyboardElement = document.querySelector('.keyboard');
	const svgElement = document.querySelector('.keyboard svg');
	const svgRect = svgElement.getBoundingClientRect();
	const scale = svgRect.width / 9359;

	keyPositions.value = [];
	keyLabels.value = [];

	let octave = 2;
	keyElements.forEach((path, index) => {
		const bbox = path.getBBox();
		const x = bbox.x * scale;
		const centerX = (bbox.x + (bbox.width / 2)) * scale;
		let y = bbox.height * scale;

		if (index % 12 == 0) {
			keyLabels.value.push({x: x, y: y - 40, width: bbox.width * scale, label: `C${octave}`});
			octave++;
		}

		if (bbox.height < 1000) {
			y = 0; // Adjust for shorter keys
		}

		keyPositions.value.push({x: centerX, y});

		path.addEventListener('pointerdown', (event) => {
			activeKey.value = index;
			initialMouseY = event.screenY;
			document.querySelector('.key-edit-overlay').classList.add('visible');
			document.addEventListener('pointermove', onMouseMove);
		});

		path.addEventListener('mouseover', (event) => {
			if (activeKey.value == null) {
				event.target.classList.add('active');
			}
		});

		path.addEventListener('mouseout', (event) => {
			if (activeKey.value == null) {
				event.target.classList.remove('active');
			}
		});
	});

	document.addEventListener('mouseup', () => {
		activeKey.value = null;
		document.querySelector('.key-edit-overlay').classList.remove('visible');
		document.removeEventListener('pointermove', onMouseMove);
		keyElements.forEach(key => {
			key.classList.remove('active');
		});

		update();
	});

	keyboardElement.scrollTo({
        left: (keyboardElement.scrollWidth - keyboardElement.offsetWidth) / 2
    });

	return keyPositions;
});

function onMouseMove(event) {
	// Get mouse y position relative to initial position
	const deltaY = -Math.round((event.screenY - initialMouseY) * 100 / (screen.height / 3));
	let offsetDelta = deltaY - previousDeltaY;
	previousDeltaY = deltaY;

	if (offsetDelta === 0) {
		return; // No change
	}

	if (offsetDelta > 0) {
		offsetDelta = 1;
	} else {
		offsetDelta = -1;
	}

	if (offsetDelta < 0 && offsets.value[activeKey.value] <= -99) {
		return; // Prevent going below -100
	}

	if (offsetDelta > 0 && offsets.value[activeKey.value] >= 99) {
		return; // Prevent going above 100
	}

	offsets.value[activeKey.value] += offsetDelta;

}

function handleInputKeydown(event) {
	// Allow navigation keys (e.g., arrow keys, backspace, delete, tab)
	if (event.key.length !== 1 || ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
		return;
	}

	// Prevent multiple '-' characters
	if (event.key === '-' && event.target.value.includes('-')) {
		event.preventDefault();
		return;
	}

	// Allow '-' only as the first character
	if (event.key === '-' && event.target.selectionStart !== 0) {
		event.preventDefault();
		return;
	}

	if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-'].includes(event.key)) {
		return;
	}

	event.preventDefault();
}

function handleInputKeyup(event) {
	// Validate on input
	if (isNaN(Number(event.target.value)) || event.target.value === '') {
		event.target.classList.add('invalid');
	} else {
		event.target.classList.remove('invalid');
		update();
	}

}

function handleInputFocus(event) {
	tuningCollapseElement.classList.add('collapse-open');
}

function handleInputBlur(event, index) {
	if (isNaN(Number(event.target.value)) || event.target.value === '') {
		event.target.classList.remove('invalid');
		offsets.value[index] = 0;
		update();
	}
}

function importTuningFile(event) {
	const file = event.target.files[0];

	if (file) {
		const reader = new FileReader();

		reader.onload = (e) => {
			const content = e.target.result;
			const importedOffsets = getOffsetsFromTunFile(content);
			console.log('Imported offsets:', importedOffsets);
			if (importedOffsets && importedOffsets.length === 61) {
				for (let i = 0; i < 61; i++) {
					offsets.value[i] = importedOffsets[i];
				}

				selectedPreset.value = '';

				update();
			} else {
				alert('Invalid .tun file. It must contain exactly 61 offsets.');
			}
		};

		reader.readAsText(file);
	}
}

function loadPreset() {
	if (selectedPreset.value) {
		fetch(selectedPreset.value)
			.then(response => response.text())
			.then(data => {
				const importedOffsets = getOffsetsFromTunFile(data);
				if (importedOffsets && importedOffsets.length === 61) {
					for (let i = 0; i < 61; i++) {
						offsets.value[i] = importedOffsets[i];
					}

					update();
				} else {
					alert('Invalid preset file. It must contain exactly 61 offsets.');
				}
			})
			.catch(error => {
				console.error('Error loading preset:', error);
				alert('Failed to load preset file.');
			});
	}
}

function reset() {
	offsets.value = new Array(61).fill(0);
	update();

	// Reset file input
	document.getElementById('tun-upload').value = '';
	selectedPreset.value = '';
}
</script>

<template>
	<div v-if="tuningTable"
		 :class="{'collapse-open': tuningCollapseOpen}"
		 class="tuning-collapse collapse collapse-arrow bg-base-300 rounded-none">
		<!-- <input type="checkbox" tabindex="-1" /> -->
		<div class="collapse-title label-text text-xl px-12"
			 @click="tuningCollapseOpen = !tuningCollapseOpen">
			<span class="mr-2">Tuning</span>
			<button 
				  ref="tooltipTrigger"
				  class="text-neutral"
				  @mouseenter="showTooltip = true"
				  @mouseleave="showTooltip = false">
				<v-icon name="md-help" scale="1.25" />
			</button>

			<Teleport to="body">
				<div v-if="showTooltip"
					 ref="tooltipContent"
					 class="floating-tooltip grid gap-2"
					 :style="tooltipStyle">
					<p>Adjust the tuning offsets for each key in cents (-99 to +99).</p>
					<p>You can click and drag on a key to adjust its offset, or enter a value directly in the input box.</p>
					<p>Import a .tun file to load a tuning table directly. A .tun file will let you go beyond +-90 cents.</p>
					<p>Upon saving, the tuning table will be stored in the user tuning table slot. This slot can be loaded by holding the first key on the keyboard when powering on the SB01</p>
				</div>
			</Teleport>
		</div>
		<div class="collapse-content visible">
			<header class="flex justify-between w-full py-4">
				<div class="grid grid-cols-2 gap-2">
					<select class="select select-sm w-full max-w-xs mr-4"
						 v-model="selectedPreset"
						 @change="loadPreset">
						<option disabled value="" selected>LOAD PRESET</option>
						<option v-for="preset in tuningPresets"
								:key="preset"
								:value="preset.file">
						{{ preset.name.toUpperCase() }}
						</option>
					</select>
					<div>
						<label for="tun-upload" class="btn btn-sm btn-neutral">
							<v-icon name="md-uploadfile" scale="1" />
								Import .tun
						</label>
						<input id="tun-upload" type="file" accept=".tun" @change="importTuningFile" />
					</div>
				</div>

				<button class="btn btn-sm btn-neutral"
						@click="reset">
					Reset
				</button>
			</header>

			<div class="keyboard block">
				<div class="offsets-wrapper">
					<div class="input-wrapper"
						 v-for="(key, index) in keyPositions"
						 :x="key.x"
						 :y="key.y"
						 :style="{left: key.x + 'px', top: key.y + 'px'}"
						 :class="{'top-align': key.y == 0}">
						<input type="text"
							   required
							   v-model.number="offsets[index]"
							   @focus="handleInputFocus"
							   @blur="handleInputBlur($event, index)"
							   @keydown="handleInputKeydown"
							   @keyup="handleInputKeyup"
							   :key="index"
							   title="Only numbers" />
					</div>

					<div class="key-label"
						 v-for="(label, index) in keyLabels"
						 :x="label.x"
						 :y="label.y"
						 :style="{left: label.x + 'px', top: label.y + 'px', width: label.width + 'px'}"
						 :key="index">
						{{ label.label }}
					</div>
				</div>

				<svg width="100%" height="100%" viewBox="0 0 9359 1429" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;">
					<path d="M18.51,6.7C11.99,6.7 6.7,11.99 6.7,18.51L6.7,1410.45C6.7,1416.97 11.99,1422.25 18.51,1422.25L245.29,1422.25C251.81,1422.25 257.1,1416.97 257.1,1410.45L257.1,929.73C257.1,923.21 251.81,917.92 245.29,917.92L174.41,917.92C164.63,917.92 156.7,909.99 156.7,900.21L156.7,18.51C156.7,11.99 151.42,6.7 144.9,6.7L18.51,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M274.8,908.46C281.32,908.46 286.61,903.18 286.61,896.67L286.61,18.5C286.61,11.98 281.33,6.7 274.81,6.7L177.95,6.7C171.43,6.7 166.14,11.98 166.14,18.5L166.14,896.67C166.15,903.18 171.44,908.46 177.96,908.46L274.8,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M307.88,6.7C301.36,6.7 296.07,11.99 296.07,18.51L296.07,900.21C296.07,909.99 288.14,917.92 278.36,917.92L278.35,917.92C271.83,917.92 266.54,923.21 266.54,929.73L266.54,1410.45C266.54,1416.97 271.83,1422.25 278.35,1422.25L505.13,1422.25C511.65,1422.25 516.93,1416.97 516.93,1410.45L516.93,929.73C516.93,923.21 511.65,917.92 505.13,917.92L505.12,917.92C495.33,917.92 487.41,909.99 487.41,900.21L487.41,18.51C487.41,11.99 482.12,6.7 475.6,6.7L307.88,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M605.51,908.46C612.03,908.46 617.32,903.18 617.33,896.67L617.33,18.5C617.33,11.98 612.05,6.7 605.52,6.7L508.66,6.7C502.14,6.7 496.86,11.98 496.86,18.5L496.86,896.67C496.86,903.18 502.15,908.46 508.67,908.46L605.51,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M638.59,6.7C632.06,6.7 626.78,11.99 626.78,18.51L626.78,900.21C626.78,909.99 618.85,917.92 609.07,917.92L538.19,917.92C531.67,917.92 526.39,923.21 526.39,929.73L526.39,1410.45C526.39,1416.97 531.67,1422.25 538.19,1422.25L764.97,1422.25C771.49,1422.25 776.78,1416.97 776.78,1410.45L776.78,18.51C776.78,11.99 771.49,6.7 764.97,6.7L638.59,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M798.04,6.7C791.52,6.7 786.23,11.99 786.23,18.51L786.23,1410.45C786.23,1416.97 791.52,1422.25 798.04,1422.25L1024.82,1422.25C1031.34,1422.25 1036.63,1416.97 1036.63,1410.45L1036.63,929.73C1036.63,923.21 1031.34,917.92 1024.82,917.92L953.94,917.92C944.16,917.92 936.23,909.99 936.23,900.21L936.23,18.51C936.23,11.99 930.95,6.7 924.43,6.7L798.04,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M1054.33,908.46C1060.85,908.46 1066.14,903.18 1066.15,896.67L1066.15,18.5C1066.15,11.98 1060.87,6.7 1054.35,6.7L957.48,6.7C950.963,6.7 945.679,11.98 945.679,18.5L945.679,896.67C945.688,903.18 950.975,908.46 957.5,908.46L1054.33,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M1087.41,6.7C1080.89,6.7 1075.6,11.99 1075.6,18.51L1075.6,900.21C1075.6,909.99 1067.67,917.92 1057.9,917.92L1057.88,917.92C1051.36,917.92 1046.07,923.21 1046.07,929.73L1046.07,1410.45C1046.07,1416.97 1051.36,1422.25 1057.88,1422.25L1284.66,1422.25C1291.18,1422.25 1296.46,1416.97 1296.46,1410.45L1296.46,929.73C1296.46,923.21 1291.18,917.92 1284.66,917.92L1249.21,917.92C1239.43,917.92 1231.51,909.99 1231.51,900.21L1231.51,18.51C1231.51,11.99 1226.22,6.7 1219.7,6.7L1087.41,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M1349.6,908.46C1356.12,908.46 1361.41,903.18 1361.42,896.67L1361.42,18.5C1361.42,11.98 1356.14,6.7 1349.62,6.7L1252.75,6.7C1246.23,6.7 1240.95,11.98 1240.95,18.5L1240.95,896.67C1240.96,903.18 1246.24,908.46 1252.77,908.46L1349.6,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M1382.68,6.7C1376.16,6.7 1370.88,11.99 1370.88,18.51L1370.88,900.21C1370.88,909.99 1362.95,917.92 1353.17,917.92L1317.72,917.92C1311.2,917.92 1305.92,923.21 1305.92,929.73L1305.92,1410.45C1305.92,1416.97 1311.2,1422.25 1317.72,1422.25L1544.5,1422.25C1551.03,1422.25 1556.31,1416.97 1556.31,1410.45L1556.31,929.73C1556.31,923.21 1551.03,917.92 1544.5,917.92L1544.49,917.92C1534.71,917.92 1526.78,909.99 1526.78,900.21L1526.78,18.51C1526.78,11.99 1521.5,6.7 1514.97,6.7L1382.68,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M1644.88,908.46C1651.41,908.46 1656.69,903.18 1656.7,896.67L1656.7,18.5C1656.7,11.98 1651.42,6.7 1644.9,6.7L1548.03,6.7C1541.51,6.7 1536.23,11.98 1536.23,18.5L1536.23,896.67C1536.24,903.18 1541.53,908.46 1548.05,908.46L1644.88,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M1677.96,6.7C1671.44,6.7 1666.15,11.99 1666.15,18.51L1666.15,900.21C1666.15,909.99 1658.22,917.92 1648.44,917.92L1577.57,917.92C1571.04,917.92 1565.76,923.21 1565.76,929.73L1565.76,1410.45C1565.76,1416.97 1571.04,1422.25 1577.57,1422.25L1804.35,1422.25C1810.87,1422.25 1816.15,1416.97 1816.15,1410.45L1816.15,18.51C1816.15,11.99 1810.87,6.7 1804.35,6.7L1677.96,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M1837.41,6.7C1830.89,6.7 1825.6,11.99 1825.6,18.51L1825.6,1410.45C1825.6,1416.97 1830.89,1422.25 1837.41,1422.25L2064.19,1422.25C2070.71,1422.25 2076,1416.97 2076,1410.45L2076,929.73C2076,923.21 2070.71,917.92 2064.19,917.92L1993.31,917.92C1983.53,917.92 1975.6,909.99 1975.6,900.21L1975.6,18.51C1975.6,11.99 1970.32,6.7 1963.8,6.7L1837.41,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M2093.7,908.46C2100.22,908.46 2105.51,903.18 2105.51,896.67L2105.51,18.5C2105.51,11.98 2100.23,6.7 2093.71,6.7L1996.85,6.7C1990.33,6.7 1985.04,11.98 1985.04,18.5L1985.04,896.67C1985.05,903.18 1990.34,908.46 1996.86,908.46L2093.7,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M2126.78,6.7C2120.26,6.7 2114.97,11.99 2114.97,18.51L2114.97,900.21C2114.97,909.99 2107.04,917.92 2097.26,917.92L2097.25,917.92C2090.73,917.92 2085.44,923.21 2085.44,929.73L2085.44,1410.45C2085.44,1416.97 2090.73,1422.25 2097.25,1422.25L2324.03,1422.25C2330.55,1422.25 2335.83,1416.97 2335.83,1410.45L2335.83,929.73C2335.83,923.21 2330.55,917.92 2324.03,917.92L2324.02,917.92C2314.23,917.92 2306.31,909.99 2306.31,900.21L2306.31,18.51C2306.31,11.99 2301.02,6.7 2294.5,6.7L2126.78,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M2424.41,908.46C2430.93,908.46 2436.22,903.18 2436.23,896.67L2436.23,18.5C2436.23,11.98 2430.95,6.7 2424.42,6.7L2327.56,6.7C2321.04,6.7 2315.76,11.98 2315.76,18.5L2315.76,896.67C2315.76,903.18 2321.05,908.46 2327.57,908.46L2424.41,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M2457.49,6.7C2450.96,6.7 2445.68,11.99 2445.68,18.51L2445.68,900.21C2445.68,909.99 2437.75,917.92 2427.97,917.92L2357.09,917.92C2350.57,917.92 2345.29,923.21 2345.29,929.73L2345.29,1410.45C2345.29,1416.97 2350.57,1422.25 2357.09,1422.25L2583.87,1422.25C2590.39,1422.25 2595.68,1416.97 2595.68,1410.45L2595.68,18.51C2595.68,11.99 2590.39,6.7 2583.87,6.7L2457.49,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M2616.94,6.7C2610.42,6.7 2605.13,11.99 2605.13,18.51L2605.13,1410.45C2605.13,1416.97 2610.42,1422.25 2616.94,1422.25L2843.72,1422.25C2850.24,1422.25 2855.53,1416.97 2855.53,1410.45L2855.53,929.73C2855.53,923.21 2850.24,917.92 2843.72,917.92L2772.84,917.92C2763.06,917.92 2755.13,909.99 2755.13,900.21L2755.13,18.51C2755.13,11.99 2749.85,6.7 2743.33,6.7L2616.94,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M2873.23,908.46C2879.75,908.46 2885.03,903.18 2885.04,896.67L2885.04,18.5C2885.04,11.98 2879.76,6.7 2873.24,6.7L2776.38,6.7C2769.85,6.7 2764.57,11.98 2764.57,18.5L2764.57,896.67C2764.58,903.18 2769.87,908.46 2776.39,908.46L2873.23,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M2906.31,6.7C2899.79,6.7 2894.5,11.99 2894.5,18.51L2894.5,900.21C2894.5,909.99 2886.58,917.92 2876.8,917.92L2876.78,917.92C2870.26,917.92 2864.98,923.21 2864.98,929.73L2864.98,1410.45C2864.98,1416.97 2870.26,1422.25 2876.78,1422.25L3103.56,1422.25C3110.08,1422.25 3115.37,1416.97 3115.37,1410.45L3115.37,929.73C3115.37,923.21 3110.08,917.92 3103.56,917.92L3068.12,917.92C3058.33,917.92 3050.41,909.99 3050.41,900.21L3050.41,18.51C3050.41,11.99 3045.12,6.7 3038.6,6.7L2906.31,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M3168.5,908.46C3175.02,908.46 3180.3,903.18 3180.31,896.67L3180.31,18.5C3180.31,11.98 3175.03,6.7 3168.51,6.7L3071.65,6.7C3065.12,6.7 3059.84,11.98 3059.84,18.5L3059.84,896.67C3059.85,903.18 3065.14,908.46 3071.66,908.46L3168.5,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M3201.58,6.7C3195.06,6.7 3189.77,11.99 3189.77,18.51L3189.77,900.21C3189.77,909.99 3181.85,917.92 3172.07,917.92L3136.62,917.92C3130.1,917.92 3124.82,923.21 3124.82,929.73L3124.82,1410.45C3124.82,1416.97 3130.1,1422.25 3136.62,1422.25L3363.41,1422.25C3369.92,1422.25 3375.21,1416.97 3375.21,1410.45L3375.21,929.73C3375.21,923.21 3369.92,917.92 3363.41,917.92L3363.39,917.92C3353.61,917.92 3345.68,909.99 3345.68,900.21L3345.68,18.51C3345.68,11.99 3340.4,6.7 3333.88,6.7L3201.58,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M3463.78,908.46C3470.3,908.46 3475.58,903.18 3475.59,896.67L3475.59,18.5C3475.59,11.98 3470.31,6.7 3463.79,6.7L3366.93,6.7C3360.41,6.7 3355.12,11.98 3355.12,18.5L3355.12,896.67C3355.13,903.18 3360.42,908.46 3366.94,908.46L3463.78,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M3496.86,6.7C3490.34,6.7 3485.05,11.99 3485.05,18.51L3485.05,900.21C3485.05,909.99 3477.13,917.92 3467.34,917.92L3396.47,917.92C3389.94,917.92 3384.66,923.21 3384.66,929.73L3384.66,1410.45C3384.66,1416.97 3389.94,1422.25 3396.47,1422.25L3623.25,1422.25C3629.77,1422.25 3635.05,1416.97 3635.05,1410.45L3635.05,18.51C3635.05,11.99 3629.77,6.7 3623.25,6.7L3496.86,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M3656.31,6.7C3649.79,6.7 3644.5,11.99 3644.5,18.51L3644.5,1410.45C3644.5,1416.97 3649.79,1422.25 3656.31,1422.25L3883.09,1422.25C3889.61,1422.25 3894.9,1416.97 3894.9,1410.45L3894.9,929.73C3894.9,923.21 3889.61,917.92 3883.09,917.92L3812.21,917.92C3802.43,917.92 3794.5,909.99 3794.5,900.21L3794.5,18.51C3794.5,11.99 3789.22,6.7 3782.7,6.7L3656.31,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M3912.59,908.46C3919.12,908.46 3924.4,903.18 3924.41,896.67L3924.41,18.5C3924.41,11.98 3919.13,6.7 3912.61,6.7L3815.74,6.7C3809.22,6.7 3803.94,11.98 3803.94,18.5L3803.94,896.67C3803.95,903.18 3809.23,908.46 3815.76,908.46L3912.59,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M3945.68,6.7C3939.16,6.7 3933.87,11.99 3933.87,18.51L3933.87,900.21C3933.87,909.99 3925.94,917.92 3916.16,917.92L3916.15,917.92C3909.63,917.92 3904.35,923.21 3904.35,929.73L3904.35,1410.45C3904.35,1416.97 3909.63,1422.25 3916.15,1422.25L4142.93,1422.25C4149.45,1422.25 4154.74,1416.97 4154.74,1410.45L4154.74,929.73C4154.74,923.21 4149.45,917.92 4142.93,917.92L4142.92,917.92C4133.14,917.92 4125.21,909.99 4125.21,900.21L4125.21,18.51C4125.21,11.99 4119.93,6.7 4113.4,6.7L3945.68,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M4243.31,908.46C4249.83,908.46 4255.11,903.18 4255.12,896.67L4255.12,18.5C4255.12,11.98 4249.84,6.7 4243.32,6.7L4146.46,6.7C4139.93,6.7 4134.65,11.98 4134.65,18.5L4134.65,896.67C4134.66,903.18 4139.95,908.46 4146.47,908.46L4243.31,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M4276.39,6.7C4269.87,6.7 4264.58,11.99 4264.58,18.51L4264.58,900.21C4264.58,909.99 4256.65,917.92 4246.87,917.92L4176,917.92C4169.47,917.92 4164.19,923.21 4164.19,929.73L4164.19,1410.45C4164.19,1416.97 4169.47,1422.25 4176,1422.25L4402.77,1422.25C4409.3,1422.25 4414.58,1416.97 4414.58,1410.45L4414.58,18.51C4414.58,11.99 4409.3,6.7 4402.77,6.7L4276.39,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M4435.83,6.7C4429.31,6.7 4424.02,11.99 4424.02,18.51L4424.02,1410.45C4424.02,1416.97 4429.31,1422.25 4435.83,1422.25L4662.61,1422.25C4669.13,1422.25 4674.42,1416.97 4674.42,1410.45L4674.42,929.73C4674.42,923.21 4669.13,917.92 4662.61,917.92L4591.73,917.92C4581.95,917.92 4574.02,909.99 4574.02,900.21L4574.02,18.51C4574.02,11.99 4568.73,6.7 4562.22,6.7L4435.83,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M4692.12,908.46C4698.64,908.46 4703.93,903.18 4703.94,896.67L4703.94,18.5C4703.94,11.98 4698.66,6.7 4692.14,6.7L4595.27,6.7C4588.75,6.7 4583.47,11.98 4583.47,18.5L4583.47,896.67C4583.48,903.18 4588.77,908.46 4595.29,908.46L4692.12,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M4725.2,6.7C4718.68,6.7 4713.39,11.99 4713.39,18.51L4713.39,900.21C4713.39,909.99 4705.46,917.92 4695.69,917.92L4695.67,917.92C4689.15,917.92 4683.86,923.21 4683.86,929.73L4683.86,1410.45C4683.86,1416.97 4689.15,1422.25 4695.67,1422.25L4922.45,1422.25C4928.97,1422.25 4934.25,1416.97 4934.25,1410.45L4934.25,929.73C4934.25,923.21 4928.97,917.92 4922.45,917.92L4887,917.92C4877.22,917.92 4869.3,909.99 4869.3,900.21L4869.3,18.51C4869.3,11.99 4864.01,6.7 4857.49,6.7L4725.2,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M4987.39,908.46C4993.91,908.46 4999.2,903.18 4999.21,896.67L4999.21,18.5C4999.21,11.98 4993.93,6.7 4987.41,6.7L4890.54,6.7C4884.02,6.7 4878.74,11.98 4878.74,18.5L4878.74,896.67C4878.75,903.18 4884.03,908.46 4890.56,908.46L4987.39,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M5020.47,6.7C5013.95,6.7 5008.67,11.99 5008.67,18.51L5008.67,900.21C5008.67,909.99 5000.74,917.92 4990.96,917.92L4955.51,917.92C4948.99,917.92 4943.71,923.21 4943.71,929.73L4943.71,1410.45C4943.71,1416.97 4948.99,1422.25 4955.51,1422.25L5182.29,1422.25C5188.82,1422.25 5194.1,1416.97 5194.1,1410.45L5194.1,929.73C5194.1,923.21 5188.82,917.92 5182.29,917.92L5182.28,917.92C5172.5,917.92 5164.57,909.99 5164.57,900.21L5164.57,18.51C5164.57,11.99 5159.29,6.7 5152.76,6.7L5020.47,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M5282.67,908.46C5289.2,908.46 5294.48,903.18 5294.49,896.67L5294.49,18.5C5294.49,11.98 5289.21,6.7 5282.69,6.7L5185.82,6.7C5179.3,6.7 5174.02,11.98 5174.02,18.5L5174.02,896.67C5174.03,903.18 5179.32,908.46 5185.84,908.46L5282.67,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M5315.75,6.7C5309.23,6.7 5303.94,11.99 5303.94,18.51L5303.94,900.21C5303.94,909.99 5296.01,917.92 5286.23,917.92L5215.36,917.92C5208.83,917.92 5203.55,923.21 5203.55,929.73L5203.55,1410.45C5203.55,1416.97 5208.83,1422.25 5215.36,1422.25L5442.14,1422.25C5448.66,1422.25 5453.94,1416.97 5453.94,1410.45L5453.94,18.51C5453.94,11.99 5448.66,6.7 5442.14,6.7L5315.75,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M5475.2,6.7C5468.68,6.7 5463.39,11.99 5463.39,18.51L5463.39,1410.45C5463.39,1416.97 5468.68,1422.25 5475.2,1422.25L5701.98,1422.25C5708.5,1422.25 5713.79,1416.97 5713.79,1410.45L5713.79,929.73C5713.79,923.21 5708.5,917.92 5701.98,917.92L5631.1,917.92C5621.32,917.92 5613.39,909.99 5613.39,900.21L5613.39,18.51C5613.39,11.99 5608.11,6.7 5601.59,6.7L5475.2,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M5731.49,908.46C5738.01,908.46 5743.3,903.18 5743.3,896.67L5743.3,18.5C5743.3,11.98 5738.02,6.7 5731.5,6.7L5634.64,6.7C5628.12,6.7 5622.83,11.98 5622.83,18.5L5622.83,896.67C5622.84,903.18 5628.13,908.46 5634.65,908.46L5731.49,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M5764.57,6.7C5758.05,6.7 5752.76,11.99 5752.76,18.51L5752.76,900.21C5752.76,909.99 5744.83,917.92 5735.05,917.92L5735.04,917.92C5728.52,917.92 5723.23,923.21 5723.23,929.73L5723.23,1410.45C5723.23,1416.97 5728.52,1422.25 5735.04,1422.25L5961.82,1422.25C5968.34,1422.25 5973.62,1416.97 5973.62,1410.45L5973.62,929.73C5973.62,923.21 5968.34,917.92 5961.82,917.92L5961.81,917.92C5952.02,917.92 5944.1,909.99 5944.1,900.21L5944.1,18.51C5944.1,11.99 5938.81,6.7 5932.29,6.7L5764.57,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M6062.2,908.46C6068.72,908.46 6074.01,903.18 6074.02,896.67L6074.02,18.5C6074.02,11.98 6068.74,6.7 6062.21,6.7L5965.35,6.7C5958.83,6.7 5953.55,11.98 5953.55,18.5L5953.55,896.67C5953.55,903.18 5958.84,908.46 5965.36,908.46L6062.2,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M6095.28,6.7C6088.75,6.7 6083.47,11.99 6083.47,18.51L6083.47,900.21C6083.47,909.99 6075.54,917.92 6065.76,917.92L5994.88,917.92C5988.36,917.92 5983.08,923.21 5983.08,929.73L5983.08,1410.45C5983.08,1416.97 5988.36,1422.25 5994.88,1422.25L6221.66,1422.25C6228.18,1422.25 6233.47,1416.97 6233.47,1410.45L6233.47,18.51C6233.47,11.99 6228.18,6.7 6221.66,6.7L6095.28,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M6254.73,6.7C6248.21,6.7 6242.92,11.99 6242.92,18.51L6242.92,1410.45C6242.92,1416.97 6248.21,1422.25 6254.73,1422.25L6481.51,1422.25C6488.03,1422.25 6493.32,1416.97 6493.32,1410.45L6493.32,929.73C6493.32,923.21 6488.03,917.92 6481.51,917.92L6410.63,917.92C6400.85,917.92 6392.92,909.99 6392.92,900.21L6392.92,18.51C6392.92,11.99 6387.64,6.7 6381.12,6.7L6254.73,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M6511.02,908.46C6517.54,908.46 6522.82,903.18 6522.83,896.67L6522.83,18.5C6522.83,11.98 6517.55,6.7 6511.03,6.7L6414.17,6.7C6407.64,6.7 6402.36,11.98 6402.36,18.5L6402.36,896.67C6402.37,903.18 6407.66,908.46 6414.18,908.46L6511.02,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M6544.1,6.7C6537.58,6.7 6532.29,11.99 6532.29,18.51L6532.29,900.21C6532.29,909.99 6524.37,917.92 6514.59,917.92L6514.57,917.92C6508.05,917.92 6502.77,923.21 6502.77,929.73L6502.77,1410.45C6502.77,1416.97 6508.05,1422.25 6514.57,1422.25L6741.35,1422.25C6747.87,1422.25 6753.16,1416.97 6753.16,1410.45L6753.16,929.73C6753.16,923.21 6747.87,917.92 6741.35,917.92L6705.91,917.92C6696.12,917.92 6688.2,909.99 6688.2,900.21L6688.2,18.51C6688.2,11.99 6682.91,6.7 6676.39,6.7L6544.1,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M6806.29,908.46C6812.81,908.46 6818.09,903.18 6818.1,896.67L6818.1,18.5C6818.1,11.98 6812.82,6.7 6806.3,6.7L6709.44,6.7C6702.91,6.7 6697.63,11.98 6697.63,18.5L6697.63,896.67C6697.64,903.18 6702.93,908.46 6709.45,908.46L6806.29,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M6839.37,6.7C6832.85,6.7 6827.56,11.99 6827.56,18.51L6827.56,900.21C6827.56,909.99 6819.64,917.92 6809.86,917.92L6774.41,917.92C6767.89,917.92 6762.61,923.21 6762.61,929.73L6762.61,1410.45C6762.61,1416.97 6767.89,1422.25 6774.41,1422.25L7001.2,1422.25C7007.71,1422.25 7013,1416.97 7013,1410.45L7013,929.73C7013,923.21 7007.71,917.92 7001.2,917.92L7001.18,917.92C6991.4,917.92 6983.47,909.99 6983.47,900.21L6983.47,18.51C6983.47,11.99 6978.19,6.7 6971.67,6.7L6839.37,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M7101.57,908.46C7108.09,908.46 7113.37,903.18 7113.38,896.67L7113.38,18.5C7113.38,11.98 7108.1,6.7 7101.58,6.7L7004.72,6.7C6998.2,6.7 6992.91,11.98 6992.91,18.5L6992.91,896.67C6992.92,903.18 6998.21,908.46 7004.73,908.46L7101.57,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M7134.65,6.7C7128.13,6.7 7122.84,11.99 7122.84,18.51L7122.84,900.21C7122.84,909.99 7114.92,917.92 7105.13,917.92L7034.26,917.92C7027.73,917.92 7022.45,923.21 7022.45,929.73L7022.45,1410.45C7022.45,1416.97 7027.73,1422.25 7034.26,1422.25L7261.04,1422.25C7267.56,1422.25 7272.84,1416.97 7272.84,1410.45L7272.84,18.51C7272.84,11.99 7267.56,6.7 7261.04,6.7L7134.65,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M7294.1,6.7C7287.58,6.7 7282.29,11.99 7282.29,18.51L7282.29,1410.45C7282.29,1416.97 7287.58,1422.25 7294.1,1422.25L7520.88,1422.25C7527.4,1422.25 7532.69,1416.97 7532.69,1410.45L7532.69,929.73C7532.69,923.21 7527.4,917.92 7520.88,917.92L7450,917.92C7440.22,917.92 7432.29,909.99 7432.29,900.21L7432.29,18.51C7432.29,11.99 7427.01,6.7 7420.49,6.7L7294.1,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M7550.38,908.46C7556.91,908.46 7562.19,903.18 7562.2,896.67L7562.2,18.5C7562.2,11.98 7556.92,6.7 7550.4,6.7L7453.53,6.7C7447.01,6.7 7441.73,11.98 7441.73,18.5L7441.73,896.67C7441.74,903.18 7447.02,908.46 7453.55,908.46L7550.38,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M7583.47,6.7C7576.95,6.7 7571.66,11.99 7571.66,18.51L7571.66,900.21C7571.66,909.99 7563.73,917.92 7553.95,917.92L7553.94,917.92C7547.42,917.92 7542.14,923.21 7542.14,929.73L7542.14,1410.45C7542.14,1416.97 7547.42,1422.25 7553.94,1422.25L7780.72,1422.25C7787.24,1422.25 7792.53,1416.97 7792.53,1410.45L7792.53,929.73C7792.53,923.21 7787.24,917.92 7780.72,917.92L7780.71,917.92C7770.93,917.92 7763,909.99 7763,900.21L7763,18.51C7763,11.99 7757.72,6.7 7751.19,6.7L7583.47,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M7881.1,908.46C7887.62,908.46 7892.9,903.18 7892.91,896.67L7892.91,18.5C7892.91,11.98 7887.63,6.7 7881.11,6.7L7784.25,6.7C7777.72,6.7 7772.44,11.98 7772.44,18.5L7772.44,896.67C7772.45,903.18 7777.74,908.46 7784.26,908.46L7881.1,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M7914.18,6.7C7907.66,6.7 7902.37,11.99 7902.37,18.51L7902.37,900.21C7902.37,909.99 7894.44,917.92 7884.66,917.92L7813.79,917.92C7807.26,917.92 7801.98,923.21 7801.98,929.73L7801.98,1410.45C7801.98,1416.97 7807.26,1422.25 7813.79,1422.25L8040.56,1422.25C8047.09,1422.25 8052.37,1416.97 8052.37,1410.45L8052.37,18.51C8052.37,11.99 8047.09,6.7 8040.56,6.7L7914.18,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M8073.62,6.7C8067.1,6.7 8061.81,11.99 8061.81,18.51L8061.81,1410.45C8061.81,1416.97 8067.1,1422.25 8073.62,1422.25L8300.4,1422.25C8306.92,1422.25 8312.21,1416.97 8312.21,1410.45L8312.21,929.73C8312.21,923.21 8306.92,917.92 8300.4,917.92L8229.52,917.92C8219.74,917.92 8211.81,909.99 8211.81,900.21L8211.81,18.51C8211.81,11.99 8206.52,6.7 8200.01,6.7L8073.62,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M8329.91,908.46C8336.43,908.46 8341.72,903.18 8341.73,896.67L8341.73,18.5C8341.73,11.98 8336.45,6.7 8329.92,6.7L8233.06,6.7C8226.54,6.7 8221.26,11.98 8221.26,18.5L8221.26,896.67C8221.26,903.18 8226.55,908.46 8233.07,908.46L8329.91,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M8362.99,6.7C8356.47,6.7 8351.18,11.99 8351.18,18.51L8351.18,900.21C8351.18,909.99 8343.25,917.92 8333.47,917.92L8333.46,917.92C8326.94,917.92 8321.65,923.21 8321.65,929.73L8321.65,1410.45C8321.65,1416.97 8326.94,1422.25 8333.46,1422.25L8560.24,1422.25C8566.76,1422.25 8572.05,1416.97 8572.05,1410.45L8572.05,929.73C8572.05,923.21 8566.76,917.92 8560.24,917.92L8524.8,917.92C8515.01,917.92 8507.09,909.99 8507.09,900.21L8507.09,18.51C8507.09,11.99 8501.8,6.7 8495.28,6.7L8362.99,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M8625.18,908.46C8631.7,908.46 8636.99,903.18 8637,896.67L8637,18.5C8637,11.98 8631.72,6.7 8625.19,6.7L8528.33,6.7C8521.81,6.7 8516.53,11.98 8516.53,18.5L8516.53,896.67C8516.54,903.18 8521.82,908.46 8528.34,908.46L8625.18,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M8658.26,6.7C8651.74,6.7 8646.46,11.99 8646.46,18.51L8646.46,900.21C8646.46,909.99 8638.53,917.92 8628.75,917.92L8593.3,917.92C8586.78,917.92 8581.5,923.21 8581.5,929.73L8581.5,1410.45C8581.5,1416.97 8586.78,1422.25 8593.3,1422.25L8820.08,1422.25C8826.6,1422.25 8831.89,1416.97 8831.89,1410.45L8831.89,929.73C8831.89,923.21 8826.6,917.92 8820.08,917.92L8820.07,917.92C8810.29,917.92 8802.36,909.99 8802.36,900.21L8802.36,18.51C8802.36,11.99 8797.08,6.7 8790.55,6.7L8658.26,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M8920.46,908.46C8926.98,908.46 8932.27,903.18 8932.28,896.67L8932.28,18.5C8932.28,11.98 8927,6.7 8920.47,6.7L8823.61,6.7C8817.09,6.7 8811.81,11.98 8811.81,18.5L8811.81,896.67C8811.82,903.18 8817.1,908.46 8823.62,908.46L8920.46,908.46Z" style="fill-rule:nonzero;"/>
					<path d="M8953.54,6.7C8947.02,6.7 8941.73,11.99 8941.73,18.51L8941.73,900.21C8941.73,909.99 8933.8,917.92 8924.02,917.92L8853.15,917.92C8846.62,917.92 8841.34,923.21 8841.34,929.73L8841.34,1410.45C8841.34,1416.97 8846.62,1422.25 8853.15,1422.25L9079.93,1422.25C9086.45,1422.25 9091.73,1416.97 9091.73,1410.45L9091.73,18.51C9091.73,11.99 9086.45,6.7 9079.93,6.7L8953.54,6.7Z" style="fill-rule:nonzero;"/>
					<path d="M9351.58,18.51C9351.58,11.99 9346.3,6.7 9339.77,6.7L9112.99,6.7C9106.47,6.7 9101.19,11.99 9101.19,18.51L9101.19,1410.45C9101.19,1416.97 9106.47,1422.25 9112.99,1422.25L9339.77,1422.25C9346.3,1422.25 9351.58,1416.97 9351.58,1410.45L9351.58,18.51Z" style="fill-rule:nonzero;"/>
				</svg>
			</div>
		</div>
	</div>

	<div v-else>
		Loading keyboard...
	</div>

	<div class="key-edit-overlay"></div>
</template>

<style scoped lang="postcss">
.collapse-title {
	cursor: pointer;
	transition: padding 0.3s ease;

	&:after {
		@apply right-12 -translate-y-1/2 -translate-x-1/2;
		transition: right 0.3s ease;
	}
}

.collapse-open {
	@apply bg-black/10;

	.collapse-title {
		@apply px-4;

		&:after {
			@apply right-4;
		}
	}
}

.keyboard {
	position: relative;
	overflow-x: scroll;
	padding-top: 4rem;
	padding-bottom: 4rem;
	scrollbar-color: theme('colors.neutral') theme('colors.base-300');

	svg {
		position: relative;
		width: 300%;
		height: auto;
		@apply pb-6;

		path {
			@apply fill-base-100;

			&.active {
				@apply stroke-accent;
				stroke-width: 4;
			}
		}
	}

	.input-wrapper {
		position: absolute;
		margin-top: 1rem;
		transform: translateX(-50%);

		&:after {
			content: '';
			position: absolute;
			top: 4px;
			left: 50%;
			width: 2px;
			height: calc(2rem - 4px);
			@apply bg-base-100;
			transform: translate(-50%, -50%);
			opacity: 0.5;
			pointer-events: none;
			z-index: -1;
		}

		&.top-align {
			margin-top: -1rem;
			transform: translate(-50%, -100%);

			&:after {
				top: 100%;
			}
		}
	}

	input {
		position: relative;
		@apply input input-xs;
		width: 5ch;
		padding: 0.2rem;
		text-align: center;
		z-index: 1;

		&.invalid {
			@apply input-error;
		}
	}
}

[data-theme="dark"] .keyboard {
	svg path {
		@apply fill-neutral/50;
	}
}

.offsets-wrapper {
	position: absolute;
	top: 4rem;
	left: 0;
	width: 300%;
	height: calc(100% - 8rem);
}

.key-edit-overlay {
	display: none;
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 1000;

	&.visible {
		display: block;
	}
}

.key-label {
	display: block;
	position: absolute;
	z-index: 1;
	text-align: center;
	pointer-events: none;
	@apply text-base-300;
}

input[type="file"] {
	display: none;
}

.floating-tooltip {
	position: fixed;
	width: max-content;
	max-width: 20rem;
	padding: 0.25rem 0.5rem;
	font-size: 0.875rem;
	line-height: 1.25rem;
	text-align: center;
	white-space: normal;
	@apply bg-neutral text-neutral-content rounded shadow-lg z-50;
}

/* Optional: Add arrow pointing down (when tooltip is on top) */
.floating-tooltip::after {
	content: '';
	position: absolute;
	bottom: -3px;
	left: 50%;
	transform: translateX(-50%);
	width: 0;
	height: 0;
	border-left: 3px solid transparent;
	border-right: 3px solid transparent;
	border-top: 3px solid;
	@apply border-t-neutral;
}
</style>
