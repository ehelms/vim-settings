#!/bin/bash

sudo yum -y install centos-release-ansible-29
sudo yum -y install ansible

ansible-playbook bootstrap.yml

source ~/.bashrc
