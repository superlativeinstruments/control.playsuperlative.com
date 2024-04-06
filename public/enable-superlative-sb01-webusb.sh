#!/bin/sh

# Ensure the user is in the `plugdev` group (ignore errors if the user is already in the group)
sudo adduser $USER plugdev || true

# Gives the `plugdev` group permission to access the Superlative SB01 USB device
sudo /bin/sh -c 'echo "SUBSYSTEM==\"usb\", ATTR{idVendor}==\"0483\", ATTR{idProduct}==\"a417\", GROUP=\"plugdev\"" > /etc/udev/rules.d/50-superlative-sb01.rules'

# Reload the udev rules
sudo udevadm control --reload-rules
