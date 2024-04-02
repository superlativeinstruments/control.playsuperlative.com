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

	clockSubdivision: 1
});

const states = reactive({
	WAITING_FOR_REQUEST: 'waitingForRequest',
	WAITING_FOR_DEVICE: 'waitingForDevice',
	READY: 'ready',
	ERROR: 'error'
});

const showConnectionHelp = ref(false);

let state = ref(states.WAITING_FOR_REQUEST);
let deviceName = ref('');

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

	if (message.indexOf('ext_midi_sync_trs_in=') !== -1) {
		console.log('MIDI sync TRS in:', !!data.getUint8(21));
		settings.value.midiSyncTrsIn = !!data.getUint8(21);
	}

	if (message.indexOf('ext_midi_sync_usb_in=') !== -1) {
		console.log('MIDI sync USB in:', !!data.getUint8(21));
		settings.value.midiSyncUsbIn = !!data.getUint8(21);
	}

	if (message.indexOf('int_midi_chan_in=') !== -1) {
		console.log('MIDI channel in:', data.getUint8(17));
		settings.value.midiChannelIn = data.getUint8(17);
	}

	if (message.indexOf('int_midi_chan_out=') !== -1) {
		console.log('MIDI channel out:', data.getUint8(18));
		settings.value.midiChannelOut = data.getUint8(18);
	}
}

