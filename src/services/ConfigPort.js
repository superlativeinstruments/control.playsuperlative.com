class ConfigPort {
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
				alternate => alternate.interfaceClass === 0xFF
			)
		);

		this.interfaceNumber = compatible_interfaces[0].interfaceNumber;

        await this.device.claimInterface(this.interfaceNumber);

		this.emit('connect');
	}

	async disconnect() {
		await this.device.close();
	}

	async read(address) {
		if (address < 0 || address > 0x7f) {
			throw new Error('Address out of range');
		}

        await this.device.controlTransferOut({
            requestType: 'vendor',
            recipient: 'interface',
            request: address,
            value: 0x00, // No meaning for read operations
            index: this.interfaceNumber
        });

        let result = await this.device.controlTransferIn({
            requestType: 'vendor',
            recipient: 'interface',
            request: address,
            value: 0x00,
            index: this.interfaceNumber
		}, 64);

		result = new Uint16Array(result.data.buffer)[0];

		return result;
	}

	async write(address, data) {
		if (address < 0 || address > 0x7f) {
			throw new Error('Address out of range');
		}

		if (!Number.isInteger(data) || data < 0 || data > 65535) {
			throw new Error('Data must be an integer between 0 and 65535');
		}

		data = new Uint16Array([data]);

        await this.device.controlTransferOut({
            requestType: 'vendor',
            recipient: 'interface',
            request: address | 0x80,
            value: data[0],
            index: this.interfaceNumber
        });
	}
}

export default ConfigPort;
