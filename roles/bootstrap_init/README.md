### bootstrap_init

This role is a rename of the original baremetal_init role. 

The role is being renamed because it really initializes more than just baremetal hosts.

We are using the OEMDRV method to provision hosts. When a system boots from a RHEL DVD ISO and also discovers a volume labelled "OEMDRV", it will search the OEMDRV volume's root directory looking for a file named "ks.cfg". If this is able to be interpreted as a kickstart file, the boot will continue and anaconda will passed ks.cfg to perform the installation. How we provide the installation media and OEMDRV volume with the kickstart file (ks.cfg) is kind of irrelevant. This could be the virtual CD/DVD drive of a VM, iso files configured for a iDRAC/iLO/RedFish subsystem, or any other volume that a system might use to startup.

So bootstrap_init it is!

bootstrap_init accepts all the same parameters, plus it asks whether you want to create an OEMDRV ISO file. 

generate_oemdrv_iso: 
 - false (default) - only generates the ks file and copies it to the directory specifid by "bootstrap_init_oem_dir"
 - true - generates an ISO9660 .iso file and stores it as a host specific file in "bootstrap_init_iso_dir"

 #### bootstrap_init parameters in order of appearance

bootstrap_init_ks_path: "ks.cfg"
bootstrap_init_oem_dir: "/mnt/OEMDRV"
bootstrap_init_iso_dir: "/mnt/OEMDRV/ISO"


bootstrap_init_hosts:
  - rhis_role: "idm1"
    hostname: "idm1"
    domain: "example.ca"
    mac: "94:c6:91:a3:ac:f5"
    ipv4_address: "192.168.140.10"
    ipv4_netmask: "255.255.252.0"
    ipv4_gateway: "192.168.140.1"
    name_server1: "192.168.252.10"
    name_server2: "8.8.8.8"
    boot_disk: "/dev/nvme0n1"
    root_disk: "/dev/nvme0n1"
    root_enc_pass: "{{ encrypted_root_pass_vault }}"
    grub_enc_pass: "{{ encrypted_grub_pass_vault }}"
    boot_mb: 1024
    boot_efi_mb: 2048
    lv_root_mb: 65536
    lv_home_mb: 20480
    lv_tmp_mb: 6144
    lv_var_tmp_mb: 6144
    lv_var_log_mb: 6144
    lv_var_log_audit_mb: 6144
    lv_var_mb: 1
    username: "ansiblerunner"
    user_enc_pass: "{{ encrypted_user_pass_vault }}"
    user_sudoer_policy: "{{ user_sudoer_policy_vault }}"
    ssh_pub_key: "{{ ssh_pub_key_vault }}"
    org: "{{ cdn_organization_vault }}"
    activation_key: "{{ cdn_activation_key_vault }}"
    generate_oemdrv_iso: false
