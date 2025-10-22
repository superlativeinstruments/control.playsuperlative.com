<script>
import { ref, reactive, watch } from 'vue';
import ControlPanelSb01 from './ControlPanelSb01.vue';
import ControlPanelSb01V3 from './ControlPanelSb01V3.vue';
import ControlPanelSb01V4 from './ControlPanelSb01V4.vue';
import ControlPanelSb01V5 from './ControlPanelSb01V5.vue';
import ControlPanelCicada from './ControlPanelCicada.vue';

const compatibleDevices = [
	{vendorId: 0x0483, productId: 0xA417}, // SB01
	{vendorId: 0x16D0, productId: 0x1456}, // CICADA
];

let device = ref(null, { deep: true });
let webusbSupported = ref(true);
let loading = ref(true);

const states = reactive({
	WAITING_FOR_REQUEST: 'waitingForRequest',
	WAITING_FOR_DEVICE: 'waitingForDevice',
	READY: 'ready',
	ERROR: 'error'
});

const showConnectionHelp = ref(false);

let state = ref(states.WAITING_FOR_REQUEST);
let deviceName = ref('');
let deviceVersion = ref(0);

async function searchForCompatibleDevices() {
	let devices = await navigator.usb.getDevices();
	devices = devices.filter(device => (
		compatibleDevices.find(d => (
			device.vendorId == d.vendorId && 
			device.productId == d.productId
		))
	));

	console.info('Searching for compatible devices:', devices);

	return devices;
}

async function onConnect() {
	let devices = await searchForCompatibleDevices();

	if (devices.length > 0) {
		console.info('Supported USB device connected');

		device.value = devices[0];
		deviceName.value = device.value.productName;
		deviceVersion.value = device.value.deviceVersionMajor;

		state.value = states.READY;
	}
}

function onDisconnect() {
	if (device.value === event.device) {
		console.info('USB device disconnected');

		device.value.disconnected = true;
		device.value = null;

		state.value = states.WAITING_FOR_REQUEST;
	}
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
		device.value = await navigator.usb.requestDevice({
			filters: compatibleDevices
		});

		deviceName.value = device.value.productName;
		deviceVersion.value = device.value.deviceVersionMajor;

		state.value = states.READY;
	} catch (error) {
		console.error('No device selected');
	}
}

if (webusbSupported.value) {
	devices = await searchForCompatibleDevices();
}

if (devices.length > 0) {
	device.value = devices[0];
	deviceName.value = device.value.productName;
	deviceVersion.value = device.value.deviceVersionMajor;

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
			<button @click="requestDevice" class="btn btn-lg btn-outline">
				Connect
				<v-icon name="md-usb" scale="1.5" />
			</button>
		</div>

		<div v-if="state == states.READY" class="hero bg-base-300 w-full max-w-xl rounded-xl">
			<ControlPanelSb01 v-if="deviceName == 'SB01' && deviceVersion <= 2" :device="device" :device-name='deviceName' />
			<ControlPanelSb01V3 v-if="deviceName == 'SB01' && deviceVersion == 3" :device="device" :device-name='deviceName' />
			<ControlPanelSb01V4 v-if="deviceName == 'SB01' && deviceVersion == 4" :device="device" :device-name='deviceName' />
			<ControlPanelSb01V5 v-if="deviceName == 'SB01' && deviceVersion >= 5" :device="device" :device-name='deviceName' />
			<ControlPanelCicada v-if="deviceName == 'CICADA'" :device="device" :device-name='deviceName' />
		</div>

		<div v-if="state == states.WAITING_FOR_DEVICE">
			<h1>Please connect a supported device</h1>
		</div>
	</div>

	<div v-if="!webusbSupported" class="grid grid-cols-1 justify-items-center gap-12 w-10/12 max-w-xl">
		<h1 class="text-center text-2xl">
			This browser is not supported.
			<br/>
			<small class="block mt-8">Try one of these:</small>
		</h1>
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
</style>
