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

alias obal-source='ANSIBLE_FORCE_COLOR=true PYTHONPATH=/home/ehelms/workspace/upstream/obal python3 -m obal'
alias releasetool-source='ANSIBLE_FORCE_COLOR=true PYTHONPATH=/home/ehelms/workspace/upstream/releasetool python3 -m releasetool'

alias beaker-test-el7='BEAKER_HYPERVISOR=docker BEAKER_provision=yes BEAKER_destroy=no BEAKER_setfile=centos7-64{hostname=centos7-64.example.com} bundle exec rake beaker'
alias beaker-test-el8='BEAKER_HYPERVISOR=docker BEAKER_provision=yes BEAKER_destroy=no BEAKER_setfile=centos8-64{hostname=centos8-64.example.com} bundle exec rake beaker'
alias beaker-test-debian10='BEAKER_HYPERVISOR=docker BEAKER_provision=yes BEAKER_destroy=no BEAKER_setfile=debian10-64{hostname=debian10-64.example.com} bundle exec rake beaker'
alias beaker-test-ubuntu18='BEAKER_HYPERVISOR=docker BEAKER_provision=yes BEAKER_destroy=no BEAKER_setfile=ubuntu1804-64{hostname=ubuntu1804-64.example.com} bundle exec rake beaker'

export RUBYOPT="-W0"
export REQUESTS_CA_BUNDLE=/etc/pki/tls/certs/ca-bundle.crt
export EDITOR='vim'
export PY_COLORS='1'
export ANSIBLE_FORCE_COLOR='1'

#if [ "$COLORTERM" == "gnome-terminal" ]; then
  #export TERM=xterm-256color
#fi

# added by travis gem
[ -f /home/ehelms/.travis/travis.sh ] && source /home/ehelms/.travis/travis.sh
