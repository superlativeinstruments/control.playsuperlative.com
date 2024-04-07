class SerialPort {
	device;
	interfaceNumber;
	endpointIn;
	endpointOut;
	eventListeners = {};

	constructor(device) {
		this.device = device;
		this.interfaceNumber = 0;
		this.endpointIn = 0;
		this.endpointOut = 0;
	}

	emit(method, payload = null) {
		const callback = this.eventListeners[method];
		if (typeof callback === 'function') {
			callback(payload);
		}
	}

	addEventListener(method, callback) {
		this.eventListeners[method] = callback;
	}

	async connect() {
		await this.device.open();

		if (this.device.configuration.configurationValue !== 1) {
			this.device.setConfiguration(1);
		}

		const interfaces = this.device.configuration.interfaces;
		const compatible_interfaces = interfaces.filter(
			_interface => _interface.alternates.find(
				alternate => alternate.interfaceClass === 0xff
			)
		);
		this.interfaceNumber = compatible_interfaces[1].interfaceNumber;
		const alternate = compatible_interfaces[1].alternates[0];
		this.endpointIn = alternate.endpoints.find(endpoint => endpoint.direction === 'in').endpointNumber;
		this.endpointOut = alternate.endpoints.find(endpoint => endpoint.direction === 'out').endpointNumber;

        await this.device.claimInterface(this.interfaceNumber);
        await this.device.controlTransferOut({
            requestType: 'vendor',
            recipient: 'interface',
            request: 0x22,
            value: 0x01,
            index: this.interfaceNumber
        });

		// return;

		let result;
		let readLoop = async () => {
			try {
				result = await this.device.transferIn(this.endpointIn, 64);
				this.emit('data', result.data);
				await readLoop();
			} catch (error) {
				await this.device.releaseInterface(this.interfaceNumber);
				this.emit('readError');
			}
		}

		this.emit('connect');
		readLoop();
	}

	async disconnect() {
		await this.device.controlTransferOut({
			requestType: 'class',
			recipient: 'interface',
			request: 0x22,
			value: 0x00,
			index: this.interfaceNumber
		});

		await this.device.close();
	}

	async send(data) {
		await this.device.transferOut(this.endpointOut, data);
	}
}

export default SerialPort;
