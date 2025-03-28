# rhis-builder-baremetal-init

Fork it. Clone it. Configure it. Test it. Change it. Commit it. Create a PR.

***

This project provides multiple methods to initialize the first identity management node (idm.example.ca) and satellite (satellite.example.ca) node on baremetal with a minimal install of RHEL9.

1) Download iso, generate ks.cfg from template. Create usb drives. Automated install from boot. (Complete)
2) Generate automated install iso from image builder on console.redhat.com, transfer to bootable location (BMC managed). Automated install from boot. (In-progress)

### Vaulted Variables that you will need. 
You can add the following variables to your rhis-builder-vault.yml file or create a separate vault file specifically for this repository.
***Remember:*** Keep your vault files out of your project. Ensure you have a global exclude set for any vault or credential files. Be safe. It is always good to implement [secret scanning](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning) of some kind.

```
# Stuff that gets passed to the ks.cfg template
# We don't leave this around in the environment afterwards.

encrypted_root_pass_vault:           # an appropriately encrypted root password
encrypted_user_pass_vault:           # an appropriately encrypted user password
encrypted_grub_pass_vault:           # an appropriately encrypted grub password
user_sudoer_policy_vault:            # "my_ansible_user  ALL=(ALL) ALL" needs to be able to access sudo
builder_key_file_vault:              # allow user to access systems... this is cleaned up after install
builder_pub_file_vault:              # pub file for above
builder_authorized_keys_file_vault:  # authorized keys file.
```

## Method 1

- Create a baremetal_init_vars.yml configuration file for your idm and satellite systems from the SAMPLE file. 
- Create a vault file to contain the secrets.
- Download the RHEL9 bootable dvd iso and create a bootable installer usb device. Follow documentation instructions.
- Create a usb (ext4 or xfs formated works) and label it OEMDRV. Connect it to the system you run this code from.
- run the baremetal_init role using your satellite or idm configuration.

The process will create a ks.cfg file. 
Insert both USBs in your baremetal machine destined to be the machine you ran the role for and power it on. Ensure that it boots the usb.
Because there is a USB drv labeled OEMDRV, anaconda will inspect that drive and use ks.cfg on that drive to build the box.
When the system reboots, pull the USB drives.

Repeat the process for your other system, idm or satellite. which every you did not create yet.

When you are done, you are ready to start with rhis-builder-idm.

See baremetal_init_vars.yml.SAMPLE

This ensures that the two bootstrap systems to create an RHIS infrastructure are in place for the RHIS provisioner node to configure.
See **[rhis-builder-provisioner wiki](https://github.com/parmstro/rhis-builder-provisioner/wiki)**

PRs are always welcome.

ENJOY!


<hr>

### Appendix

Baremetal Init Variables.

**ks_path** - the name of the kickstart file. This should always be "ks.cfg"

**oem_dir** - this is the path that your OEMDRV USB drive will mount on. e.g.  "/run/media/yourusername/OEMDRV"

**baremetal_hosts** - the dictionary that contains the baremetal hosts

baremetal_host attributes

**rhis_role** - for our bookkeeping. e.g. "satellite"

**hostname** - the hostname for the current system "satellite"

**domain** - the domain for the current system. e.g. "example.ca"

**mac** - the mac address of the primary interface for the system: e.g. "ff:ff:ff:ff:ff:fe"
    
**ipv4_address** - the IPv4 address. This should be a private range address e.g. "10.10.8.21"
    
**ipv4_netmask** - the IPv4 netmask. Ensure there are enough addresses in your range for your lab. e.g. "255.255.252.0" give 1020 addresses
    
**ipv4_gateway** - the IPv4 gateway. We need access to the internet to patch the systems and download content. e.g. "10.10.8.1"
    
**name_server1** - the IPv4 address of the first DNS server. e.g. "10.20.8.5"

**name_server2** - the IPv4 address of the second DNS server. e.g.  "10.20.8.6"

**root_enc_pass** - the encrypted root password for the system. Always set to "{{ encrypted_root_pass_vault }}". Create an encrypted password string with mkpasswd and store it in your vault file.

**grub_enc_pass** - Optional. the encrypted grub bootloader password. Always set to "{{ encrypted_grub_pass_vault }}". Create an encrytped password string with grub2-mkpasswd-pbkdf2 and store the value in your vault file.

**boot_disk** - the disk to create /boot and /boot/efi on. e.g. "nvme0n1"
    
**root_disk** - the disk to create the root volume group on. usuallly the same as boot_disk e.g. "nvme0n1"

We create a compliance compatible volume layout. This satisfies most checklists, e.g. CIS Server Level 2, DISA STIG, and similar  
See the sample file. The volume sizes are reasonable and expect a 256GB drive at minimum. Your satellite server should have a 1TB drive.

lv_var is set to 1mb, however, the ks.cfg.j2 template tells anaconda to grow it to fill the rest of the drive
Downloading all the repositories for all the samples requires ~900 GiB or a little more. If you put on more distributions, more than 1 TB easily.

**username** - the user that run all the playbooks from the Provisioner node. Needs sudo access. e.g. "rhisbuilder"
    
**user_enc_pass** - the above users encrypted password. Always set to "{{ encrypted_user_pass_vault }}". Use mkpasswd as before to create an encrypted string for your vault file.

**user_sudoer_policy** - the sudoer policy for the above user. Always set to "{{ user_sudoer_policy_vault }}". Use the ansible commandline to pass the sudoer password.

**ssh_pub_key** - the above users ssh public key from the Provisioner node. Always set to "{{ ssh_pub_key_vault }}". This is the actual public key string stored in the vault file.

Your first Satellite server must be registered to the CDN to get content. Your IdM server needs to be to start. We will later, unregister it and re-register it to the Satellite server after it is built. 

**org** - your Red Hat CDN organization. Always set to "{{ cdn_organization_vault }}". Store this in the vault file.

**activation_key** - an activation key to register the node to the Red Hat CDN. Always set to "{{ cdn_activation_key_vault }}". Store this in the vault file.


