#!/bin/bash

dnf -y install ansible-core

ansible-galaxy collection install community.general
ansible-playbook bootstrap.yml

touch ~/.secrets
source ~/.bashrc
