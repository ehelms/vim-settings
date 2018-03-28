#!/bin/bash

sudo yum -y install ansible

ansible-playbook bootstrap.yml --ask-sudo-pass

source ~/.bashrc
