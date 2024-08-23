# .bashrc

# Source global definitions
if [ -f /etc/bashrc ]; then
	. /etc/bashrc
fi

source ~/.git-prompt.sh

# User specific aliases and functions
if [ -f /usr/share/git-core/contrib/completion/git-prompt.sh ]; then
  source /usr/share/git-core/contrib/completion/git-prompt.sh
fi

YELLOW="\[\033[0;33m\]"
WHITE="\e[0;97m"

PS1="\u@\h \W$YELLOW\$(__git_ps1)\[$WHITE\]\$ "

PATH=$PATH:$HOME/.rvm/bin:$HOME/.local/bin # Add RVM to PATH for scripting
[[ -s "$HOME/.rvm/scripts/rvm" ]] && . "$HOME/.rvm/scripts/rvm" # Load RVM function

export VAGRANT_DEFAULT_PROVIDER=libvirt

alias koji-katello='koji -c ~/.koji/katello-config'
alias koji-build='koji-katello build'

alias reset-head='ansible-playbook ~/vim-settings/playbooks/reset-head.yml -e current_directory=$PWD'
alias reset-branch='ansible-playbook ~/vim-settings/playbooks/reset-branch.yml -e current_directory=$PWD'
alias hub-clone='ansible-playbook ~/vim-settings/playbooks/hub-clone.yml -e current_directory=$PWD'
alias lab-clone='ansible-playbook ~/vim-settings/playbooks/lab-clone.yml --vault-password-file ~/vim-settings/playbooks/.vault_password -e current_directory=$PWD'

alias obal-source='ANSIBLE_FORCE_COLOR=true PYTHONPATH=/home/ehelms/workspace/upstream/packaging/obal python3 -m obal'
alias releasetool-source='ANSIBLE_FORCE_COLOR=true PYTHONPATH=/home/ehelms/workspace/upstream/releasetool python3 -m releasetool'
alias vim='vim -p'

alias beaker-test-el7='BEAKER_HYPERVISOR=docker BEAKER_provision=yes BEAKER_destroy=yes BEAKER_setfile=centos7-64{hostname=centos7-64.example.com} bundle exec rake beaker'
alias beaker-test-el8='BEAKER_PUPPET_PACKAGE_NAME=puppet-agent-7.28.0 BEAKER_HYPERVISOR=docker BEAKER_provision=yes BEAKER_destroy=yes BEAKER_setfile=centos8-64{hostname=centos8-64.example.com} bundle exec rake beaker'
alias beaker-test-el9='BEAKER_HYPERVISOR=docker BEAKER_provision=yes BEAKER_destroy=yes BEAKER_setfile=centos9-64{hostname=centos9-64.example.com} bundle exec rake beaker'
alias beaker-test-debian10='BEAKER_HYPERVISOR=docker BEAKER_provision=yes BEAKER_destroy=yes BEAKER_setfile=debian10-64{hostname=debian10-64.example.com} bundle exec rake beaker'
alias beaker-test-debian11='BEAKER_HYPERVISOR=docker BEAKER_provision=yes BEAKER_destroy=yes BEAKER_setfile=debian11-64{hostname=debian11-64.example.com} bundle exec rake beaker'
alias beaker-test-ubuntu18='BEAKER_HYPERVISOR=docker BEAKER_provision=yes BEAKER_destroy=yes BEAKER_setfile=ubuntu1804-64{hostname=ubuntu1804-64.example.com} bundle exec rake beaker'
alias beaker-test-ubuntu20='BEAKER_HYPERVISOR=docker BEAKER_provision=yes BEAKER_destroy=yes BEAKER_setfile=ubuntu2004-64{hostname=ubuntu2004-64.example.com} bundle exec rake beaker'

alias beaker-test-el7-nodestroy='BEAKER_HYPERVISOR=docker BEAKER_provision=yes BEAKER_destroy=no BEAKER_setfile=centos7-64{hostname=centos7-64.example.com} bundle exec rake beaker'
alias beaker-test-el8-nodestroy='BEAKER_timeout=1600 BEAKER_HYPERVISOR=docker BEAKER_provision=yes BEAKER_destroy=no BEAKER_setfile=centos8-64{hostname=centos8-64.example.com} bundle exec rake beaker'
alias beaker-test-el9-nodestroy='BEAKER_HYPERVISOR=docker BEAKER_provision=yes BEAKER_destroy=no BEAKER_setfile=centos9-64{hostname=centos9-64.example.com} bundle exec rake beaker'
alias beaker-test-debian10-nodestroy='BEAKER_HYPERVISOR=docker BEAKER_provision=yes BEAKER_destroy=no BEAKER_setfile=debian10-64{hostname=debian10-64.example.com} bundle exec rake beaker'
alias beaker-test-ubuntu18-nodestroy='BEAKER_HYPERVISOR=docker BEAKER_provision=yes BEAKER_destroy=no BEAKER_setfile=ubuntu1804-64{hostname=ubuntu1804-64.example.com} bundle exec rake beaker'
alias beaker-test-ubuntu20-nodestroy='BEAKER_HYPERVISOR=docker BEAKER_provision=yes BEAKER_destroy=no BEAKER_setfile=ubuntu2004-64{hostname=ubuntu2004-64.example.com} bundle exec rake beaker'

alias cleanup-podman='podman stop $(podman ps -a -q) && podman rm $(podman ps -a -q)'
alias cleanup-docker='docker stop $(docker ps -a -q) && docker rm $(docker ps -a -q)'

alias restart-sound='systemctl --user restart wireplumber pipewire pipewire-pulse'

export RUBYOPT="-W0"
export REQUESTS_CA_BUNDLE=/etc/pki/tls/certs/ca-bundle.crt
export EDITOR='vim'
export PY_COLORS='1'
export ANSIBLE_FORCE_COLOR='1'
export BROKER_DIRECTORY=/home/ehelms/.config/broker

#if [ "$COLORTERM" == "gnome-terminal" ]; then
  #export TERM=xterm-256color
#fi

. ~/.secrets
