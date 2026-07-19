# monitoring_stack

Deploys a full monitoring stack — Nagios Core for infrastructure monitoring,
Splunk Enterprise for log aggregation and SIEM, Elasticsearch/Kibana with
Filebeat for event storage and visualisation — plus EDA rulebooks that
consume events from all three sources and trigger automated responses.

## Requirements

- Collections: `ansible.builtin`, `ansible.posix` (firewalld), `ansible.eda` (rulebooks)
- Target: RHEL/Rocky 9 servers
- Network: monitoring servers need inbound ports for their services; clients need outbound to servers

## Variable contract

| Variable | Default | Description |
|----------|---------|-------------|
| `mon_action` | `baseline` | Action: `nagios_server`, `nagios_client`, `splunk_server`, `splunk_forwarder`, `elastic_server`, `elastic_agent`, `eda_rulebooks`, `baseline` |
| `mon_apply_*` | `true` | Baseline toggles for each component |
| `mon_nagios_web_password` | `""` | Nagios web UI password |
| `mon_nagios_hosts` | `[]` | Hosts to monitor (name, address, template) |
| `mon_splunk_admin_password` | `""` | Splunk admin password |
| `mon_splunk_fwd_server` | `""` | Splunk indexer for forwarders |
| `mon_elastic_password` | `""` | Elasticsearch password |
| `mon_filebeat_output_host` | `""` | Elasticsearch host for Filebeat |
| `mon_eda_webhook_port` | `5000` | EDA webhook listener base port |

See `defaults/main.yml` for the full variable contract.

## Usage

### In a playbook

Include the role with `mon_action` (and any component vars) via `vars:`. Target
the group appropriate to the action — server actions run on the monitoring
servers, client actions on the monitored hosts.

```yaml
# Stand up the Nagios Core monitoring server
- hosts: monitoring_servers
  become: true
  roles:
    - role: monitoring_stack
      vars:
        mon_action: nagios_server
        mon_nagios_web_password: "{{ vault_nagios_web_password }}"
        mon_nagios_hosts:
          - {name: web-prod-01, address: 10.0.1.100, template: linux-server}
          - {name: db-prod-01, address: 10.0.1.101, template: linux-server}

# Full baseline — deploy every enabled component in one pass
- hosts: monitoring_servers
  become: true
  roles:
    - role: monitoring_stack
      vars:
        mon_action: baseline
        mon_nagios_web_password: "{{ vault_nagios_web_password }}"
        mon_splunk_admin_password: "{{ vault_splunk_admin_password }}"
        mon_elastic_password: "{{ vault_elastic_password }}"
        # Selective baseline: skip Splunk, keep Nagios + Elastic + EDA
        mon_apply_splunk_server: false
        mon_apply_splunk_forwarder: false
```

Client/forwarder actions target the monitored hosts and point back at the servers:

```yaml
- hosts: linux_servers
  become: true
  roles:
    - role: monitoring_stack
      vars:
        mon_action: splunk_forwarder
        mon_splunk_fwd_server: "splunk-idx-01:9997"
        mon_splunk_fwd_password: "{{ vault_splunk_fwd_password }}"
```

### CLI

```bash
# Full baseline — deploy everything
ansible-playbook playbooks/monitoring_stack.yml -e mon_action=baseline

# Server components only
ansible-playbook playbooks/monitoring_stack.yml -e mon_action=nagios_server
ansible-playbook playbooks/monitoring_stack.yml -e mon_action=splunk_server
ansible-playbook playbooks/monitoring_stack.yml -e mon_action=elastic_server

# Client agents on monitored hosts
ansible-playbook playbooks/monitoring_stack.yml -e mon_action=nagios_client
ansible-playbook playbooks/monitoring_stack.yml -e mon_action=splunk_forwarder
ansible-playbook playbooks/monitoring_stack.yml -e mon_action=elastic_agent

# Deploy EDA rulebooks only
ansible-playbook playbooks/monitoring_stack.yml -e mon_action=eda_rulebooks

# Selective baseline — Nagios + EDA only
ansible-playbook playbooks/monitoring_stack.yml \
  -e mon_apply_splunk_server=false \
  -e mon_apply_splunk_forwarder=false \
  -e mon_apply_elastic_server=false \
  -e mon_apply_elastic_agent=false
```

## Testing

```bash
cd roles/monitoring_stack && molecule test
```

Molecule tests dispatcher validation, variable contract, and template
rendering for all components. Full deployment requires target hosts.

## Architecture

