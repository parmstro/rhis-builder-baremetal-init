# rhis-builder-baremetal-init
This project provides multiple methods to initialize the first identity management node (idm.example.ca) and satellite (satellite.example.ca) node on baremetal with a minimal install of RHEL9.

1) Download iso, generate ks.cfg from template. Create usb drives. Automated install from boot. (Complete)
2) Generate automated install iso from image builder on console.redhat.com, transfer to bootable location (BMC managed). Automated install from boot. (In-progress)

This ensures that the two bootstrap systems to create an RHIS infrastructure are in place for the RHIS provisioner node to configure.
See **[rhis-builder-provisioner wiki](https://github.com/parmstro/rhis-builder-provisioner/wiki)**
