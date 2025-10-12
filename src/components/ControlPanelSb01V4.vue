<script>
import { ref, reactive, watch } from 'vue';
import ConfigPort from '../services/ConfigPort'
import { getLatestRelease } from "../services/GitHub";
import TuningTableEditor from './TuningTableEditor.vue';

let configPort;
let device;
let deviceName = ref('');
let loading = ref(true);
let saving = ref(false);
let settings = ref({
	intMidiChannelIn: 0,
	intMidiChannelOut: 0,
	extMidiChannelIn: 0,
	extMidiChannelOut: 0,

	midiSyncTrsIn: false,
	midiSyncUsbIn: false,

	clockSubdivision: 3,

	tuningTable: null
});

let clockSubdivisionMap = [
	48,
	24,
	16,
	12,
	8,
	6,
	4
];

const configAddresses = {
	MIDI_SYNC_TRS_IN: 0x00,
	MIDI_SYNC_USB_IN: 0x01,
	CLOCK_DIVISION: 0x02,
	INT_MIDI_CHAN_IN: 0x03,
	INT_MIDI_CHAN_OUT: 0x04,
	EXT_MIDI_CHAN_IN: 0x05,
	EXT_MIDI_CHAN_OUT: 0x06,
	
	TUNING_TABLE_START: 0x3B,
	TUNING_TABLE_END: 0x78,

	VERSION_YEAR: 0x79,
	VERSION_MONTH: 0x7A,
	VERSION_DAY: 0x7B,
	VERSION_HOUR: 0x7C,
	VERSION_MINUTE: 0x7D,
	VERSION_SECOND: 0x7E,
	SAVE: 0x7F
};

const buildTime = ref(null);
buildTime.value = new Date(0);

const newReleaseAvailable = ref(null);
const newBetaAvailable = ref(null);

let oldTuningTable = new Array(61).fill(0);
async function handleTuningTableUpdate(newTable) {
	// Find first difference
	for (let i = 0; i < newTable.length; i++) {
		if (newTable[i] !== oldTuningTable[i]) {
			await configPort.write(configAddresses.TUNING_TABLE_START + i, newTable[i]);
			oldTuningTable[i] = newTable[i];
		}
	}
}

async function onSettingChange(key, newSetting, oldSetting) {
	console.log('Setting changed', key, newSetting, oldSetting);

	if (key === 'midiSyncTrsIn') {
		await configPort.write(configAddresses.MIDI_SYNC_TRS_IN, newSetting ? 0x01 : 0x00);
	}

	if (key === 'midiSyncUsbIn') {
		await configPort.write(configAddresses.MIDI_SYNC_USB_IN, newSetting ? 0x01 : 0x00);
	}

	if (key === 'clockSubdivision') {
		await configPort.write(configAddresses.CLOCK_DIVISION, clockSubdivisionMap[newSetting]);
	}

	if (key === 'intMidiChannelIn') {
		await configPort.write(configAddresses.INT_MIDI_CHAN_IN, newSetting);
	}

	if (key === 'intMidiChannelOut') {
		console.log('Writing intMidiChannelOut', newSetting);
		await configPort.write(configAddresses.INT_MIDI_CHAN_OUT, newSetting);
	}

	if (key === 'extMidiChannelIn') {
		await configPort.write(configAddresses.EXT_MIDI_CHAN_IN, newSetting);
	}

	if (key === 'extMidiChannelOut') {
		await configPort.write(configAddresses.EXT_MIDI_CHAN_OUT, newSetting);
	}
}

/**
 * Concatenate two typed arrays of same type.
 *
 * @param {TypedArray} a
 * @param {TypedArray} b
 * @returns {TypedArray}
 */
function concatTypedArrays(a, b) {
	var c = new (a.constructor)(a.length + b.length);
	c.set(a, 0);
	c.set(b, a.length);

	return c;
}

/**
 * Wait for a given amount of time.
 *
 * @param {number} ms
 * @returns {Promise}
 */
