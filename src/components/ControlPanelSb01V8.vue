<script>
import { ref, reactive, watch } from 'vue';
import ConfigPort from '../services/ConfigPort'
import { getLatestRelease } from "../services/GitHub";
import TuningTableEditor from './TuningTableEditor.vue';

const INT8_MIN = -128;
const INT8_MAX = 127;

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

    midiTrsTrsSoftThru: false,
    midiUsbTrsSoftThru: false,

	dubwooferMode: false,

    intMidiOutOffset: 0,
    extMidiOutOffset: 0,

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
	DUBWOOFER_MODE: 0x07,

	SEQUENCER_SET_ACTIVE_SLOT: 0x08,
	SEQUENCER_READ_STEP: 0x09,
	SEQUENCER_SET_STEP: 0x0A,
	SEQUENCER_WRITE_SLOT: 0x0B,
	SEQUENCER_PLAY_EVENT: 0x0C,

    INT_MIDI_OUT_OFFSET: 0x0D,
    EXT_MIDI_OUT_OFFSET: 0x0E,

    MIDI_TRS_TRS_SOFT_THRU: 0x0F,
    MIDI_USB_TRS_SOFT_THRU: 0x10,
	
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

	if (key === 'dubwooferMode') {
		await configPort.write(configAddresses.DUBWOOFER_MODE, newSetting ? 0x01 : 0x00);
	}

	if (key === 'intMidiOutOffset') {
		await configPort.write(configAddresses.INT_MIDI_OUT_OFFSET, Number(newSetting) + (INT8_MIN * -1));
	}

	if (key === 'extMidiOutOffset') {
		await configPort.write(configAddresses.EXT_MIDI_OUT_OFFSET, Number(newSetting) + (INT8_MIN * -1));
	}

	if (key === 'midiTrsTrsSoftThru') {
		await configPort.write(configAddresses.MIDI_TRS_TRS_SOFT_THRU, newSetting ? 0x01 : 0x00);
	}

	if (key === 'midiUsbTrsSoftThru') {
		await configPort.write(configAddresses.MIDI_USB_TRS_SOFT_THRU, newSetting ? 0x01 : 0x00);
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

async function loadSequence(slot) {
	let index = 0;
	await configPort.write(configAddresses.SEQUENCER_SET_ACTIVE_SLOT, slot);

	let sequenceData = new Uint8Array(128).fill(0xFF);

	while (true) {
		const stepData = await configPort.read(configAddresses.SEQUENCER_READ_STEP);
		sequenceData[index] = stepData;
		index++;

		if (stepData === 0xFF || index > 127) {
			break;
		}
	}

	return sequenceData;
}

async function playSequencerEvent(event) {
	await configPort.write(configAddresses.SEQUENCER_PLAY_EVENT, event);
}

async function onConfigConnect() {
	console.log('Config port connected');

    let prereleaseChangelog;
    let prereleaseDateTime;
    let releaseChangelog;
    let releaseDateTime;

    try {
        ({
            prereleaseChangelog,
            prereleaseDateTime,
            releaseChangelog,
            releaseDateTime
        } = await getLatestRelease());
    } catch (error) {
        console.error("GitHub cache error", error);
    }

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

	result = await configPort.read(configAddresses.DUBWOOFER_MODE);
	settings.value.dubwooferMode = !!result;

	result = await configPort.read(configAddresses.MIDI_TRS_TRS_SOFT_THRU);
	settings.value.midiTrsTrsSoftThru = !!result;

	result = await configPort.read(configAddresses.MIDI_USB_TRS_SOFT_THRU);
	settings.value.midiUsbTrsSoftThru = !!result;

	result = await configPort.read(configAddresses.INT_MIDI_OUT_OFFSET);
	settings.value.intMidiOutOffset = result + INT8_MIN;

	result = await configPort.read(configAddresses.EXT_MIDI_OUT_OFFSET);
	settings.value.extMidiOutOffset = result + INT8_MIN;

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

	if (prereleaseDateTime && buildTime.value < prereleaseDateTime) {
		newBetaAvailable.value = prereleaseDateTime;
	}

	if (releaseDateTime && buildTime.value < releaseDateTime) {
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

	// await loadSequence(0); // Preload sequence 0

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
					<div class="card bg-base-100 w-96 shadow-sm p-2 px-4 rounded-md">
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
					<h4 class="text-neutral">SOFT-THRU</h4>
					<hr class="border-neutral/15">
				</div>
				<div class="grid auto-rows-fr gap-4">
					<div class="form-control w-full">
						<label class="cursor-pointer label">
                            <span>
                                <span class="label-text text-xl">MIDI TRS → TRS soft-thru</span>
								<div class="tooltip ml-2" data-tip="Sends all data coming in on the TRS MIDI input to the TRS MIDI output. Useful when daisy-chaining MIDI devices">
									<button class="text-neutral"><v-icon name="md-help" scale="1.25" /></button>
								</div>
                            </span>
                            <input type="checkbox"
                                   class="toggle toggle-lg toggle-accent"
                                   v-model="settings.midiTrsTrsSoftThru" />
						</label>
					</div>
					<div class="form-control w-full">
						<label class="cursor-pointer label">
                            <span>
                                <span class="label-text text-xl">MIDI USB → TRS soft-thru</span>
								<div class="tooltip ml-2" data-tip="Sends all data coming in via USB MIDI to the TRS MIDI output. Useful if you need the SB01 to work as a USB MIDI interface">
									<button class="text-neutral"><v-icon name="md-help" scale="1.25" /></button>
								</div>
                            </span>
							<input type="checkbox"
								   class="toggle toggle-lg toggle-accent"
                                   v-model="settings.midiUsbTrsSoftThru" />
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

				<div class="grid gap-4 form-control w-full pb-12">
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

				<div>
					<h4 class="text-neutral">Experimental</h4>
					<hr class="border-neutral/15">
				</div>
				<div class="grid gap-4">
					<div class="form-control w-full">
						<label class="cursor-pointer label">
							<span>
								<span class="label-text text-xl">32' Range</span>
								<div class="tooltip ml-2" data-tip="When enabled it sets the RANGE knob to span 32' - 4' instead of the normal 16' - 2', letting you go way deep">
									<button class="text-neutral"><v-icon name="md-help" scale="1.25" /></button>
								</div>
							</span>
							<input type="checkbox"
								   class="toggle toggle-lg toggle-accent"
								   v-model="settings.dubwooferMode" />
						</label>
					</div>

                    <div class="grid gap-4 form-control w-full mt-3">
                        <label class="label justify-start gap-2">
                            <span class="label-text text-xl">INTERNAL MIDI NOTE OFFSET</span>
                            <div class="tooltip" data-tip="This is an offset, in octaves, applied to the MIDI note output on the internal channel. Useful when connected to gear that does not follow the A4 = 440 Hz MIDI norm">
                                <button class="text-neutral"><v-icon name="md-help" scale="1.25" /></button>
                            </div>
                        </label>
                        <input type="range"
                               min="-36"
                               max="36"
                               class="range range-neutral"
                               step="12"
                               v-model="settings.intMidiOutOffset" />
                        <div class="w-full flex justify-between text-xl text-neutral px-2">
                            <span class="relative"
                                  :class="{'active': settings.intMidiOutOffset == -36}">
                                -3
                            </span>
                            <span class="relative"
                                  :class="{'active': settings.intMidiOutOffset == -24}">
                                -2
                            </span>
                            <span class="relative"
                                  :class="{'active': settings.intMidiOutOffset == -12}">
                                -1
                            </span>
                            <span class="relative"
                                  :class="{'active': settings.intMidiOutOffset == 0}">
                                0
                            </span>
                            <span class="relative"
                                  :class="{'active': settings.intMidiOutOffset == 12}">
                                +1
                            </span>
                            <span class="relative"
                                  :class="{'active': settings.intMidiOutOffset == 24}">
                                +2
                            </span>
                            <span class="relative"
                                  :class="{'active': settings.intMidiOutOffset == 36}">
                                +3
                            </span>
                        </div>
                    </div>

                    <div class="grid gap-4 form-control w-full mt-3">
                        <label class="label justify-start gap-2">
                            <span class="label-text text-xl">EXTERNAL MIDI NOTE OFFSET</span>
                            <div class="tooltip" data-tip="This is an offset, in octaves, applied to the MIDI note output on the external channel. Useful when connected to gear that does not follow the A4 = 440 Hz MIDI norm">
                                <button class="text-neutral"><v-icon name="md-help" scale="1.25" /></button>
                            </div>
                        </label>
                        <input type="range"
                               min="-36"
                               max="36"
                               class="range range-neutral"
                               step="12"
                               v-model="settings.extMidiOutOffset" />
                        <div class="w-full flex justify-between text-xl text-neutral px-2">
                            <span class="relative"
                                  :class="{'active': settings.extMidiOutOffset == -36}">
                                -3
                            </span>
                            <span class="relative"
                                  :class="{'active': settings.extMidiOutOffset == -24}">
                                -2
                            </span>
                            <span class="relative"
                                  :class="{'active': settings.extMidiOutOffset == -12}">
                                -1
                            </span>
                            <span class="relative"
                                  :class="{'active': settings.extMidiOutOffset == 0}">
                                0
                            </span>
                            <span class="relative"
                                  :class="{'active': settings.extMidiOutOffset == 12}">
                                +1
                            </span>
                            <span class="relative"
                                  :class="{'active': settings.extMidiOutOffset == 24}">
                                +2
                            </span>
                            <span class="relative"
                                  :class="{'active': settings.extMidiOutOffset == 36}">
                                +3
                            </span>
                        </div>
                    </div>
				</div>
			</div>

			<div class="grid gap-6 w-screen max-w-xl">
				<div class="px-12">
					<hr class="border-neutral/15">
				</div>
				<TuningTableEditor @data-updated="handleTuningTableUpdate" :tuning-table="settings.tuningTable" v-if="settings.tuningTable" />
				<div class="px-12">
					<hr class="border-neutral/15">
				</div>
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