```
playbooks/monitoring_stack.yml
  └── roles/monitoring_stack/
        ├── defaults/main.yml             (all mon_* variables)
        ├── tasks/main.yml                (dispatcher)
        ├── tasks/nagios_server.yml       (Nagios Core + plugins + config)
        ├── tasks/nagios_client.yml       (NRPE agent)
        ├── tasks/splunk_server.yml       (Splunk Enterprise + HEC + indexes + alerts)
        ├── tasks/splunk_forwarder.yml    (Universal Forwarder)
        ├── tasks/elastic_server.yml      (Elasticsearch + Kibana + ILM)
        ├── tasks/elastic_agent.yml       (Filebeat + modules)
        ├── tasks/eda_rulebooks.yml       (deploy EDA rulebook templates)
        ├── tasks/baseline.yml            (orchestrator)
        ├── handlers/main.yml             (service restarts)
        └── templates/
              ├── nagios_*.cfg.j2          (contacts, templates, hosts, services, EDA command)
              ├── nrpe.cfg.j2             (NRPE client config)
              ├── splunk_*.conf.j2        (saved searches, inputs)
              ├── elasticsearch.yml.j2    (cluster config)
              ├── kibana.yml.j2           (Kibana config)
              ├── filebeat*.yml.j2        (Filebeat + module configs)
              └── eda_*.yml.j2            (EDA rulebooks)
```

## Event flow

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Nagios      │     │  Splunk      │     │ Elasticsearch │
│  (service    │     │  (saved      │     │ (watcher /    │
│   checks)    │     │   searches)  │     │  alerts)      │
└──────┬───────┘     └──────┬───────┘     └──────┬────────┘
       │ webhook            │ webhook            │ webhook
       └────────────┬───────┘────────────────────┘
                    ▼
          ┌─────────────────┐
          │  EDA Controller │
          │  (rulebooks)    │
          └────────┬────────┘
                   ▼
          ┌─────────────────┐
          │ Event Response  │
          │ Playbooks       │
          │ (item 6)        │
          └─────────────────┘
```

## EDA rulebooks

Three rulebooks deployed by `eda_rulebooks` action:

| Rulebook | Events handled |
|----------|----------------|
| `security_events.yml` | Failed SSH brute force, unauthorized privilege escalation |
| `infrastructure_events.yml` | High CPU, disk space critical |
| `service_health.yml` | Service down, host unreachable |

All rulebooks accept webhooks from Nagios, Splunk, and Elasticsearch with
source-aware condition matching. Each event triggers a response playbook
from `playbooks/event_response.yml` with an `event_action` variable.

## Splunk alerts

| Alert | Frequency | Severity |
|-------|-----------|----------|
| Failed SSH Authentication | 5 min | High |
| High CPU Usage | 5 min | Medium |
| Disk Space Critical | 5 min | High |
| Unauthorized Privilege Escalation | 5 min | Critical |

## Nagios service checks

PING, SSH, HTTP, Disk, Load, Memory, Zombie Procs — all via NRPE.
Three host templates: `linux-server`, `windows-server`, `network-device`.

## Molecule test results

| Scenario | Platform | Status |
|---|---|---|
| default | rockylinux:9-minimal | All assertions pass |

**Scenario: default** — validates config rendering and variable contract without deploying monitoring services:

| Test | What is verified |
|---|---|
| Dispatcher rejection | Invalid `mon_action` raises assertion error |
| Variable contract | All monitoring object lists defined; boolean toggles typed |
| Nagios template rendering | 4 templates rendered to `/tmp/`: `nagios_contacts.cfg`, `nagios_templates.cfg`, `nagios_services.cfg`, `nrpe.cfg` |
| Splunk template rendering | 2 templates: `splunk_savedsearches.conf`, `splunk_inputs.conf` |
| Elastic/Kibana/Filebeat rendering | 6 templates rendered including `elasticsearch.yml`, `kibana.yml`, `filebeat.yml` |
| EDA rulebook rendering | 3 rulebooks rendered: security, infrastructure, service health |
| Nagios template content | `linux-server`, `windows-server`, `network-device` templates present |
| EDA rulebook content | `ansible.eda.webhook` source and `run_playbook` → `event_response` action present |
| Splunk alert content | SSH brute-force, high CPU, privilege escalation alerts present |
| EDA response mappings | All 6 event types mapped: `failed_ssh`, `high_cpu`, `disk_critical`, `privilege_escalation`, `service_down`, `host_unreachable` |

Service installation (Nagios Core, Splunk Enterprise, Elasticsearch) and EDA controller registration require live infrastructure.
