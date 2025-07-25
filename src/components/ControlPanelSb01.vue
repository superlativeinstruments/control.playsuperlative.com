<script>
import { ref, reactive, watch } from 'vue';
import ConfigPort from '../services/ConfigPort'

let configPort;
let device;
let deviceName = ref('');
let loading = ref(true);
let saving = ref(false);
let settings = ref({
	midiTrsIn: '',
	midiUsbIn: '',
	midiTrsOut: '',
	midiUsbOut: '',

	midiChannelIn: 0,
	midiChannelOut: 0,

	midiSyncTrsIn: false,
	midiSyncUsbIn: false,

	clockSubdivision: 3
});

let matrixSettings = {
	intMidiTrsIn: false,
	intMidiUsbIn: false,
	intMidiTrsOut: false,
	intMidiUsbOut: false,
	extMidiTrsIn: false,
	extMidiUsbIn: false,
	extMidiTrsOut: false,
	extMidiUsbOut: false
};

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
	MIDI_CHAN_IN: 0x03,
	MIDI_CHAN_OUT: 0x04,
	INT_MIDI_TRS_IN: 0x05,
	INT_MIDI_USB_IN: 0x06,
	INT_MIDI_TRS_OUT: 0x07,
	INT_MIDI_USB_OUT: 0x08,
	EXT_MIDI_TRS_IN: 0x09,
	EXT_MIDI_USB_IN: 0x0A,
	EXT_MIDI_TRS_OUT: 0x0B,
	EXT_MIDI_USB_OUT: 0x0C,
	SAVE: 0x7F,
};

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
	let result;

	result = await configPort.read(configAddresses.MIDI_SYNC_TRS_IN);
	settings.value.midiSyncTrsIn = !!result;

	result = await configPort.read(configAddresses.MIDI_SYNC_USB_IN);
	settings.value.midiSyncUsbIn = !!result;

	result = await configPort.read(configAddresses.CLOCK_DIVISION);
	settings.value.clockSubdivision = clockSubdivisionMap.indexOf(result);

	result = await configPort.read(configAddresses.MIDI_CHAN_IN);
	settings.value.midiChannelIn = result;

	result = await configPort.read(configAddresses.MIDI_CHAN_OUT);
	settings.value.midiChannelOut = result;

	result = await configPort.read(configAddresses.INT_MIDI_TRS_IN);
	matrixSettings.intMidiTrsIn = !!result;

	result = await configPort.read(configAddresses.INT_MIDI_USB_IN);
	matrixSettings.intMidiUsbIn = !!result;

	result = await configPort.read(configAddresses.INT_MIDI_TRS_OUT);
	matrixSettings.intMidiTrsOut = !!result;

	result = await configPort.read(configAddresses.INT_MIDI_USB_OUT);
	matrixSettings.intMidiUsbOut = !!result;

	result = await configPort.read(configAddresses.EXT_MIDI_TRS_IN);
	matrixSettings.extMidiTrsIn = !!result;

	result = await configPort.read(configAddresses.EXT_MIDI_USB_IN);
	matrixSettings.extMidiUsbIn = !!result;

	result = await configPort.read(configAddresses.EXT_MIDI_TRS_OUT);
	matrixSettings.extMidiTrsOut = !!result;

	result = await configPort.read(configAddresses.EXT_MIDI_USB_OUT);
	matrixSettings.extMidiUsbOut = !!result;

	settings.value.midiTrsIn = matrixSettings.intMidiTrsIn ? 'internal' : '';
	settings.value.midiTrsIn = matrixSettings.extMidiTrsIn ? 'external' : settings.value.midiTrsIn;
	settings.value.midiUsbIn = matrixSettings.intMidiUsbIn ? 'internal' : '';
	settings.value.midiUsbIn = matrixSettings.extMidiUsbIn ? 'external' : settings.value.midiUsbIn;
	settings.value.midiTrsOut = matrixSettings.intMidiTrsOut ? 'internal' : '';
	settings.value.midiTrsOut = matrixSettings.extMidiTrsOut ? 'external' : settings.value.midiTrsOut;
	settings.value.midiUsbOut = matrixSettings.intMidiUsbOut ? 'internal' : '';
	settings.value.midiUsbOut = matrixSettings.extMidiUsbOut ? 'external' : settings.value.midiUsbOut;

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

	await configPort.write(configAddresses.MIDI_SYNC_TRS_IN, settings.value.midiSyncTrsIn ? 0x01 : 0x00);
	await configPort.write(configAddresses.MIDI_SYNC_USB_IN, settings.value.midiSyncUsbIn ? 0x01 : 0x00);
	await configPort.write(configAddresses.CLOCK_DIVISION, clockSubdivisionMap[settings.value.clockSubdivision]);
	await configPort.write(configAddresses.MIDI_CHAN_IN, settings.value.midiChannelIn);
	await configPort.write(configAddresses.MIDI_CHAN_OUT, settings.value.midiChannelOut);

	await configPort.write(configAddresses.INT_MIDI_TRS_IN, settings.value.midiTrsIn === 'internal' ? 0x01 : 0x00);
	await configPort.write(configAddresses.INT_MIDI_USB_IN, settings.value.midiUsbIn === 'internal' ? 0x01 : 0x00);
	await configPort.write(configAddresses.INT_MIDI_TRS_OUT, settings.value.midiTrsOut === 'internal' ? 0x01 : 0x00);
	await configPort.write(configAddresses.INT_MIDI_USB_OUT, settings.value.midiUsbOut === 'internal' ? 0x01 : 0x00);

	await configPort.write(configAddresses.EXT_MIDI_TRS_IN, settings.value.midiTrsIn === 'external' ? 0x01 : 0x00);
	await configPort.write(configAddresses.EXT_MIDI_USB_IN, settings.value.midiUsbIn === 'external' ? 0x01 : 0x00);
	await configPort.write(configAddresses.EXT_MIDI_TRS_OUT, settings.value.midiTrsOut === 'external' ? 0x01 : 0x00);
	await configPort.write(configAddresses.EXT_MIDI_USB_OUT, settings.value.midiUsbOut === 'external' ? 0x01 : 0x00);

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
		<header class="w-full bg-black/15 rounded-t-xl mb-8 p-2 px-4">
			<h1 class="text-neutral">SB01 / CONTROLS</h1>
		</header>

		<div class="grid gap-4 w-screen max-w-xl p-12 pt-0">

			<div class="grid justify-center mt-12 mb-8">
				<div class="col-start-2 grid grid-cols-4 pb-2">
					<label class="label-text text-md matrix-col-label"
						   :class="{'text-accent': settings.midiTrsIn != ''}">MIDI in TRS</label>
					<label class="label-text text-md matrix-col-label"
						   :class="{'text-accent': settings.midiUsbIn != ''}">MIDI in USB</label>
					<label class="label-text text-md matrix-col-label"
						   :class="{'text-accent': settings.midiTrsOut != ''}">MIDI out TRS</label>
					<label class="label-text text-md matrix-col-label"
						   :class="{'text-accent': settings.midiUsbOut != ''}">MIDI out USB</label>
				</div>
				<div class="grid row-start-2 grid-rows-2 items-center justify-end pr-3 w-0">
					<label class="label-text text-lg text-right">External</label>
					<label class="label-text text-lg text-right">Internal</label>
				</div>
				<div class="grid row-start-2 grid-cols-4 border-primary matrix">
					<div class="grid matrix-column">
						<input type="radio"
							   name="radio-1"
							   class="radio"
							   value="external"
							   v-model="settings.midiTrsIn"
							   @click="onMatrixRadioClick($event, 'midiTrsIn')" />
						<input type="radio"
							   name="radio-1"
							   class="radio"
							   value="internal"
							   v-model="settings.midiTrsIn"
							   @click="onMatrixRadioClick($event, 'midiTrsIn')" />
					</div>
					<div class="grid matrix-column">
						<input type="radio"
							   name="radio-2"
							   class="radio"
							   value="external"
							   v-model="settings.midiUsbIn"
							   @click="onMatrixRadioClick($event, 'midiUsbIn')" />
						<input type="radio"
							   name="radio-2"
							   class="radio"
							   value="internal"
							   v-model="settings.midiUsbIn"
							   @click="onMatrixRadioClick($event, 'midiUsbIn')" />
					</div>
					<div class="grid matrix-column">
						<input type="radio"
							   name="radio-3"
							   class="radio"
							   value="external"
							   v-model="settings.midiTrsOut"
							   @click="onMatrixRadioClick($event, 'midiTrsOut')" />
						<input type="radio"
							   name="radio-3"
							   class="radio"
							   value="internal"
							   v-model="settings.midiTrsOut"
							   @click="onMatrixRadioClick($event, 'midiTrsOut')" />
					</div>
					<div class="grid matrix-column">
						<input type="radio"
							   name="radio-4"
							   class="radio"
							   value="external"
							   v-model="settings.midiUsbOut"
							   @click="onMatrixRadioClick($event, 'midiUsbOut')" />
						<input type="radio"
							   name="radio-4"
							   class="radio"
							   value="internal"
							   v-model="settings.midiUsbOut"
							   @click="onMatrixRadioClick($event, 'midiUsbOut')" />
					</div>
				</div>
			</div>

			<div class="grid auto-rows-fr gap-4">
				<div class="form-control w-full">
					<label class="cursor-pointer label">
						<span class="label-text text-xl"
							  :disabled="settings.midiTrsIn == '' && settings.midiUsbIn == ''">MIDI channel in</span>
						<select class="select select-neutral"
								v-model="settings.midiChannelIn"
								:disabled="settings.midiTrsIn == '' && settings.midiUsbIn == ''">
							<option v-for="(n, index) in 16" :value="index">{{ n }}</option>
						</select>
					</label>
				</div>
				<div class="form-control w-full">
					<label class="cursor-pointer label">
						<span class="label-text text-xl"
							  :disabled="settings.midiTrsOut == '' && settings.midiUsbOut == ''">MIDI channel out</span>
						<select class="select select-neutral"
								v-model="settings.midiChannelOut"
								:disabled="settings.midiTrsOut == '' && settings.midiUsbOut == ''">
							<option v-for="(n, index) in 16" :value="index">{{ n }}</option>
						</select>
					</label>
				</div>
				<div class="form-control w-full">
					<label class="cursor-pointer label">
						<span class="label-text text-xl"
							  :disabled="settings.midiTrsIn == ''">MIDI clock TRS in</span>
						<input type="checkbox"
							   class="toggle toggle-lg toggle-accent"
							   v-model="settings.midiSyncTrsIn"
							   @change="settings.midiSyncTrsIn ? settings.midiSyncUsbIn = false : ''"
							   :disabled="settings.midiTrsIn == ''" />
					</label>
				</div>
				<div class="form-control w-full">
					<label class="cursor-pointer label">
						<span class="label-text text-xl"
							  :disabled="settings.midiUsbIn == ''">MIDI clock USB in</span>
						<input type="checkbox"
							   class="toggle toggle-lg toggle-accent"
							   v-model="settings.midiSyncUsbIn"
							   @change="settings.midiSyncUsbIn ? settings.midiSyncTrsIn = false : ''"
							   :disabled="settings.midiUsbIn == ''" />
					</label>
				</div>
			</div>

			<div class="grid gap-4 form-control w-full mb-12">
				<label class="label justify-start gap-2">
					<span class="label-text text-xl"
						  :disabled="(!settings.midiSyncTrsIn || !settings.midiTrsIn) && (!settings.midiSyncUsbIn || !settings.midiUsbIn)">Clock subdivision</span>
					<div class="tooltip" data-tip="MIDI clock is 24ppm. This means that 24 clock ticks represent a single quarter note. You can divide this with the slider below so that the SB01 LFO is triggered faster or slower than the standard quarter note">
						<button class="text-neutral"><v-icon name="md-help" scale="1.25" /></button>
					</div>
				</label>
				<input type="range"
					   min="0"
					   max="6"
					   class="range range-neutral"
					   step="1"
					   :disabled="(!settings.midiSyncTrsIn || !settings.midiTrsIn) && (!settings.midiSyncUsbIn || !settings.midiUsbIn)"
					   v-model="settings.clockSubdivision" />
				<div class="w-full flex justify-between text-xs px-2">
					<span class="relative font-music text-3xl"
						  :class="{'active': settings.clockSubdivision == 0}"
						  :disabled="(!settings.midiSyncTrsIn || !settings.midiTrsIn) && (!settings.midiSyncUsbIn || !settings.midiUsbIn)">
						𝅗𝅥
					</span> <!-- 48 -->
					<span class="relative font-music text-3xl"
						  :class="{'active': settings.clockSubdivision == 1}"
						  :disabled="(!settings.midiSyncTrsIn || !settings.midiTrsIn) && (!settings.midiSyncUsbIn || !settings.midiUsbIn)">
						𝅘𝅥
					</span> <!-- 24 -->
					<span class="relative font-music text-3xl"
						  :class="{'active': settings.clockSubdivision == 2}"
						  :disabled="(!settings.midiSyncTrsIn || !settings.midiTrsIn) && (!settings.midiSyncUsbIn || !settings.midiUsbIn)">
						𝅘𝅥<span class="font-sans absolute -top-3">³</span>
					</span> <!-- 16 -->
					<span class="relative font-music text-3xl"
						  :class="{'active': settings.clockSubdivision == 3}"
						  :disabled="(!settings.midiSyncTrsIn || !settings.midiTrsIn) && (!settings.midiSyncUsbIn || !settings.midiUsbIn)">
						𝅘𝅥𝅯
					</span> <!-- 12 -->
					<span class="relative font-music text-3xl"
						  :class="{'active': settings.clockSubdivision == 4}"
						  :disabled="(!settings.midiSyncTrsIn || !settings.midiTrsIn) && (!settings.midiSyncUsbIn || !settings.midiUsbIn)">
						𝅘𝅥𝅯<span class="font-sans absolute -top-3">³</span>
					</span> <!-- 8 -->
					<span class="relative font-music text-3xl"
						  :class="{'active': settings.clockSubdivision == 5}"
						  :disabled="(!settings.midiSyncTrsIn || !settings.midiTrsIn) && (!settings.midiSyncUsbIn || !settings.midiUsbIn)">
						𝅘𝅥𝅰
					</span> <!-- 6 -->
					<span class="relative font-music text-3xl"
						  :class="{'active': settings.clockSubdivision == 6}"
						  :disabled="(!settings.midiSyncTrsIn || !settings.midiTrsIn) && (!settings.midiSyncUsbIn || !settings.midiUsbIn)">
						𝅘𝅥𝅰<span class="font-sans absolute -top-3">³</span>
					</span> <!-- 4 -->
				</div>
			</div>

			<div>
				<button type="button" @click="save" class="btn btn-lg btn-outline w-full">Save
					<span v-if="saving" class="loading loading-spinner loading-sm"></span>
				</button>
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
.radio {
	@apply rounded-none bg-base-100;
	width: calc(3rem - 2px);
	height: calc(3rem - 2px);
	border-width: 2px;
	border-left-width: 0;
	border-color: theme(colors.base-300);

	&:not(:nth-child(1)):not(checked) {
		border-top-width: 0;
	}

	&:checked {
		position: relative;
	}

	&:checked::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 50%;
		height: 50%;
		background-color: theme(colors.accent);
		border-radius: 0.3rem;
		animation: radiomark var(--animation-input, 0.2s) ease-out;
	}
}

@keyframes radiomark {
	0% {
		width: 70%;
		height: 70%;
	}
	50% {
		width: 45%;
		height: 45%;
	}
	100% {
		width: 50%;
		height: 50%;
	}
}
</style>
