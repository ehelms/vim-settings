#!/bin/bash

yum -y install centos-release-ansible-29
yum -y install ansible

ansible-galaxy collection install community.general
ansible-playbook bootstrap.yml

source ~/.bashrc
