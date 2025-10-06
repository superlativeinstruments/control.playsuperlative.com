CONTROL.PLAYSUPERLATIVE.COM
===========================

Control center for Superlative Instruments USB devices.  
[https://control.playsuperlative.com/](https://control.playsuperlative.com/)

## Development

### Starting dev server

```bash
pnpm dev
```

## Deployment

Continuous delivery is set up through [Vercel](https://vercel.com/).  
Every push to the `main` branch gets deployed to [control.playsuperlative.com](https://control.playsuperlative.com/).  

### Control panel versioning

If a firmware version needs a specific version of the control panel because of compatibility issues, the routing should be done based on USB device version. This version number is the only developer controlled versioning indicator that is read when enumerating.
