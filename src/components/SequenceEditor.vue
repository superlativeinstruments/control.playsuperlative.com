<script setup>
import { ref } from 'vue';
const keysCount = ref(60);
const stepsCount = ref(128);
const firstKey = ref(36); // MIDI note number for C2
const pianoRoll = ref(null);
let activeEventElement = null;

const states = {
	IDLE: 'idle',
	RESIZING_LEFT: 'resizingLeft',
	RESIZING_RIGHT: 'resizingRight',
};

let state = states.IDLE;

function getRowColumnUnderMouse(mouseX, mouseY) {
	if (!pianoRoll.value) {
		return { column: null, row: null };
	}

	const rect = pianoRoll.value.getBoundingClientRect();
	const x = mouseX - rect.left;
	const y = mouseY - rect.top;
	const column = Math.floor(x / 30) + 1; // 30px per step
	const row = Math.floor(y / 30) + 1; // 30px per key

	return { column, row };
}

let oldColumn = null;
let oldRow = null;
function onMouseMove(event) {
	const {column, row} = getRowColumnUnderMouse(event.clientX, event.clientY);

	switch (state) {
		case states.RESIZING_LEFT:
			// Handle left resize
			if (column !== oldColumn) {
				const start = parseInt(activeEventElement.dataset.columnStart);
				const end = parseInt(activeEventElement.dataset.columnEnd);
				const newStart = Math.min(column, end - 1);
				activeEventElement.dataset.columnStart = newStart;
				activeEventElement.style.gridColumnStart = newStart;
			}
			break;
		case states.RESIZING_RIGHT:
			// Handle right resize
			if (column !== oldColumn) {
				const start = parseInt(activeEventElement.dataset.columnStart);
				const end = parseInt(activeEventElement.dataset.columnEnd);
				const newEnd = Math.max(column + 1, start + 1);
				activeEventElement.dataset.columnEnd = newEnd;
				activeEventElement.style.gridColumnEnd = newEnd;
			}
			break;
		default:
			// Do nothing
			break;
	}

	oldColumn = column;
	oldRow = row;
}

function removeEvent(event) {
	event.preventDefault();
	const eventElement = event.target;
	eventElement.remove();
}

function startResizeLeft(event) {
	event.stopPropagation();

	if (event.button != 0) {
		return;
	}

	activeEventElement = event.target.parentElement;
	state = states.RESIZING_LEFT;

	document.addEventListener('mouseup', stopResize, { once: true });
}

function startResizeRight(event) {
	event.stopPropagation();

	if (event.button != 0) {
		return;
	}

	activeEventElement = event.target.parentElement;
	state = states.RESIZING_RIGHT;

	document.addEventListener('mouseup', stopResize, { once: true });
}

function stopResize(event) {
	event.stopPropagation();

	if (event.button != 0) {
		return;
	}

	activeEventElement = null;
	state = states.IDLE;
}

function addEvent(event) {
	let column;
	let row;

	// Get column and row from mouse event click on .piano-roll
	const rect = event.currentTarget.getBoundingClientRect();
	const x = event.clientX - rect.left;
	const y = event.clientY - rect.top;
	column = Math.floor(x / 30) + 1; // 30px per step
	row = Math.floor(y / 30) + 1; // 30px per key
	const step = column;
	const key = row;
	
	const eventElement = document.createElement('div');
	eventElement.classList.add('event');
	eventElement.dataset.columnStart = step;
	eventElement.dataset.columnEnd = step + 1;
	eventElement.dataset.rowStart = key;
	eventElement.dataset.rowEnd = key + 1;
	eventElement.style.gridColumnStart = step;
	eventElement.style.gridColumnEnd = step + 1;
	eventElement.style.gridRowStart = key;
	eventElement.style.gridRowEnd = key + 1;

	const resizeHandleLeftElement = document.createElement('div');
	resizeHandleLeftElement.classList.add('resize-handle-left');
	eventElement.appendChild(resizeHandleLeftElement);

	const resizeHandleRightElement = document.createElement('div');
	resizeHandleRightElement.classList.add('resize-handle-right');
	eventElement.appendChild(resizeHandleRightElement);

	eventElement.addEventListener('dblclick', removeEvent);
	resizeHandleLeftElement.addEventListener('mousedown', startResizeLeft);
	resizeHandleRightElement.addEventListener('mousedown', startResizeRight);

	event.target.appendChild(eventElement);

	serializeEvents();
}

