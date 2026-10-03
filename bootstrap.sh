#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR"

dnf -y install ansible-core

ansible-galaxy collection install community.general
ansible-playbook workstation.yml
ansible-playbook bootstrap.yml

touch ~/.secrets
source ~/.bashrc
