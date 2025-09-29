CONTROL.PLAYSUPERLATIVE.COM
===========================

Control center for Superlative Instruments USB devices.  
[https://control.playsuperlative.com/](https://control.playsuperlative.com/)

## Local development setup

Requirements:
- [step / step-ca](https://smallstep.com)

### 1. Add `120.0.0.1 control.playsuperlative.com` to /etc/hosts/

### 2. Initialize certificate authority (CA):

```bash
step ca init
```

You can change name, privisioner and password. Leave the other options as suggested here:

```bash
✔ What would you like to name your new PKI? (e.g. Smallstep): Example Inc.
✔ What DNS names or IP addresses would you like to add to your new CA? (e.g. ca.smallstep.com[,1.1.1.1,etc.]): localhost
✔ What address will your new CA listen at? (e.g. :443): 127.0.0.1:8443
✔ What would you like to name the first provisioner for your new CA? (e.g. you@smallstep.com): bob@example.com
✔ What do you want your password to be? [leave empty and we will generate one]: abc123
```

### 3. In a separate terminal, run your certificate authority

```bash
step-ca $(step path)/config/ca.json
```

### 4. Install root certificate

```bash
step certificate install $(step path)/certs/root_ca.crt
```

### 5. Create certificate

```bash
pnpm run generate_certs
```

***NOTE:** The certificate is only valid for 24 hours, and must be regenerated to keep Chrome happy.*

## Local development

### Install dependecies

```bash
pnpm install
```

### Starting dev server

```bash
sudo pnpm run dev
```
***NOTE:** `sudo` is required on macOS because of SSL certificates.*

Server should now be reachable at `https://control.playsuperlative.com:[port]`

## Deployment

Continuous delivery is set up through [Vercel](https://vercel.com/).  
Every push to the `main` branch gets deployed to [control.playsuperlative.com](https://control.playsuperlative.com/).  

### Control panel versioning

If a firmware version needs a specific version of the control panel because of compatibility issues, the routing should be done based on USB device version. This version number is the only developer controlled versioning indicator that is read when enumerating.