function serializeEvents() {
	if (!pianoRoll.value) {
		return [];
	}

	const eventElements = pianoRoll.value.querySelectorAll('.event');
	const events = [];
	const serializedEvents = [];

	eventElements.forEach((eventElement) => {
		const start = parseInt(eventElement.dataset.columnStart) - 1;
		const end = parseInt(eventElement.dataset.columnEnd) - 1;
		const key = 61 - parseInt(eventElement.dataset.rowStart);

		events.push({
			start,
			end,
			key
		});
	});

	events.sort((a, b) => a.start - b.start);

	for (let i = 0; i < stepsCount.value; i++) {
		// If there is no event that spans this step, append a rest event
		if (!events.some(event => event.start <= i && event.end > i)) {
			serializedEvents.push({
				type: 'rest',
				step: i
			});

			continue;
		}

		// If there is an event which starts at this step, and no other event spans this step, append a note on event
		const startingEvents = events.filter(event => event.start === i);
		const highestKeyStartingEvent = startingEvents.length ? startingEvents.reduce((prev, current) => (prev.key > current.key) ? prev : current) : null;
		const spanningEvents = events.filter(event => event.start < i && event.end > i);

		if (startingEvents.length > 0 && spanningEvents.length === 0) {
			// Add event with the highest key
			serializedEvents.push({
				type: 'note_on',
				step: i,
				key: highestKeyStartingEvent.key
			});

			continue;
		}

		// If there is an event that starts at this step and there are events that span this step, append a legato event
		if (startingEvents.length > 0 && spanningEvents.length > 0) {
			serializedEvents.push({
				type: 'legato',
				step: i,
				key: highestKeyStartingEvent.key
			});

			continue;
		}

		// If there is an event that spans this step with the same key as the previous event, append a legato event
		const previousEvent = serializedEvents[serializedEvents.length - 1];

		if (spanningEvents.length === 1 && previousEvent && previousEvent.key === spanningEvents[0].key) {
			serializedEvents.push({
				type: 'legato',
				step: i,
				key: spanningEvents[0].key
			});

			continue;
		}
	}

	console.log(serializedEvents);

	return events;
}

document.addEventListener('mousemove', onMouseMove);
</script>

<template class="root">
	<div class="editor">
	<menu>
		<label for="keys-count" class="label uppercase">Sequence length</label>
		<input name="keys-count" type="number" v-model="stepsCount" min="1" max="128" />
	</menu>
	<div class="piano-roll">
		<div class="piano-keys"></div>
		<div ref="pianoRoll" class="grid" :style="{'--bounds-width': ((128 - stepsCount) * 30) + 'px'}" @dblclick.prevent="addEvent"></div>
	</div>
	</div>
</template>

<style lang="postcss">
.event {
	--border-color: rgba(100, 100, 100, 0.2);

	position: relative;
	background-color: #4caf50;
	border: 1px solid var(--border-color);

	.resize-handle-right {
		position: absolute;
		top: 0;
		right: 0;
		width: 10px;
		height: 100%;
		cursor: ew-resize;
	}

	.resize-handle-left {
		position: absolute;
		top: 0;
		left: 0;
		width: 10px;
		height: 100%;
		cursor: ew-resize;
	}
}
</style>

<style scoped lang="postcss">
.editor {
	display: grid;
	gap: 1rem;
}

menu {
	display: flex;
	align-items: center;
	gap: 1rem;

	input {
		position: relative;
		@apply input input-sm;
		text-align: right;

		&.invalid {
			@apply input-error;
		}
	}
}

.piano-roll {
	--border-color: rgba(100, 100, 100, 0.2);

	display: grid;
	grid-template-columns: auto 1fr;
	width: 100%;
	height: 400px;
	overflow: scroll;
	scrollbar-color: var(--border-color) transparent;
}

