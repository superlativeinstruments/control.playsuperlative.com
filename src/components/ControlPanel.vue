<script>
import { ref, reactive, watch } from 'vue';
import SerialPort from '../services/SerialPort'

const vendorId = 0x0483;
const compatibleDevices = [
	0xA417 // SB01
];

let device;
let serialPort;
let webusbSupported = ref(true);
let loading = ref(true);
let saving = ref(false);
let settings = ref({
	midiTrsIn: 'internal',
	midiUsbIn: 'internal',
	midiTrsOut: 'internal',
	midiUsbOut: 'internal',

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

const states = reactive({
	WAITING_FOR_REQUEST: 'waitingForRequest',
	WAITING_FOR_DEVICE: 'waitingForDevice',
	READY: 'ready',
	ERROR: 'error'
});

const showConnectionHelp = ref(false);

let state = ref(states.WAITING_FOR_REQUEST);
let deviceName = ref('');

let clockSubdivisionMap = [
	48,
	24,
	16,
	12,
	8,
	6,
	4
];

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

function onSerialData(data) {
	const textDecoder = new TextDecoder();
	const message = textDecoder.decode(data);

	// Internal MIDI -->
	if (message.indexOf('int_midi_trs_in=') !== -1) {
		console.log('Internal MIDI TRS in:', !!data.getUint8(16));
		matrixSettings.intMidiTrsIn = !!data.getUint8(16);
	}

	if (message.indexOf('int_midi_usb_in=') !== -1) {
		console.log('Internal MIDI USB in:', !!data.getUint8(16));
		matrixSettings.intMidiUsbIn = !!data.getUint8(16);
	}

	if (message.indexOf('int_midi_trs_out=') !== -1) {
		console.log('Internal MIDI TRS in:', !!data.getUint8(17));
		matrixSettings.intMidiTrsOut = !!data.getUint8(17);
	}

	if (message.indexOf('int_midi_usb_out=') !== -1) {
		console.log('Internal MIDI USB in:', !!data.getUint8(17));
		matrixSettings.intMidiUsbOut = !!data.getUint8(17);
	}
	// Internal MIDI <--

	// External MIDI -->
	if (message.indexOf('ext_midi_trs_in=') !== -1) {
		console.log('External MIDI TRS in:', !!data.getUint8(16));
		matrixSettings.extMidiTrsIn = !!data.getUint8(16);
	}

	if (message.indexOf('ext_midi_usb_in=') !== -1) {
		console.log('External MIDI USB in:', !!data.getUint8(16));
		matrixSettings.extMidiUsbIn = !!data.getUint8(16);
	}

	if (message.indexOf('ext_midi_trs_out=') !== -1) {
		console.log('External MIDI TRS in:', !!data.getUint8(17));
		matrixSettings.extMidiTrsOut = !!data.getUint8(17);
	}

	if (message.indexOf('ext_midi_usb_out=') !== -1) {
		console.log('External MIDI USB in:', !!data.getUint8(17));
		matrixSettings.extMidiUsbOut = !!data.getUint8(17);
	}
	// External MIDI <--

	settings.value.midiTrsIn = matrixSettings.intMidiTrsIn ? 'internal' : '';
	settings.value.midiTrsIn = matrixSettings.extMidiTrsIn ? 'external' : settings.value.midiTrsIn;
	settings.value.midiUsbIn = matrixSettings.intMidiUsbIn ? 'internal' : '';
	settings.value.midiUsbIn = matrixSettings.extMidiUsbIn ? 'external' : settings.value.midiUsbIn;
	settings.value.midiTrsOut = matrixSettings.intMidiTrsOut ? 'internal' : '';
	settings.value.midiTrsOut = matrixSettings.extMidiTrsOut ? 'external' : settings.value.midiTrsOut;
	settings.value.midiUsbOut = matrixSettings.intMidiUsbOut ? 'internal' : '';
	settings.value.midiUsbOut = matrixSettings.extMidiUsbOut ? 'external' : settings.value.midiUsbOut;

	if (message.indexOf('midi_sync_trs_in=') !== -1) {
		console.log('MIDI sync TRS in:', !!data.getUint8(17));
		settings.value.midiSyncTrsIn = !!data.getUint8(17);
	}

	if (message.indexOf('midi_sync_usb_in=') !== -1) {
		console.log('MIDI sync USB in:', !!data.getUint8(17));
		settings.value.midiSyncUsbIn = !!data.getUint8(17);
	}

	if (message.indexOf('midi_chan_in=') !== -1) {
		console.log('MIDI channel in:', data.getUint8(13));
		settings.value.midiChannelIn = data.getUint8(13);
	}

	if (message.indexOf('midi_chan_out=') !== -1) {
		console.log('MIDI channel out:', data.getUint8(14));
		settings.value.midiChannelOut = data.getUint8(14);
	}

	if (message.indexOf('clock_division=') !== -1) {
		console.log('Clock division:', data.getUint8(15));
		settings.value.clockSubdivision = clockSubdivisionMap.indexOf(data.getUint8(15));
	}
}

async function sendCommand(command, data = null) {
	command = new TextEncoder('ascii').encode(command);

	if (data === null) {
		await serialPort.send(command);

		return;
	}

	switch (typeof data) {
		case 'string':
			data = new TextEncoder('ascii').encode(data);
			break;
		case 'number':
			data = new Uint8Array([data]);
			break;
		default:
			if (data instanceof Array) {
				data = new Uint8Array(data);
			}
			break;
	}

	const message = concatTypedArrays(command, data);

	await serialPort.send(message);
}

async function onSerialConnect() {
	console.log('Serial port connected');

	await sendCommand('int_midi_trs_in');
	await sendCommand('int_midi_usb_in');
	await sendCommand('int_midi_trs_out');
	await sendCommand('int_midi_usb_out');

	await sendCommand('ext_midi_trs_in');
	await sendCommand('ext_midi_usb_in');
	await sendCommand('ext_midi_trs_out');
	await sendCommand('ext_midi_usb_out');

	await sendCommand('midi_sync_trs_in');
	await sendCommand('midi_sync_usb_in');
	await sendCommand('midi_chan_in');
	await sendCommand('midi_chan_out');
	await sendCommand('clock_division');

	await timeout(1000);
	loading.value = false;
}

function onSerialReadError() {
	console.log('Serial port read error');
}

async function serialPortConnect() {
	console.log('Connecting to serial port');
	serialPort.addEventListener('connect', onSerialConnect);
	serialPort.addEventListener('data', onSerialData);
	serialPort.addEventListener('readError', onSerialReadError);

	serialPort.connect();
}

async function searchForCompatibleDevices() {
	let devices = await navigator.usb.getDevices();
	devices = devices.filter(device => (device.vendorId == vendorId && compatibleDevices.includes(device.productId)));

	return devices;
}

async function onConnect() {
	let devices = await searchForCompatibleDevices();

	if (devices.length > 0) {
		console.info('Supported USB device connected');

		device = devices[0];
		deviceName.value = device.productName;
		serialPort = new SerialPort(device);
		await serialPortConnect();

		state.value = states.READY;
	}
}

function onDisconnect() {
	if (device === event.device) {
		console.info('USB device disconnected');

		device.disconnected = true;
		device = null;
		serialPort = null;

		state.value = states.WAITING_FOR_REQUEST;
	}
}

async function save() {
	saving.value = true;

	await sendCommand('midi_chan_in=', settings.value.midiChannelIn);
	await sendCommand('midi_chan_out=', settings.value.midiChannelOut);
	await sendCommand('midi_sync_trs_in=', settings.value.midiSyncTrsIn ? 0x01 : 0x00);
	await sendCommand('midi_sync_usb_in=', settings.value.midiSyncUsbIn ? 0x01 : 0x00);
	await sendCommand('clock_division=', clockSubdivisionMap[settings.value.clockSubdivision]);

	await sendCommand('int_midi_trs_in=', settings.value.midiTrsIn === 'internal' ? 0x01 : 0x00);
	await sendCommand('int_midi_usb_in=', settings.value.midiUsbIn === 'internal' ? 0x01 : 0x00);
	await sendCommand('int_midi_trs_out=', settings.value.midiTrsOut === 'internal' ? 0x01 : 0x00);
	await sendCommand('int_midi_usb_out=', settings.value.midiUsbOut === 'internal' ? 0x01 : 0x00);
	await sendCommand('ext_midi_trs_in=', settings.value.midiTrsIn === 'external' ? 0x01 : 0x00);
	await sendCommand('ext_midi_usb_in=', settings.value.midiUsbIn === 'external' ? 0x01 : 0x00);
	await sendCommand('ext_midi_trs_out=', settings.value.midiTrsOut === 'external' ? 0x01 : 0x00);
	await sendCommand('ext_midi_usb_out=', settings.value.midiUsbOut === 'external' ? 0x01 : 0x00);

	saving.value = false;
}

if (typeof navigator.usb === 'undefined') {
	webusbSupported.value = false;
} else {
	navigator.usb.addEventListener('connect', onConnect);
	navigator.usb.addEventListener('disconnect', onDisconnect);
}
</script>

<script setup>
import operaLogo from 'browser-logos/src/opera/opera.svg';
import chromeLogo from 'browser-logos/src/chrome/chrome.svg';
import edgeLogo from 'browser-logos/src/edge/edge.svg';

let devices = [];

async function requestDevice() {
	try {
		device = await navigator.usb.requestDevice({
			filters: compatibleDevices.map(element => {
				return {vendorId,  productId: element};
			})
		});

		deviceName.value = device.productName;
		serialPort = new SerialPort(device);
		await serialPortConnect();

		state.value = states.READY;
	} catch (error) {
		console.error('No device selected');
	}
}

if (webusbSupported.value) {
	devices = await searchForCompatibleDevices();
}

if (devices.length > 0) {
	device = devices[0];
	deviceName.value = device.productName;
	serialPort = new SerialPort(device);
	await serialPortConnect();

	state.value = states.READY;
} else {
	state.value = states.WAITING_FOR_REQUEST;
	console.log('No device found');
}

function onMatrixRadioClick(event, value) {
	if (event.target._value === settings.value[value]) {
		settings.value[value] = '';
	}
}
</script>

<template>
	<div v-if="webusbSupported" class="">
		<div v-if="state == states.WAITING_FOR_REQUEST">
			<button @click="requestDevice" class="btn btn-lg btn-primary">Connect <v-icon name="md-usb" scale="1.5" /></button>
		</div>

		<div v-if="state == states.READY" class="hero bg-base-300 w-screen max-w-xl rounded-xl">
			<div>
				<header class="w-full bg-black/15 rounded-t-xl mb-8 p-2 px-4"><h1 class="text-neutral">SB01 / CONTROLS</h1></header>

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
									  :disabled="settings.midiTrsIn == ''">MIDI sync TRS in</span>
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
									  :disabled="settings.midiUsbIn == ''">MIDI sync USB in</span>
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

		<div v-if="state == states.WAITING_FOR_DEVICE">
			<h1>Please connect a supported device</h1>
		</div>
	</div>

	<div v-if="!webusbSupported" class="grid grid-cols-1 justify-items-center gap-12 w-10/12 max-w-xl">
		<h1 class="text-center text-2xl">This browser is not supported.<br/><small class="block mt-8">Try one of these:</small></h1>
		<ul class="grid grid-flow-col auto-cols-fr gap-8 w-full">
			<li class="text-center text-lg text-neutral">
				<a href="https://www.opera.com/download" target="_blank">
					<img class="mb-4" :src="operaLogo" alt="">
					Opera
				</a>
			</li>
			<li class="text-center text-lg text-neutral">
				<a href="https://www.google.com/chrome/" target="_blank">
					<img class="mb-4" :src="chromeLogo" alt="">
					Chrome
				</a>
			</li>
			<li class="text-center text-lg text-neutral">
				<a href="https://www.microsoft.com/edge" target="_blank">
					<img class="mb-4" :src="edgeLogo" alt="">
					Edge
				</a>
			</li>
		</ul>
	</div>
</template>

<style scoped lang="postcss">
.label-text {
	@apply uppercase;

	&[disabled="true"] {
		@apply text-neutral;
	}
}

.matrix {
	width: calc((3rem - 1px) * 4);
	height: calc((3rem - 1px) * 2);
}

.matrix-column {
	&:nth-child(1) .radio {
		border-left-width: 2px;

		&:nth-child(1) {
			@apply rounded-tl-md;
		}

		&:last-child {
			@apply rounded-bl-md;
		}
	}

	&:last-child .radio {
		&:nth-child(1) {
			@apply rounded-tr-md;
		}

		&:last-child {
			@apply rounded-br-md;
		}
	}
}

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
		@apply bg-accent;
		animation: radiomark var(--animation-input, 0.2s) ease-out;
		box-shadow:
		0 0 0 10px theme(colors.base-100) inset,
		0 0 0 10px theme(colors.base-100) inset;
	}
}