async function sendCommand(command, data = null) {
	command = new TextEncoder('utf-8').encode(command);

	if (data === null) {
		await serialPort.send(command);

		return;
	}

	switch (typeof data) {
		case 'string':
			data = new TextEncoder('utf-8').encode(data);
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

	await sendCommand('ext_midi_sync_trs_in');
	await sendCommand('ext_midi_sync_usb_in');
	await sendCommand('int_midi_chan_in');
	await sendCommand('int_midi_chan_out');
	await sendCommand('ext_midi_chan_in');
	await sendCommand('ext_midi_chan_out');

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

	await sendCommand('int_midi_chan_in=', settings.value.midiChannelIn);
	await sendCommand('int_midi_chan_out=', settings.value.midiChannelOut);
	await sendCommand('ext_midi_sync_trs_in=', settings.value.midiSyncTrsIn ? 0x01 : 0x00);
	await sendCommand('ext_midi_sync_usb_in=', settings.value.midiSyncUsbIn ? 0x01 : 0x00);

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
	<div v-if="webusbSupported">
		<div v-if="state == states.WAITING_FOR_REQUEST">
			<button @click="requestDevice" class="btn btn-lg btn-primary">Connect <v-icon name="md-usb" scale="1.5" /></button>
		</div>

		<div v-if="state == states.READY" class="hero bg-base-300 w-screen max-w-xl rounded-xl">
			<div class="grid gap-4 w-screen max-w-xl p-12">
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
						<label class="label-text text-lg text-right">Internal</label>
						<label class="label-text text-lg text-right">External</label>
					</div>
					<div class="grid row-start-2 grid-cols-4 border-primary matrix">
						<div class="grid matrix-column">
							<input type="radio"
								   name="radio-1"
								   class="radio"
								   value="internal"
								   v-model="settings.midiTrsIn"
								   @click="onMatrixRadioClick($event, 'midiTrsIn')" />
							<input type="radio"
								   name="radio-1"
								   class="radio"
								   value="external"
								   v-model="settings.midiTrsIn"
								   @click="onMatrixRadioClick($event, 'midiTrsIn')" />
						</div>
						<div class="grid matrix-column">
							<input type="radio"
								   name="radio-2"
								   class="radio"
								   value="internal"
								   v-model="settings.midiUsbIn"
								   @click="onMatrixRadioClick($event, 'midiUsbIn')" />
							<input type="radio"
								   name="radio-2"
								   class="radio"
								   value="external"
								   v-model="settings.midiUsbIn"
								   @click="onMatrixRadioClick($event, 'midiUsbIn')" />
						</div>
						<div class="grid matrix-column">
							<input type="radio"
								   name="radio-3"
								   class="radio"
								   value="internal"
								   v-model="settings.midiTrsOut"
								   @click="onMatrixRadioClick($event, 'midiTrsOut')" />
							<input type="radio"
								   name="radio-3"
								   class="radio"
								   value="external"
								   v-model="settings.midiTrsOut"
								   @click="onMatrixRadioClick($event, 'midiTrsOut')" />
						</div>
						<div class="grid matrix-column">
							<input type="radio"
								   name="radio-4"
								   class="radio"
								   value="internal"
								   v-model="settings.midiUsbOut"
								   @click="onMatrixRadioClick($event, 'midiUsbOut')" />
							<input type="radio"
								   name="radio-4"
								   class="radio"
								   value="external"
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
							<select class="select select-accent"
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
							<select class="select select-accent"
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
								   :disabled="settings.midiUsbIn == ''" />
						</label>
					</div>
				</div>

				<div class="grid gap-4 form-control w-full mb-12">
					<label class="label justify-start gap-2">
						<span class="label-text text-xl">Clock subdivision</span>
						<div class="tooltip" data-tip="MIDI clock is 24ppm. This means that 24 clock ticks represent a single quarter note. You can divide this with the slider below so that the SB01 LFO is triggered faster or slower than the standard quarter note">
							<button class="text-neutral"><v-icon name="md-help" scale="1.25" /></button>
						</div>
					</label>
					<input type="range" min="0" max="6" class="range range-accent" step="1" v-model="settings.clockSubdivision" />
					<div class="w-full flex justify-between text-xs px-2">
						<span class="relative font-music text-3xl text-neutral"
							  :class="{'!text-accent': settings.clockSubdivision == 0}">
							𝅗𝅥
						</span> <!-- 48 -->
						<span class="relative font-music text-3xl text-neutral"
							  :class="{'!text-accent': settings.clockSubdivision == 1}">
							𝅘𝅥
						</span> <!-- 24 -->
						<span class="relative font-music text-3xl text-neutral"
							  :class="{'!text-accent': settings.clockSubdivision == 2}">
							𝅘𝅥<span class="font-sans absolute -top-4">³</span>
						</span> <!-- 16 -->
						<span class="relative font-music text-3xl text-neutral"
							  :class="{'!text-accent': settings.clockSubdivision == 3}">
							𝅘𝅥𝅯
						</span> <!-- 12 -->
						<span class="relative font-music text-3xl text-neutral"
							  :class="{'!text-accent': settings.clockSubdivision == 4}">
							𝅘𝅥𝅯<span class="font-sans absolute -top-4">³</span>
						</span> <!-- 8 -->
						<span class="relative font-music text-3xl text-neutral"
							  :class="{'!text-accent': settings.clockSubdivision == 5}">
							𝅘𝅥𝅰
						</span> <!-- 6 -->
						<span class="relative font-music text-3xl text-neutral"
							  :class="{'!text-accent': settings.clockSubdivision == 6}">
							𝅘𝅥𝅰<span class="font-sans absolute -top-4">³</span>
						</span> <!-- 4 -->
					</div>
				</div>

				<div>
					<button type="button" @click="save" class="btn btn-lg btn-accent w-full">Save
						<span v-if="saving" class="loading loading-spinner loading-sm"></span>
					</button>
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
		border-left-width: 1px;
	}
}

.radio {
	@apply rounded-none;
	width: calc(3rem - 1px);
	height: calc(3rem - 1px);
	border-left-width: 0;

	&:not(:nth-child(1)) {
		border-top-width: 0;
	}

	&:checked {
		@apply radio-accent;
		border-width: 1px;
	}
}

.matrix-col-label {
	position: relative;
	left: 1.5rem;
	max-width: calc(3rem - 1px);
	overflow: visible;
	white-space: nowrap;
	transform-origin: bottom left;
	transform: rotate(-45deg);
}
</style>