async function timeout(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function onConfigConnect() {
	console.log('Config port connected');

	const {
		prereleaseChangelog,
		prereleaseDateTime,
		releaseChangelog,
		releaseDateTime
	} = await getLatestRelease();

	let result;

	result = await configPort.read(configAddresses.MIDI_SYNC_TRS_IN);
	settings.value.midiSyncTrsIn = !!result;

	result = await configPort.read(configAddresses.MIDI_SYNC_USB_IN);
	settings.value.midiSyncUsbIn = !!result;

	result = await configPort.read(configAddresses.CLOCK_DIVISION);
	settings.value.clockSubdivision = clockSubdivisionMap.indexOf(result);

	result = await configPort.read(configAddresses.INT_MIDI_CHAN_IN);
	settings.value.intMidiChannelIn = result;

	result = await configPort.read(configAddresses.INT_MIDI_CHAN_OUT);
	settings.value.intMidiChannelOut = result;

	result = await configPort.read(configAddresses.EXT_MIDI_CHAN_IN);
	settings.value.extMidiChannelIn = result;

	result = await configPort.read(configAddresses.EXT_MIDI_CHAN_OUT);
	settings.value.extMidiChannelOut = result;

	const tempTuningTable = [];
	for (let address = configAddresses.TUNING_TABLE_START; address <= configAddresses.TUNING_TABLE_END; address++) {
		result = await configPort.read(address);
		tempTuningTable[address - configAddresses.TUNING_TABLE_START] = result;
	}

	settings.value.tuningTable = [...tempTuningTable];
	oldTuningTable = [...tempTuningTable];

	result = await configPort.read(configAddresses.VERSION_YEAR);
	buildTime.value.setUTCFullYear(result);

	result = await configPort.read(configAddresses.VERSION_MONTH);
	buildTime.value.setUTCMonth(result - 1);

	result = await configPort.read(configAddresses.VERSION_DAY);
	buildTime.value.setUTCDate(result);

	result = await configPort.read(configAddresses.VERSION_HOUR);
	buildTime.value.setUTCHours(result);

	result = await configPort.read(configAddresses.VERSION_MINUTE);
	buildTime.value.setUTCMinutes(result);

	result = await configPort.read(configAddresses.VERSION_SECOND);
	buildTime.value.setUTCSeconds(result);

	if (buildTime.value < prereleaseDateTime) {
		newBetaAvailable.value = prereleaseDateTime;
	}

	if (buildTime.value < releaseDateTime) {
		newReleaseAvailable.value = releaseDateTime;
	}

	Object.keys(settings.value).forEach(key => {
		watch(
			() => settings.value[key],
			(newSetting, oldSetting) => {
				console.log(`${key} changed:`, oldSetting, "→", newSetting)
				onSettingChange(key, newSetting, oldSetting)
			}
		);
	});

	await timeout(500);
	loading.value = false;
}

function onConfigReadError() {
	console.log('Config port read error');
}

async function configPortConnect() {
	console.log('Connecting to config port');
	configPort.addEventListener('connect', onConfigConnect);

	configPort.connect();
}

async function save() {
	saving.value = true;

	// Send save command
	await configPort.write(configAddresses.SAVE, 0x00);

	saving.value = false;
}
</script>

<script setup>
const props = defineProps({
	device: {
		type: Object,
		required: true
	},
	deviceName: {
		type: String,
		default: ''
	}
});

device = props.device;
deviceName.value = props.deviceName;
configPort = new ConfigPort(device);

await configPortConnect();
</script>

<template>
<div class="hero bg-base-300 w-full max-w-xl rounded-xl">
	<div>
		<header class="w-full bg-black/15 rounded-t-xl mb-8 p-2 px-4 grid grid-cols-2">
			<h1 class="text-neutral self-center">SB01 / CONTROLS</h1>
			<div class="dropdown dropdown-hover dropdown-left justify-self-end self-center">
				<v-icon role="button" name="md-info" scale="1" class="text-neutral" :class="{blink: newReleaseAvailable || newBetaAvailable}" />
				<div tabindex="0" class="dropdown-content card">
					<div class="card bg-base-100 w-96 shadow-sm p-2 px-4">
							<p class="text-sm">FIRMWARE BUILD DATE</p>
							<p class="text-sm">{{ buildTime ? buildTime.toUTCString() : 'n/a' }}</p>

							<div v-if="newBetaAvailable" class="mt-4">
								<p class="text-sm">
								<v-icon name="md-notifications" scale="0.8" class="text-accent" />
								NEW BETA AVAILABLE:
								</p>
								<p class="text-sm">{{ newBetaAvailable.toUTCString() }}</p>
							</div>
							<div v-if="newReleaseAvailable" class="mt-4">
								<p class="text-sm">
								<v-icon name="md-notificationimportant" scale="0.8" class="text-neutral" />
								NEW RELEASE AVAILABLE:
								</p>
								<p class="text-sm">{{ newReleaseAvailable.toUTCString() }}</p>
							</div>
					</div>
				</div>
			</div>
		</header>

		<div class="grid gap-12">
			<div class="grid gap-6 w-screen max-w-xl px-12">
				<div>
					<h4 class="text-neutral">Internal channel</h4>
					<hr class="border-neutral/15">
				</div>
				<div class="grid auto-rows-fr gap-4">
					<div class="form-control w-full">
						<label class="cursor-pointer label">
							<span class="label-text text-xl">MIDI channel in</span>
							<select class="select select-neutral"
									v-model="settings.intMidiChannelIn">
								<option v-for="(n, index) in 16" :value="index">{{ n }}</option>
							</select>
						</label>
					</div>
					<div class="form-control w-full">
						<label class="cursor-pointer label">
							<span class="label-text text-xl">MIDI channel out</span>
							<select class="select select-neutral"
									v-model="settings.intMidiChannelOut">
								<option v-for="(n, index) in 16" :value="index">{{ n }}</option>
							</select>
						</label>
					</div>
				</div>

				<div>
					<h4 class="text-neutral">External channel</h4>
					<hr class="border-neutral/15">
				</div>
				<div class="grid auto-rows-fr gap-4">
					<div class="form-control w-full">
						<label class="cursor-pointer label">
							<span class="label-text text-xl">MIDI channel in</span>
							<select class="select select-neutral"
									v-model="settings.extMidiChannelIn">
								<option v-for="(n, index) in 16" :value="index">{{ n }}</option>
							</select>
						</label>
					</div>
					<div class="form-control w-full">
						<label class="cursor-pointer label">
							<span class="label-text text-xl">MIDI channel out</span>
							<select class="select select-neutral"
									v-model="settings.extMidiChannelOut">
								<option v-for="(n, index) in 16" :value="index">{{ n }}</option>
							</select>
						</label>
					</div>
				</div>

				<div>
					<h4 class="text-neutral">Clock</h4>
					<hr class="border-neutral/15">
				</div>
				<div class="grid auto-rows-fr gap-4">
					<div class="form-control w-full">
						<label class="cursor-pointer label">
							<span class="label-text text-xl">MIDI clock TRS in</span>
							<input type="checkbox"
								   class="toggle toggle-lg toggle-accent"
								   v-model="settings.midiSyncTrsIn"
								   @change="settings.midiSyncTrsIn ? settings.midiSyncUsbIn = false : ''" />
						</label>
					</div>
					<div class="form-control w-full">
						<label class="cursor-pointer label">
							<span class="label-text text-xl">MIDI clock USB in</span>
							<input type="checkbox"
								   class="toggle toggle-lg toggle-accent"
								   v-model="settings.midiSyncUsbIn"
								   @change="settings.midiSyncUsbIn ? settings.midiSyncTrsIn = false : ''" />
						</label>
					</div>
				</div>

				<div class="grid gap-4 form-control w-full">
					<label class="label justify-start gap-2">
						<span class="label-text text-xl"
							  :disabled="!settings.midiSyncTrsIn && !settings.midiSyncUsbIn">Clock subdivision</span>
						<div class="tooltip" data-tip="MIDI clock is 24ppm. This means that 24 clock ticks represent a single quarter note. You can divide this with the slider below so that the SB01 LFO is triggered faster or slower than the standard quarter note">
							<button class="text-neutral"><v-icon name="md-help" scale="1.25" /></button>
						</div>
					</label>
					<input type="range"
						   min="0"
						   max="6"
						   class="range range-neutral"
						   step="1"
						   :disabled="!settings.midiSyncTrsIn && !settings.midiSyncUsbIn"
						   v-model="settings.clockSubdivision" />
					<div class="w-full flex justify-between text-xs px-2">
						<span class="relative font-music text-3xl"
							  :class="{'active': settings.clockSubdivision == 0}"
							  :disabled="!settings.midiSyncTrsIn && !settings.midiSyncUsbIn">
							𝅗𝅥
						</span> <!-- 48 -->
						<span class="relative font-music text-3xl"
							  :class="{'active': settings.clockSubdivision == 1}"
							  :disabled="!settings.midiSyncTrsIn && !settings.midiSyncUsbIn">
							𝅘𝅥
						</span> <!-- 24 -->
						<span class="relative font-music text-3xl"
							  :class="{'active': settings.clockSubdivision == 2}"
							  :disabled="!settings.midiSyncTrsIn && !settings.midiSyncUsbIn">
							𝅘𝅥<span class="font-sans absolute -top-3">³</span>
						</span> <!-- 16 -->
						<span class="relative font-music text-3xl"
							  :class="{'active': settings.clockSubdivision == 3}"
							  :disabled="!settings.midiSyncTrsIn && !settings.midiSyncUsbIn">
							𝅘𝅥𝅯
						</span> <!-- 12 -->
						<span class="relative font-music text-3xl"
							  :class="{'active': settings.clockSubdivision == 4}"
							  :disabled="!settings.midiSyncTrsIn && !settings.midiSyncUsbIn">
							𝅘𝅥𝅯<span class="font-sans absolute -top-3">³</span>
						</span> <!-- 8 -->
						<span class="relative font-music text-3xl"
							  :class="{'active': settings.clockSubdivision == 5}"
							  :disabled="!settings.midiSyncTrsIn && !settings.midiSyncUsbIn">
							𝅘𝅥𝅰
						</span> <!-- 6 -->
						<span class="relative font-music text-3xl"
							  :class="{'active': settings.clockSubdivision == 6}"
							  :disabled="!settings.midiSyncTrsIn && !settings.midiSyncUsbIn">
							𝅘𝅥𝅰<span class="font-sans absolute -top-3">³</span>
						</span> <!-- 4 -->
					</div>
				</div>
			</div>

			<div class="grid gap-6 w-screen max-w-xl">
				<TuningTableEditor @data-updated="handleTuningTableUpdate" :tuning-table="settings.tuningTable" v-if="settings.tuningTable" />
			</div>

			<div class="grid gap-6 w-screen max-w-xl bg-base-300 rounded-b-xl">
				<div class="p-12">
					<button type="button" @click="save" class="btn btn-lg btn-outline w-full">Save
						<span v-if="saving" class="loading loading-spinner loading-sm"></span>
					</button>
				</div>
			</div>
		</div>
	</div>

	<div v-if="saving" class="relative grid items-center justify-center w-full h-full rounded-xl bg-base-300 bg-opacity-50"></div>
	<div v-if="loading" class="relative grid items-center justify-center w-full h-full rounded-xl bg-base-300">
		<div class="grid justify-center items-center gap-4">
			<div class="loading loading-spinner loading-lg mx-auto"></div>
			<p class="text-lg text-neutral">Retrieving data from device</p>
		</div>
	</div>

</div>
</template>

<style scoped lang="postcss">
hr {
	margin: 0;
	padding: 0;
	align-self: center;
}

.blink {
	animation: blinker 1.5s linear infinite;
}

@keyframes blinker {
	50% {
		opacity: 0.5;
	}
}
</style>