.matrix-col-label {
	position: relative;
	left: 1.5rem;
	max-width: calc(3rem - 2px);
	overflow: visible;
	white-space: nowrap;
	transform-origin: bottom left;
	transform: rotate(-45deg);
}

.font-music {
	@apply text-neutral/80;

	&.active {
		@apply !text-accent;
	}

	&.active[disabled="true"] {
		@apply !text-neutral;
	}

	&[disabled="true"] {
		@apply !text-neutral/35;
	}
}

.range[disabled] {
	--range-shdw: theme(colors.base-200);

	@apply cursor-not-allowed;

	&::-webkit-slider-runnable-track {
		@apply bg-base-content/5;
	}

	&::-moz-range-track {
		@apply bg-base-content/5;
	}
}

@keyframes radiomark {
	0% {
		box-shadow:
		0 0 0 16px theme(colors.base-100) inset,
		0 0 0 16px theme(colors.base-100) inset;
	}
	50% {
		box-shadow:
		0 0 0 8px theme(colors.base-100) inset,
		0 0 0 8px theme(colors.base-100) inset;
	}
	100% {
		box-shadow:
		0 0 0 10px theme(colors.base-100) inset,
		0 0 0 10px theme(colors.base-100) inset;
	}
}

[data-theme="superlative"] {
	.rounded-lg,
	.rounded-t-lg,
	.rounded-b-lg,
	.rounded-l-lg,
	.rounded-r-lg,
	.rounded-tl-lg,
	.rounded-tr-lg,
	.rounded-bl-lg,
	.rounded-br-lg,
	.rounded-xl,
	.rounded-t-xl,
	.rounded-b-xl,
	.rounded-l-xl,
	.rounded-r-xl {
		@apply rounded-none;
	}
}
</style>
