#!/bin/bash

sudo yum -y install ansible

ansible-playbook bootstrap.yml --ask-sudo-pass

curl -fLo ~/.vim/autoload/plug.vim --create-dirs \
    https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim

vim +PlugInstall +qall

source ~/.bashrc