.piano-keys {
	grid-area: piano-keys;
	position: sticky;
	left: 0;
	width: 30px;
	height: calc(30px * 61);
	z-index: 10;

	&::before {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		width: 100%;
		height: 100%;
		background-position: left 30px;
		background-size: 60px 360px;
		background-image: url('data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="360"><rect x="0" y="0" width="60" height="30" style="fill:white;"/> <rect x="0" y="30" width="60" height="30" style="fill:black;"/> <rect x="0" y="60" width="60" height="30" style="fill:white;"/> <rect x="0" y="90" width="60" height="30" style="fill:black;"/> <rect x="0" y="120" width="60" height="30" style="fill:white;"/> <rect x="0" y="150" width="60" height="30" style="fill:black;"/> <rect x="0" y="180" width="60" height="30" style="fill:white;"/> <rect x="0" y="210" width="60" height="30" style="fill:white;"/> <rect x="0" y="240" width="60" height="30" style="fill:black;"/> <rect x="0" y="270" width="60" height="30" style="fill:white;"/> <rect x="0" y="300" width="60" height="30" style="fill:black;"/> <rect x="0" y="330" width="60" height="30" style="fill:white;"/></svg>');
	}

	&::after {
		content: '';
		position: absolute;
		bottom: 0;
		right: 0;
		width: 100%;
		height: 100%;
		background-size: 30px 30px;
		background-image: 
		linear-gradient(var(--border-color) 1px, transparent 1px);
		border-bottom: 1px solid var(--border-color);
	}
}

.grid {
	--row-color-white: rgba(255, 255, 255, 0.05);
	--row-color-black: rgba(0, 0, 0, 0.1);

	grid-area: piano-roll;
	position: relative;
	display: grid;
	grid-template-rows: repeat(61, 30px);
	grid-template-columns: repeat(128, 30px);
	width: fit-content;
    background-image: 
        linear-gradient(var(--border-color) 1px, transparent 1px),
        linear-gradient(90deg, var(--border-color) 1px, transparent 1px),
	repeating-linear-gradient(
		180deg,
		var(--row-color-white) 0px,    /* Row 1: white */
		var(--row-color-white) 30px,   
		var(--row-color-white) 30px,   /* Row 2: white */
		var(--row-color-white) 60px,   
		var(--row-color-black) 60px,   /* Row 3: black */
		var(--row-color-black) 90px,   
		var(--row-color-white) 90px,   /* Row 4: white */
		var(--row-color-white) 120px,  
		var(--row-color-black) 120px,  /* Row 5: black */
		var(--row-color-black) 150px,  
		var(--row-color-white) 150px,  /* Row 6: white */
		var(--row-color-white) 180px,  
		var(--row-color-black) 180px,  /* Row 7: black */
		var(--row-color-black) 210px,  
		var(--row-color-white) 210px,  /* Row 8: white */
		var(--row-color-white) 240px,  
		var(--row-color-white) 240px,  /* Row 9: white */
		var(--row-color-white) 270px,  
		var(--row-color-black) 270px,  /* Row 10: black */
		var(--row-color-black) 300px,  
		var(--row-color-white) 300px,  /* Row 11: white */
		var(--row-color-white) 330px,  
		var(--row-color-black) 330px,  /* Row 12: black */
		var(--row-color-black) 360px
	);

	background-size: 
        30px 30px,
        30px 30px,
        100% 360px;

	background-position: left top;
	background-repeat: repeat;

    border-bottom: 1px solid var(--border-color);
    border-right: 1px solid var(--border-color);

	&::after {
		content: '';
		position: absolute;
		bottom: 0;
		right: 0;
		width: var(--bounds-width);
		height: 100%;
		background-color: rgba(0, 0, 0, 0.5);
	}
}

.key {
	display: grid;
	grid-template-columns: repeat(auto-fill, fit-content(60px));
	grid-auto-flow: column;
	border-bottom: 1px solid #666;
}

.step {
	width: 30px;
	height: 30px;
	border-left: 1px solid #666;
	background-color: #333;

	&.active {
		background-color: #4caf50;
	}

	&.extends {
		border-left: none;
	}
}
</style>
